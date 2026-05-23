import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const SALE_PREFIX = "VENTA_LOCAL_JSON:"

type LocalData = any
type ProjectData = any

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
  | {
      type: "UPDATE_PROJECT_INSTALLMENT_SPLIT"
      projectId: string
      projectName: string
      installmentId: string
      cuota: number
      amountUSD: number
      socios: string | null
      note: string | null
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

function fmt(n: number) {
  return `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`
}

function myPart(amount: number, porcentaje: number) {
  return (amount * porcentaje) / 100
}

function aliases(nombre: string) {
  const base = normalizeText(nombre)
  const set = new Set<string>([base])
  for (const t of textTokens(nombre)) set.add(t)
  for (const alias of ["cardinal", "escobar", "tortugas", "belgrano", "pilates", "office", "pilar", "pilara", "bari", "tiwa", "bio"]) {
    if (base.includes(alias)) set.add(alias)
  }
  return Array.from(set).filter(Boolean)
}

function findByName<T extends { name?: string; nombre?: string }>(items: T[], text: string) {
  const clean = normalizeText(text)
  let best: { item: T; score: number } | null = null
  for (const item of items) {
    const name = String(item.name ?? item.nombre ?? "")
    let score = 0
    for (const alias of aliases(name)) {
      if (clean.includes(alias)) score += alias.length >= 6 ? 20 : 8
    }
    for (const t of textTokens(name)) {
      if (clean.includes(t)) score += 5
    }
    if (!best || score > best.score) best = { item, score }
  }
  return best && best.score > 0 ? best.item : null
}

function parseCuota(text: string) {
  const normalized = normalizeText(text)
  const match = normalized.match(/cuota\s*(?:nro\.?|n°|#)?\s*(\d+)/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
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

async function getProjects(userId: string) {
  return prisma.project.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      installments: { orderBy: { number: "asc" } },
      reinforcements: true,
    },
    orderBy: { createdAt: "asc" },
  })
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

function projectInvested(project: ProjectData) {
  const isBRL = project.currency === "BRL"
  const cuotas = project.installments.filter((c: any) => c.paidAt).reduce((s: number, c: any) => s + (isBRL ? (c.amountUSD ?? c.amount) : c.amount), 0)
  const refuerzos = project.reinforcements?.filter((r: any) => r.paidAt).reduce((s: number, r: any) => s + (isBRL ? (r.amountUSD ?? r.amount) : r.amount), 0) ?? 0
  return (project.entryPrice ?? 0) + cuotas + refuerzos
}

function proposeLocalInstallmentAction(message: string, locales: LocalData[]): ProposedAction | null {
  const lower = normalizeText(message)
  if (!/(cuota|paga|pagada|pago|pague|correg|repart|mitad|socio|yo pague|total yo)/.test(lower)) return null
  const local = findByName(locales, message)
  const cuota = parseCuota(message)
  if (!local || !cuota) return null
  const amountUSD = parseUSD(message) ?? (local.saleInstallmentUSD ? Number(local.saleInstallmentUSD) : null)
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

function proposeProjectInstallmentAction(message: string, projects: ProjectData[]): ProposedAction | null {
  const lower = normalizeText(message)
  if (!/(cuota|paga|pagada|pago|pague|correg|repart|mitad|socio|yo pague|total yo|deberia)/.test(lower)) return null
  const project = findByName(projects, message)
  const cuota = parseCuota(message)
  if (!project || !cuota) return null

  const installment = project.installments?.find((c: any) => c.number === cuota)
  if (!installment) return null

  const isBRL = project.currency === "BRL"
  const amountUSD = parseUSD(message) ?? (isBRL ? (installment.amountUSD ?? installment.amount) : (installment.amountUSD ?? installment.amount))
  if (!amountUSD) return null

  return {
    type: "UPDATE_PROJECT_INSTALLMENT_SPLIT",
    projectId: project.id,
    projectName: project.name,
    installmentId: installment.id,
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
  const local = findByName(locales, message)
  const inversionUSD = parseUSD(message)
  if (!local || !inversionUSD) return null
  return { type: "UPDATE_INVESTMENT", negocioId: local.id, negocioNombre: local.nombre, inversionUSD }
}

function proposeAction(message: string, locales: LocalData[], projects: ProjectData[]): ProposedAction | null {
  return proposeProjectInstallmentAction(message, projects) ?? proposeLocalInstallmentAction(message, locales) ?? proposeInvestmentAction(message, locales)
}

function explainLocal(local: LocalData) {
  const retiros = local.retiros.reduce((s: number, r: any) => s + (r.montoUSD ?? 0), 0)
  const cobradoVenta = myPart((local.saleDownPaymentUSD ?? 0) + paidInstallmentsTotal(local), local.porcentaje)
  const salePrice = local.salePriceUSD ?? 0
  const pending = local.status === "sold" ? myPart(Math.max(0, salePrice - ((local.saleDownPaymentUSD ?? 0) + paidInstallmentsTotal(local))), local.porcentaje) : 0
  return `${local.nombre}:\nInvertido: ${fmt(local.inversionUSD ?? 0)}\nRetiros cobrados: ${fmt(retiros)}\nVenta cobrada, tu parte: ${fmt(cobradoVenta)}\nRecuperado real hoy: ${fmt(retiros + cobradoVenta)}\nPendiente a cobrar: ${fmt(pending)}.`
}

function explainProject(project: ProjectData) {
  const invested = projectInvested(project)
  const current = project.status === "sold" ? (project.soldPrice ?? project.currentValue ?? 0) : (project.currentValue ?? 0)
  const balance = current - invested
  const roi = invested > 0 ? (balance / invested) * 100 : null
  return `${project.name}:\nTotal invertido: ${fmt(invested)}\nValor actual/venta: ${fmt(current)}\nBalance estimado: ${fmt(balance)}\nROI estimado: ${roi === null ? "—" : `${roi.toFixed(1)}%`}.`
}

function simulateSale(message: string, locales: LocalData[], projects: ProjectData[]) {
  const lower = normalizeText(message)
  if (!/(si vendo|simula|simulame|proyecta|futuro|escenario)/.test(lower)) return null
  const local = findByName(locales, message)
  const project = findByName(projects, message)
  const salePrice = parseUSD(message)
  if (!salePrice) return null

  if (project) {
    const invested = projectInvested(project)
    const gain = salePrice - invested
    const roi = invested > 0 ? (gain / invested) * 100 : null
    return `Simulación para ${project.name}:\nVenta hipotética: ${fmt(salePrice)}\nTotal invertido: ${fmt(invested)}\nGanancia/pérdida: ${fmt(gain)}\nROI estimado: ${roi === null ? "—" : `${roi.toFixed(1)}%`}.`
  }

  if (local) {
    const retiros = local.retiros.reduce((s: number, r: any) => s + (r.montoUSD ?? 0), 0)
    const mySale = myPart(salePrice, local.porcentaje)
    const totalFinal = retiros + mySale
    const investment = local.inversionUSD ?? 0
    const gain = totalFinal - investment
    const roi = investment > 0 ? (gain / investment) * 100 : null
    return `Simulación para ${local.nombre}:\nVenta hipotética 100%: ${fmt(salePrice)}\nTu parte de venta: ${fmt(mySale)}\nRetiros ya cobrados: ${fmt(retiros)}\nRecupero final estimado: ${fmt(totalFinal)}\nGanancia/pérdida final: ${fmt(gain)}\nROI final estimado: ${roi === null ? "—" : `${roi.toFixed(1)}%`}.`
  }

  return null
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

function timelineProject(project: ProjectData) {
  const cuotas = project.installments
    .filter((c: any) => c.paidAt)
    .map((c: any) => `Cuota ${c.number}: ${fmt(c.amountUSD ?? c.amount)}${c.paidByUserId ? " - pagador único" : " - repartida por porcentaje"}`)
  return cuotas.length ? `Historial de ${project.name}:\n${cuotas.join("\n")}` : `${project.name} todavía no tiene cuotas pagadas.`
}

function localAnswer(message: string, locales: LocalData[], projects: ProjectData[]) {
  const resumen = resumenFinanciero(locales)
  const action = proposeAction(message, locales, projects)
  if (action) {
    if (action.type === "UPDATE_PROJECT_INSTALLMENT_SPLIT") {
      return {
        reply: `Detecté un cambio para aplicar:\n\nProyecto: ${action.projectName}\nCuota: ${action.cuota}\nMonto pago: ${fmt(action.amountUSD)}\nNuevo reparto: ${action.socios ?? "por porcentaje entre socios"}\n\nConfirmá para guardar el cambio en el proyecto.`,
        proposedAction: action,
      }
    }
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

  const simulation = simulateSale(message, locales, projects)
  if (simulation) return { reply: simulation, proposedAction: null }

  const local = findByName(locales, message)
  const project = findByName(projects, message)
  const lower = normalizeText(message)
  if (project && /(historial|pasado|cobros|detalle|de donde|origen)/.test(lower)) return { reply: timelineProject(project), proposedAction: null }
  if (local && /(historial|pasado|cobros|detalle|de donde|origen)/.test(lower)) return { reply: timelineLocal(local), proposedAction: null }
  if (project) return { reply: explainProject(project), proposedAction: null }
  if (local) return { reply: explainLocal(local), proposedAction: null }

  return {
    reply: `Resumen financiero actual:\nTotal invertido locales: ${fmt(resumen.totalInvertido)}\nRetiros cobrados: ${fmt(resumen.totalRetiros)}\nVenta cobrada, tu parte: ${fmt(resumen.totalVentaCobradoMiParte)}\nRecuperado real locales: ${fmt(resumen.totalRecuperadoReal)}\nPendiente a cobrar locales: ${fmt(resumen.totalPendiente)}.\n\nAhora también puedo interpretar proyectos como Cardinal. Ejemplos:\n• “En Cardinal, la cuota 4 debería ser mitad Augusto y mitad Emilia”\n• “Historial de Cardinal”\n• “Simulame vender Cardinal en USD 90000”`,
    proposedAction: null,
  }
}

async function applyAction(userId: string, action: ProposedAction) {
  if (action.type === "UPDATE_PROJECT_INSTALLMENT_SPLIT") {
    const project = await prisma.project.findFirst({
      where: { id: action.projectId, members: { some: { userId } } },
      include: { installments: true },
    })
    if (!project) throw new Error("No encontré el proyecto")
    const installment = project.installments.find(c => c.id === action.installmentId)
    if (!installment) throw new Error("No encontré la cuota")

    await prisma.installment.update({
      where: { id: action.installmentId },
      data: {
        paidAt: installment.paidAt ?? new Date(),
        amountUSD: action.amountUSD,
        paidByUserId: null,
      },
    })
    return { ok: true, message: `Listo. Corregí ${action.projectName}, cuota ${action.cuota}, como repartida entre socios por ${fmt(action.amountUSD)}.` }
  }

  const locales = await getLocales(userId)
  const local = locales.find(n => n.id === (action as any).negocioId)
  if (!local) throw new Error("No encontré el local")

  if (action.type === "UPDATE_INVESTMENT") {
    await prisma.negocio.update({ where: { id: action.negocioId }, data: { inversionUSD: action.inversionUSD } })
    return { ok: true, message: `Listo. Actualicé ${action.negocioNombre} a ${fmt(action.inversionUSD)} de inversión.` }
  }

  if (!local.salePriceUSD) throw new Error("El local no tiene venta cargada")

  const paid = local.saleInstallmentsPaid ?? []
  const nextPaid = paid.includes(action.cuota) ? paid : [...paid, action.cuota].sort((a, b) => a - b)
  const nextPayments = {
    ...(local.saleInstallmentPayments ?? {}),
    [String(action.cuota)]: { amountUSD: action.amountUSD, socios: action.socios, note: action.note },
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
  const projects = await getProjects(session.user.id)
  const fallback = localAnswer(String(body.message ?? ""), locales, projects)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json(fallback)

  try {
    const summary = resumenFinanciero(locales)
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          { role: "system", content: "Sos un copiloto financiero para una app de inversiones. Interpretás locales y proyectos. Para modificar datos, siempre pedí confirmación y no digas que ya lo hiciste." },
          { role: "user", content: `Datos locales: ${JSON.stringify(summary)}\nProyectos: ${JSON.stringify(projects)}\nRespuesta base calculada: ${fallback.reply}\nPedido: ${String(body.message ?? "")}` },
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
