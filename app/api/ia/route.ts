import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const SALE_PREFIX = "VENTA_LOCAL_JSON:"

type LocalData = any

type ProposedAction =
  | {
      type: "UPDATE_INSTALLMENT_PAYMENT"
      negocioId: string
      negocioNombre: string
      cuota: number
      amountUSD: number
      socios: string | null
      note: string | null
    }
  | {
      type: "UPDATE_INVESTMENT"
      negocioId: string
      negocioNombre: string
      inversionUSD: number
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

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function textTokens(text: string) {
  return normalizeText(text).split(" ").filter(t => t.length >= 3)
}

function localAliases(nombre: string) {
  const base = normalizeText(nombre)
  const set = new Set<string>([base])
  for (const t of textTokens(nombre)) set.add(t)

  const common = ["cardinal", "escobar", "tortugas", "belgrano", "pilates", "office", "pilar", "pilara", "bari", "tiwa", "bio"]
  for (const alias of common) {
    if (base.includes(alias)) set.add(alias)
  }

  return Array.from(set).filter(Boolean)
}

function findLocal(locales: LocalData[], text: string) {
  const clean = normalizeText(text)
  let best: { local: LocalData; score: number } | null = null

  for (const local of locales) {
    const name = String(local.nombre ?? "")
    const aliases = localAliases(name)
    let score = 0

    for (const alias of aliases) {
      if (!alias) continue
      if (clean.includes(alias)) score += alias.length >= 6 ? 20 : 8
    }

    for (const t of textTokens(name)) {
      if (clean.includes(t)) score += 5
    }

    if (!best || score > best.score) best = { local, score }
  }

  return best && best.score > 0 ? best.local : null
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

function parseUSD(text: string) {
  const explicit = text.match(/(?:usd|u\$s|d[oó]lares?)\s*([0-9]+(?:[\.,][0-9]{1,2})?)/i)
  if (explicit) {
    const n = Number(explicit[1].replace(/\./g, "").replace(/,/g, "."))
    return Number.isFinite(n) ? n : null
  }

  const afterContext = text.match(/(?:por|a|en|monto|total|valor|inversion|inversi[oó]n)\s*(?:usd|u\$s)?\s*([0-9]+(?:[\.,][0-9]{1,2})?)/i)
  if (afterContext) {
    const n = Number(afterContext[1].replace(/\./g, "").replace(/,/g, "."))
    return Number.isFinite(n) ? n : null
  }

  return null
}

function parseAmount(text: string, local?: LocalData, cuota?: number | null) {
  const amount = parseUSD(text)
  if (amount) return amount
  if (local && cuota && local.saleInstallmentUSD) return Number(local.saleInstallmentUSD)
  return null
}

function parseCuota(text: string) {
  const normalized = normalizeText(text)
  const match = normalized.match(/cuota\s*(?:nro\.?|n°|#)?\s*(\d+)/i)
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
      const pretty = normalizeText(name) === "maria" ? "María" : name.charAt(0).toUpperCase() + name.slice(1)
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

function proposeInstallmentAction(message: string, locales: LocalData[]): ProposedAction | null {
  const lower = normalizeText(message)
  if (!/(cuota|paga|pagada|pago|pague|correg|repart|mitad|socio|yo pague|total yo)/.test(lower)) return null

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
    note: lower.includes("correg") || lower.includes("deberia") ? "Corregido desde IA" : "Cargado desde IA",
  }
}

function proposeInvestmentAction(message: string, locales: LocalData[]): ProposedAction | null {
  const lower = normalizeText(message)
  if (!/(inversion|inverti|invertido|capital)/.test(lower)) return null
  if (!/(cambia|actualiza|modifica|pon|pone|deja|setea)/.test(lower)) return null

  const local = findLocal(locales, message)
  const inversionUSD = parseUSD(message)
  if (!local || !inversionUSD) return null

  return {
    type: "UPDATE_INVESTMENT",
    negocioId: local.id,
    negocioNombre: local.nombre,
    inversionUSD,
  }
}

function proposeAction(message: string, locales: LocalData[]): ProposedAction | null {
  return proposeInstallmentAction(message, locales) ?? proposeInvestmentAction(message, locales)
}

function explainLocal(local: LocalData) {
  const retiros = local.retiros.reduce((s: number, r: any) => s + (r.montoUSD ?? 0), 0)
  const cobradoVenta = myPart((local.saleDownPaymentUSD ?? 0) + paidInstallmentsTotal(local), local.porcentaje)
  const salePrice = local.salePriceUSD ?? 0
  const pending = local.status === "sold" ? myPart(Math.max(0, salePrice - ((local.saleDownPaymentUSD ?? 0) + paidInstallmentsTotal(local))), local.porcentaje) : 0
  const recuperado = retiros + cobradoVenta
  const invertido = local.inversionUSD ?? 0
  const roiReal = invertido > 0 ? ((recuperado - invertido) / invertido) * 100 : null
  const roiFinal = invertido > 0 && salePrice > 0 ? ((myPart(salePrice, local.porcentaje) + retiros - invertido) / invertido) * 100 : null

  return `${local.nombre}:\nInvertido: ${fmt(invertido)}\nRetiros cobrados: ${fmt(retiros)}\nVenta cobrada, tu parte: ${fmt(cobradoVenta)}\nRecuperado real hoy: ${fmt(recuperado)}\nPendiente a cobrar: ${fmt(pending)}\nROI real hoy: ${roiReal === null ? "—" : `${roiReal.toFixed(1)}%`}\nROI final estimado: ${roiFinal === null ? "—" : `${roiFinal.toFixed(1)}%`}.`
}

function simulateSale(message: string, locales: LocalData[]) {
  const lower = normalizeText(message)
  if (!/(si vendo|simula|simulame|proyecta|futuro|escenario)/.test(lower)) return null
  const local = findLocal(locales, message)
  const salePrice = parseUSD(message)
  if (!local || !salePrice) return null

  const retiros = local.retiros.reduce((s: number, r: any) => s + (r.montoUSD ?? 0), 0)
  const mySale = myPart(salePrice, local.porcentaje)
  const totalFinal = retiros + mySale
  const investment = local.inversionUSD ?? 0
  const gain = totalFinal - investment
  const roi = investment > 0 ? (gain / investment) * 100 : null

  return `Simulación para ${local.nombre}:\nVenta hipotética 100%: ${fmt(salePrice)}\nTu porcentaje: ${local.porcentaje}%\nTu parte de venta: ${fmt(mySale)}\nRetiros ya cobrados: ${fmt(retiros)}\nRecupero final estimado: ${fmt(totalFinal)}\nGanancia/pérdida final: ${fmt(gain)}\nROI final estimado: ${roi === null ? "—" : `${roi.toFixed(1)}%`}.`
}

function timelineLocal(local: LocalData) {
  const retiros = local.retiros.map((r: any) => `Retiro ${new Date(r.fecha).toLocaleDateString("es-AR")}: ${fmt(r.montoUSD ?? 0)}${r.nota ? ` (${r.nota})` : ""}`)
  const paid = local.saleInstallmentsPaid ?? []
  const payments = local.saleInstallmentPayments ?? {}
  const cuotas = paid.map((n: number) => {
    const amount = payments[String(n)]?.amountUSD ?? local.saleInstallmentUSD ?? 0
    const socios = payments[String(n)]?.socios ? ` - ${payments[String(n)].socios}` : ""
    return `Cuota ${n}: ${fmt(amount)}${socios}`
  })
  const items = [...retiros, ...cuotas]
  return items.length ? `Historial de ${local.nombre}:\n${items.join("\n")}` : `${local.nombre} todavía no tiene cobros registrados.`
}

function localAnswer(message: string, locales: LocalData[]) {
  const resumen = resumenFinanciero(locales)
  const action = proposeAction(message, locales)
  if (action) {
    if (action.type === "UPDATE_INSTALLMENT_PAYMENT") {
      return {
        reply: `Detecté un cambio para aplicar:\n\nLocal: ${action.negocioNombre}\nCuota: ${action.cuota}\nMonto pagado 100%: ${fmt(action.amountUSD)}\nDetalle socios: ${action.socios ?? "sin detalle"}\n\nConfirmá para guardar el pago en la app.`,
        proposedAction: action,
      }
    }
    return {
      reply: `Detecté un cambio para aplicar:\n\nLocal: ${action.negocioNombre}\nNueva inversión: ${fmt(action.inversionUSD)}\n\nConfirmá para actualizar el capital invertido.`,
      proposedAction: action,
    }
  }

  const simulation = simulateSale(message, locales)
  if (simulation) return { reply: simulation, proposedAction: null }

  const local = findLocal(locales, message)
  const lower = normalizeText(message)
  if (local && /(historial|pasado|cobros|detalle|de donde|origen)/.test(lower)) {
    return { reply: timelineLocal(local), proposedAction: null }
  }
  if (local) return { reply: explainLocal(local), proposedAction: null }

  const ranking = [...locales]
    .map(local => {
      const recuperado = local.retiros.reduce((s: number, r: any) => s + (r.montoUSD ?? 0), 0) + myPart((local.saleDownPaymentUSD ?? 0) + paidInstallmentsTotal(local), local.porcentaje)
      const inv = local.inversionUSD ?? 0
      const roi = inv > 0 ? ((recuperado - inv) / inv) * 100 : null
      return { nombre: local.nombre, roi, recuperado, inv }
    })
    .filter(x => x.roi !== null)
    .sort((a, b) => (b.roi ?? -999) - (a.roi ?? -999))

  if (/(mejor|ranking|roi|retorno|rentabilidad)/.test(lower) && ranking.length) {
    return {
      reply: `Ranking por ROI real hoy:\n${ranking.map((x, i) => `${i + 1}. ${x.nombre}: ${x.roi!.toFixed(1)}% (${fmt(x.recuperado)} recuperado sobre ${fmt(x.inv)} invertido)`).join("\n")}`,
      proposedAction: null,
    }
  }

  return {
    reply: `Resumen financiero actual:\nTotal invertido: ${fmt(resumen.totalInvertido)}\nRetiros cobrados: ${fmt(resumen.totalRetiros)}\nVenta cobrada, tu parte: ${fmt(resumen.totalVentaCobradoMiParte)}\nRecuperado real: ${fmt(resumen.totalRecuperadoReal)}\nPendiente a cobrar: ${fmt(resumen.totalPendiente)}.\n\nPuedo interpretar pasado, presente y futuro. Ejemplos:\n• “Historial de Cardinal”\n• “Simulame vender Cardinal en USD 90000”\n• “Ranking por ROI”\n• “Corregí cuota 4 de Cardinal: mitad Augusto y mitad Emilia”\n• “Actualizá inversión de Cardinal a USD 20000”.`,
    proposedAction: null,
  }
}

async function applyAction(userId: string, action: ProposedAction) {
  const locales = await getLocales(userId)
  const local = locales.find(n => n.id === action.negocioId)
  if (!local) throw new Error("No encontré el local")

  if (action.type === "UPDATE_INVESTMENT") {
    await prisma.negocio.update({
      where: { id: action.negocioId },
      data: { inversionUSD: action.inversionUSD },
    })
    return { ok: true, message: `Listo. Actualicé ${action.negocioNombre} a ${fmt(action.inversionUSD)} de inversión.` }
  }

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
            content: "Sos un copiloto financiero para una app de inversiones. Interpretás pedidos de pasado, presente y futuro. Podés analizar, calcular, simular y preparar modificaciones. Para modificar datos, siempre pedí confirmación y no digas que ya lo hiciste. Sé concreto y no inventes datos.",
          },
          {
            role: "user",
            content: `Datos financieros resumidos: ${JSON.stringify(summary)}\nLocales: ${JSON.stringify(locales)}\nRespuesta base calculada: ${fallback.reply}\nPedido: ${String(body.message ?? "")}`,
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
