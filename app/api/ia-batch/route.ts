import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

function norm(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s,\.]/g, " ").replace(/\s+/g, " ").trim()
}

function parseNumber(value: string) {
  const n = Number(value.replace(/\./g, "").replace(/,/g, "."))
  return Number.isFinite(n) ? n : null
}

function parseUSD(text: string) {
  const m = text.match(/(?:usd|u\$s|d[oó]lares?)\s*([0-9]+(?:[\.,][0-9]{1,2})?)/i) || text.match(/(?:son|es|monto)\s*(?:usd)?\s*([0-9]+(?:[\.,][0-9]{1,2})?)/i)
  return m ? parseNumber(m[1]) : null
}

function fmt(n: number) {
  return `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`
}

function findProject(projects: any[], text: string) {
  const clean = norm(text)
  let best: any = null
  let score = 0
  for (const p of projects) {
    const name = norm(p.name)
    const parts = name.split(" ").filter((x: string) => x.length >= 3)
    let s = clean.includes(name) ? 20 : 0
    for (const part of parts) if (clean.includes(part)) s += part.length >= 5 ? 8 : 3
    if (name.includes("tiwa") && clean.includes("tiwa")) s += 20
    if (name.includes("cardinal") && clean.includes("cardinal")) s += 20
    if (s > score) { best = p; score = s }
  }
  return score > 0 ? best : null
}

function findMember(project: any, text: string) {
  const clean = norm(text)
  return project.members.find((m: any) => {
    const full = norm(m.user.name)
    const first = full.split(" ")[0]
    return clean.includes(full) || clean.includes(first)
  }) ?? null
}

function parseItems(message: string, project: any) {
  const parts = message
    .split(/\n|\r|(?=\b(?:la|cuota)\s*\d+\b)/i)
    .map(x => x.trim())
    .filter(Boolean)

  const items: any[] = []
  for (const part of parts) {
    const cuotaMatch = norm(part).match(/(?:la\s+|cuota\s*)?(\d+)\b/)
    if (!cuotaMatch) continue
    const cuota = Number(cuotaMatch[1])
    const installment = project.installments.find((c: any) => c.number === cuota)
    if (!installment) continue
    const amountUSD = parseUSD(part) ?? installment.amountUSD ?? installment.amount
    const member = findMember(project, part)
    if (!member) continue
    items.push({ installmentId: installment.id, cuota, amountUSD, paidByUserId: member.userId, paidByName: member.user.name })
  }

  return Array.from(new Map(items.map(i => [i.cuota, i])).values()).sort((a: any, b: any) => a.cuota - b.cuota)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await req.json()

  if (body.mode === "apply") {
    const action = body.action
    if (action?.type !== "UPDATE_PROJECT_INSTALLMENTS_BATCH") return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
    const project = await prisma.project.findFirst({ where: { id: action.projectId, members: { some: { userId: session.user.id } } }, include: { installments: true } })
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 })
    for (const item of action.items) {
      const current = project.installments.find(c => c.id === item.installmentId)
      if (!current) continue
      await prisma.installment.update({ where: { id: item.installmentId }, data: { paidAt: current.paidAt ?? new Date(), amountUSD: item.amountUSD, paidByUserId: item.paidByUserId } })
    }
    return NextResponse.json({ ok: true, message: `Listo. Apliqué ${action.items.length} cambios en ${action.projectName}.` })
  }

  const message = String(body.message ?? "")
  if (!/(cuota|cuotas|pago|pag[oó]|paga|corr|modific|actualiz)/i.test(message)) return NextResponse.json({ reply: null, proposedAction: null })
  const projects = await prisma.project.findMany({ where: { members: { some: { userId: session.user.id } } }, include: { members: { include: { user: true } }, installments: true } })
  const project = findProject(projects, message)
  if (!project) return NextResponse.json({ reply: null, proposedAction: null })
  const items = parseItems(message, project)
  if (items.length < 2) return NextResponse.json({ reply: null, proposedAction: null })

  const action = { type: "UPDATE_PROJECT_INSTALLMENTS_BATCH", projectId: project.id, projectName: project.name, items }
  return NextResponse.json({
    reply: `Detecté ${items.length} cambios para aplicar en ${project.name}:\n\n${items.map((i: any) => `Cuota ${i.cuota}: ${fmt(i.amountUSD)} · pagó ${i.paidByName}`).join("\n")}\n\nConfirmá para guardar todos los cambios.`,
    proposedAction: action,
  })
}
