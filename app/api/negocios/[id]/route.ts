import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function getOwned(id: string, userId: string) {
  return prisma.negocio.findFirst({
    where: { id, userId },
    select: {
      id: true,
      nombre: true,
      inversionUSD: true,
      porcentaje: true,
      userId: true,
    },
  })
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
  const isSale = data.status === "sold" || data.soldAt || data.salePriceUSD != null

  if (!isSale) {
    const negocio = await prisma.negocio.update({
      where: { id },
      data: {
        nombre: data.nombre ?? owned.nombre,
        inversionUSD: data.inversionUSD ?? owned.inversionUSD,
        porcentaje: data.porcentaje ?? owned.porcentaje,
      },
      include: { retiros: { orderBy: { fecha: "desc" } } },
    })
    return NextResponse.json(negocio)
  }

  const salePriceUSD = num(data.salePriceUSD)
  const downUSD = num(data.saleDownPaymentARS)
  const installmentUSD = num(data.saleInstallmentARS)
  const count = num(data.saleInstallmentsCount)

  try {
    const negocio = await prisma.negocio.update({
      where: { id },
      data: {
        nombre: data.nombre ?? owned.nombre,
        inversionUSD: data.inversionUSD ?? owned.inversionUSD,
        porcentaje: data.porcentaje ?? owned.porcentaje,
        status: "sold",
        soldAt: data.soldAt ? new Date(data.soldAt) : new Date(),
        salePriceUSD,
        saleDownPaymentARS: downUSD,
        saleDownPaymentExchangeRate: 1,
        saleDownPaymentUSD: downUSD,
        saleInstallmentsCount: count,
        saleInstallmentARS: installmentUSD,
        saleInstallmentExchangeRate: 1,
        saleInstallmentUSD: installmentUSD,
        saleFirstInstallmentDate: data.saleFirstInstallmentDate ? new Date(data.saleFirstInstallmentDate) : null,
        saleNotes: data.saleNotes ?? null,
      },
      include: { retiros: { orderBy: { fecha: "desc" } } },
    })
    return NextResponse.json(negocio)
  } catch (error) {
    return NextResponse.json({
      error: "Falta aplicar la migracion de base de datos para guardar ventas.",
      details: "Ejecuta en Railway: npx prisma db push",
    }, { status: 409 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  if (!await getOwned(id, session.user.id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.negocio.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
