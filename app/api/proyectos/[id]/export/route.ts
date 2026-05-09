import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function money(value: unknown) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n.toFixed(2) : "0.00"
}

function date(value: unknown) {
  if (!value) return ""
  return new Date(value as string | Date).toLocaleDateString("es-AR")
}

function table(title: string, headers: string[], rows: unknown[][]) {
  return `
    <h2>${esc(title)}</h2>
    <table border="1">
      <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
    <br />
  `
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return new Response("No autorizado", { status: 401 })

  const { id } = await params
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId: id } },
  })
  if (!member || member.sharePercent <= 0) return new Response("No encontrado", { status: 404 })

  const p = await prisma.project.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { name: true, email: true } } } },
      installments: { orderBy: { number: "asc" } },
      reinforcements: { orderBy: { dueDate: "asc" } },
    },
  })
  if (!p) return new Response("No encontrado", { status: 404 })

  const isBRL = p.currency === "BRL"
  const cuotasPagadas = p.installments.filter(c => c.paidAt)
  const refPagados = p.reinforcements.filter(r => r.paidAt)
  const totalCuotasUSD = cuotasPagadas.reduce((s, c) => s + (isBRL ? (c.amountUSD ?? 0) : c.amount), 0)
  const totalRefUSD = refPagados.reduce((s, r) => s + (isBRL ? (r.amountUSD ?? 0) : r.amount), 0)
  const totalInvertidoUSD = p.entryPrice + totalCuotasUSD + totalRefUSD
  const balanceUSD = p.currentValue - totalInvertidoUSD
  const myShare = member.sharePercent
  const miParteUSD = totalInvertidoUSD * myShare / 100
  const miBalanceUSD = balanceUSD * myShare / 100

  const html = `
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <h1>${esc(p.name)}</h1>
        ${table("Resumen", ["Concepto", "Valor"], [
          ["Nombre", p.name],
          ["Desarrolladora", p.developer],
          ["Ubicación", p.location],
          ["Unidad", p.unitNumber],
          ["Moneda", p.currency],
          ["Estado", p.status],
          ["Precio total", money(p.totalPrice)],
          ["Entrada USD", money(p.entryPrice)],
          ["Valor actual USD", money(p.currentValue)],
          ["Total invertido USD", money(totalInvertidoUSD)],
          ["Balance USD", money(balanceUSD)],
          ["Mi porcentaje", `${money(myShare)}%`],
          ["Mi aporte USD", money(miParteUSD)],
          ["Mi balance USD", money(miBalanceUSD)],
        ])}
        ${table("Socios", ["Nombre", "Email", "Rol", "Porcentaje"], p.members.map(m => [m.user.name, m.user.email, m.role, `${money(m.sharePercent)}%`]))}
        ${table("Cuotas", ["Nro", "Vencimiento", "Monto", "Monto USD", "Pagada", "Fecha pago"], p.installments.map(c => [c.number, date(c.dueDate), money(c.amount), money(c.amountUSD ?? (isBRL ? 0 : c.amount)), c.paidAt ? "Si" : "No", date(c.paidAt)]))}
        ${table("Refuerzos", ["Etiqueta", "Vencimiento", "Monto", "Monto USD", "Pagado", "Fecha pago"], p.reinforcements.map(r => [r.label, date(r.dueDate), money(r.amount), money(r.amountUSD ?? (isBRL ? 0 : r.amount)), r.paidAt ? "Si" : "No", date(r.paidAt)]))}
      </body>
    </html>
  `

  const filename = `${p.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.xls`
  return new Response(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
