import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const SALE_PREFIX = "VENTA_LOCAL_JSON:"

type LocalData = any

type ProposedAction = {
  type: "UPDATE_INSTALLMENT_PAYMENT"
  negocioId: string
  negocioNombre: string
  cuota: number
  amountUSD: number
  socios: string | null
  note: string | null
}

function withSyntheticSale(negocio: any) {
  const saleRetiro = negocio.retiros?.find((r: any) => typeof r.nota === "string" && r.nota.startsWith(SALE_PREFIX))
  const retirosVisibles = negocio.retiros?.filter((r: any) => !(typeof r.nota === "string" && r.nota.startsWith(SALE_PREFIX))) ?? []

  if (!saleRetiro) {
    return {
      ...negocio,
      retiros: retirosVisibles,
      status: "active",
      soldAt: null,
      salePriceUSD: null,
      saleDownPaymentUSD: null,
      saleInstallmentsCount: null,
      saleInstallmentUSD: null,
      saleFirstInstallmentDate: null,
      saleNotes: null,
      saleInstallmentsPaid: [],
      saleInstallmentPayments: {},
    }
  }

  try {
    const payload = JSON.parse(saleRetiro.nota.replace(SALE_PREFIX, ""))
    return {
      ...negocio,
      retiros: retirosVisibles,
      status: "sold",
      soldAt: payload.soldAt ?? saleRetiro.fecha,
      salePriceUSD: payload.salePriceUSD ?? saleRetiro.montoUSD,
      saleDownPaymentUSD: payload.downPaymentUSD ?? null,
      saleInstallmentsCount: payload.installmentsCount ?? null,
      saleInstallmentUSD: payload.installmentUSD ?? null,
      saleFirstInstallmentDate: payload.firstInstallmentDate ?? null,
      saleNotes: payload.notes ?? null,
      saleInstallmentsPaid: payload.paidInstallments ?? [],
      saleInstallmentPayments: payload.installmentPayments ?? {},
    }
  } catch {
    return { ...negocio, retiros: retirosVisibles, saleInstallmentPayments: {} }
  }
}

async function getLocales(userId: string) {
  const negocios = await prisma.negocio.findMany({
    where: { userId },
    select: {
      id: true,
      nombre: true,
      inversionUSD: true,
      porcentaje: true,
      createdAt: true,
      retiros: { orderBy: { fecha: "desc" } },
    },
    orderBy: { createdAt: "asc" },
  })
  return negocios.map(withSyntheticSale)
}

function fmt(n: number) {
  return `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`
}

function myPart(amount: number, porcentaje: number) {
  return (amount * porcentaje) / 100
}

function paidInstallmentsTotal(n: LocalData) {
  const installment = n.saleInstallmentUSD ?? 0
  const paid = n.saleInstallmentsPaid ?? []
  const payments = n.saleInstallmentPayments ?? {}
  return paid.reduce((sum: number, number: number) => {
    const savedAmount = payments[String(number)]?.amountUSD
    return sum + (typeof savedAmount === "number" && Number.isFinite(savedAmount) ? savedAmount : installment)
  }, 0)
}

function resumenFinanciero(locales: LocalData[]) {
  const totalInvertido = locales.reduce((s, n) => s + (n.inversionUSD ?? 0), 0)
  const totalRetiros = locales.reduce((s, n) => s + n.retiros.reduce((sr: number, r: any) => sr + (r.montoUSD ?? 0), 0), 0)
  const totalVentaCobradoMiParte = locales.reduce((s, n) => {
    const down = n.saleDownPaymentUSD ?? 0
    return s + myPart(down + paidInstallmentsTotal(n), n.porcentaje)
  }, 0)
  const totalPendiente = locales.reduce((s, n) => {
    if (n.status !== "sold" && !n.salePriceUSD) return s
    const salePrice = n.salePriceUSD ?? 0
    const down = n.saleDownPaymentUSD ?? 0
    const pending = Math.max(0, salePrice - (down + paidInstallmentsTotal(n)))
    return s + myPart(pending, n.porcentaje)
  }, 0)

  return {
    totalInvertido,
    totalRetiros,
    totalVentaCobradoMiParte,
    totalRecuperadoReal: totalRetiros + totalVentaCobradoMiParte,
    totalPendiente,
  }
}

function normalizeText(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function findLocal(locales: LocalData[], text: string) {
  const clean = normalizeText(text)
  return locales.find(n => clean.includes(normalizeText(String(n.nombre))))
}

function parseAmount(text: string, local?: LocalData, cuota?: number | null) {
  const explicit = text.match(/(?:usd|u\$s|d[oó]lares?)\s*([0-9]+(?:[\.,][0-9]{1,2})?)/i)
  if (explicit) {
    const n = Number(explicit[1].replace(/\./g, "").replace(/,/g, "."))
    return Number.isFinite(n) ? n : null
  }

  const moneyContext = text.match(/(?:por|pago|pague|pag[oó]|monto|total)\s*(?:usd|u\$s)?\s*([0-9]+(?:[\.,][0-9]{1,2})?)/i)
  if (moneyContext) {
    const n = Number(moneyContext[1].replace(/\./g, "").replace(/,/g, "."))
    return Number.isFinite(n) ? n : null
  }

  if (local && cuota && local.saleInstallmentUSD) return Number(local.saleInstallmentUSD)
  return null
}

function parseCuota(text: string) {
  const match = text.match(/cuota\s*(?:nro\.?|n°|#)?\s*(\d+)/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

function extractNames(text: string) {
  const names = ["augusto", "lucas", "fernando", "maria", "maría", "emilia", "nicolas", "nicolás"]
  const clean = normalizeText(text)
  const found: string[] = []
  for (const name of names) {
    if (clean.includes(normalizeText(name))) {
      const pretty = name === "maria" ? "María" : name.charAt(0).toUpperCase() + name.slice(1)
      if (!found.some(x => normalizeText(x) === normalizeText(pretty))) found.push(pretty)
    }
  }
  return found
}

function extractSocios(text: string, amountUSD?: number | null) {
  const clean = normalizeText(text)
  const names = extractNames(text)

  if ((clean.includes("mitad") || clean.includes("50") || clean.includes("medio")) && names.length >= 2 && amountUSD) {
    const each = amountUSD / names.length
    return names.map(name => `${name} ${fmt(each)}`).join(" / ")
  }

  const explicit = text.match(/(?:augusto|lucas|fernando|mar[ií]a|emilia|nicol[aá]s|socio)[^\n,;]*/gi)
  if (explicit?.length) return explicit.join(" / ")
  if (names.length) return names.join(" / ")
  return null
}

function proposeAction(message: string, locales: LocalData[]): ProposedAction | null {
  const lower = normalizeText(message)
  if (!/(cuota|paga|pagada|pago|pague|correg|repart|mitad|socio)/.test(lower)) return null

  const local = findLocal(locales, message)
  const cuota = parseCuota(message)
  if (!local || !cuota) return null

  const amountUSD = parseAmount(message, local, cuota)
  if (!amountUSD) return null

  return {
    type: "UPDATE_INSTALLMENT_PAYMENT",
    negocioId: local.id,
    negocioNombre: local.nombre,
    cuota,
    amountUSD,
    socios: extractSocios(message, amountUSD),
    note: lower.includes("correg") ? "Corregido desde IA" : "Cargado desde IA",
  }
}

function localAnswer(message: string, locales: LocalData[]) {
  const resumen = resumenFinanciero(locales)
  const action = proposeAction(message, locales)
  if (action) {
    return {
      reply: `Detecté un cambio para aplicar:\n\nLocal: ${action.negocioNombre}\nCuota: ${action.cuota}\nMonto pagado 100%: ${fmt(action.amountUSD)}\nDetalle socios: ${action.socios ?? "sin detalle"}\n\nConfirmá para guardar el pago en la app.`,
      proposedAction: action,
    }
  }

  const local = findLocal(locales, message)
  if (local) {
    const retiros = local.retiros.reduce((s: number, r: any) => s + (r.montoUSD ?? 0), 0)
    const cobradoVenta = myPart((local.saleDownPaymentUSD ?? 0) + paidInstallmentsTotal(local), local.porcentaje)
    const salePrice = local.salePriceUSD ?? 0
    const pending = local.status === "sold" ? myPart(Math.max(0, salePrice - ((local.saleDownPaymentUSD ?? 0) + paidInstallmentsTotal(local))), local.porcentaje) : 0
    return {
      reply: `${local.nombre}:\nInvertido: ${fmt(local.inversionUSD ?? 0)}\nRetiros: ${fmt(retiros)}\nCobrado de venta, tu parte: ${fmt(cobradoVenta)}\nRecuperado real: ${fmt(retiros + cobradoVenta)}\nPendiente a cobrar: ${fmt(pending)}.`,
      proposedAction: null,
    }
  }

  return {
    reply: `Resumen financiero actual:\nTotal invertido: ${fmt(resumen.totalInvertido)}\nRetiros cobrados: ${fmt(resumen.totalRetiros)}\nVenta cobrada, tu parte: ${fmt(resumen.totalVentaCobradoMiParte)}\nRecuperado real: ${fmt(resumen.totalRecuperadoReal)}\nPendiente a cobrar: ${fmt(resumen.totalPendiente)}.\n\nTambién puedo preparar cambios. Ejemplo: “Corregí cuota 4 de Cardinal: mitad Augusto y mitad Emilia”.`,
    proposedAction: null,
  }
}

async function applyAction(userId: string, action: ProposedAction) {
  const locales = await getLocales(userId)
  const local = locales.find(n => n.id === action.negocioId)
  if (!local) throw new Error("No encontré el local")
  if (!local.salePriceUSD) throw new Error("El local no tiene venta cargada")

  const paid = local.saleInstallmentsPaid ?? []
  const nextPaid = paid.includes(action.cuota) ? paid : [...paid, action.cuota].sort((a, b) => a - b)
  const nextPayments = {
    ...(local.saleInstallmentPayments ?? {}),
    [String(action.cuota)]: {
      amountUSD: action.amountUSD,
      socios: action.socios,
      note: action.note,
    },
  }

  const payload = {
    soldAt: local.soldAt,
    salePriceUSD: local.salePriceUSD,
    downPaymentUSD: local.saleDownPaymentUSD ?? null,
    installmentsCount: local.saleInstallmentsCount ?? null,
    installmentUSD: local.saleInstallmentUSD ?? null,
    firstInstallmentDate: local.saleFirstInstallmentDate ?? null,
    notes: local.saleNotes ?? null,
    paidInstallments: nextPaid,
    installmentPayments: nextPayments,
  }

  await prisma.retiro.deleteMany({ where: { negocioId: local.id, nota: { startsWith: SALE_PREFIX } } })
  await prisma.retiro.create({
    data: {
      negocioId: local.id,
      fecha: payload.soldAt ? new Date(payload.soldAt) : new Date(),
      montoARS: payload.salePriceUSD,
      tipoCambio: 1,
      montoUSD: payload.salePriceUSD,
      nota: SALE_PREFIX + JSON.stringify(payload),
    },
  })

  return { ok: true, message: `Listo. Guardé ${local.nombre}, cuota ${action.cuota}, por ${fmt(action.amountUSD)}.` }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const mode = body.mode ?? "chat"

  if (mode === "apply") {
    const result = await applyAction(session.user.id, body.action)
    return NextResponse.json(result)
  }

  const locales = await getLocales(session.user.id)
  const fallback = localAnswer(String(body.message ?? ""), locales)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json(fallback)

  try {
    const summary = resumenFinanciero(locales)
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: "Sos un copiloto financiero para una app de inversiones. Responde en español rioplatense, concreto. No inventes datos. Si el usuario pide modificar datos, explicá la intención y pedí confirmación; no digas que ya lo hiciste.",
          },
          {
            role: "user",
            content: `Datos financieros resumidos: ${JSON.stringify(summary)}\nLocales: ${JSON.stringify(locales)}\nPedido: ${String(body.message ?? "")}`,
          },
        ],
      }),
    })
    const data = await response.json()
    const text = data.output_text || fallback.reply
    return NextResponse.json({ reply: text, proposedAction: fallback.proposedAction })
  } catch {
    return NextResponse.json(fallback)
  }
}
