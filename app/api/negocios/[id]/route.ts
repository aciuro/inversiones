import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function getOwned(id: string, userId: string) {
  return prisma.negocio.findFirst({ where: { id, userId } })
}

function num(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const owned = await getOwned(id, session.user.id)
  if (!owned) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const data = await req.json()
  const downARS = num(data.saleDownPaymentARS)
  const downRate = num(data.saleDownPaymentExchangeRate)
  const installmentARS = num(data.saleInstallmentARS)
  const installmentRate = num(data.saleInstallmentExchangeRate)

  const negocio = await prisma.negocio.update({
    where: { id },
    data: {
      nombre: data.nombre ?? owned.nombre,
      inversionUSD: data.inversionUSD ?? owned.inversionUSD,
      porcentaje: data.porcentaje ?? owned.porcentaje,
      status: data.status ?? owned.status,
      soldAt: data.soldAt ? new Date(data.soldAt) : owned.soldAt,
      salePriceUSD: num(data.salePriceUSD) ?? owned.salePriceUSD,
      saleDownPaymentARS: downARS ?? owned.saleDownPaymentARS,
      saleDownPaymentExchangeRate: downRate ?? owned.saleDownPaymentExchangeRate,
      saleDownPaymentUSD: downARS && downRate ? downARS / downRate : owned.saleDownPaymentUSD,
      saleInstallmentsCount: num(data.saleInstallmentsCount) ?? owned.saleInstallmentsCount,
      saleInstallmentARS: installmentARS ?? owned.saleInstallmentARS,
      saleInstallmentExchangeRate: installmentRate ?? owned.saleInstallmentExchangeRate,
      saleInstallmentUSD: installmentARS && installmentRate ? installmentARS / installmentRate : owned.saleInstallmentUSD,
      saleFirstInstallmentDate: data.saleFirstInstallmentDate ? new Date(data.saleFirstInstallmentDate) : owned.saleFirstInstallmentDate,
      saleNotes: data.saleNotes ?? owned.saleNotes,
    },
    include: { retiros: { orderBy: { fecha: "desc" } } },
  })

  return NextResponse.json(negocio)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  if (!await getOwned(id, session.user.id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.negocio.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
