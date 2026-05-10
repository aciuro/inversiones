import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const SALE_PREFIX = "VENTA_LOCAL_JSON:"

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

function withSyntheticSale(negocio: any) {
  const saleRetiro = negocio.retiros?.find((r: any) => typeof r.nota === "string" && r.nota.startsWith(SALE_PREFIX))
  if (!saleRetiro) {
    return {
      ...negocio,
      status: "active",
      soldAt: null,
      salePriceUSD: null,
      saleDownPaymentARS: null,
      saleDownPaymentExchangeRate: null,
      saleDownPaymentUSD: null,
      saleInstallmentsCount: null,
      saleInstallmentARS: null,
      saleInstallmentExchangeRate: null,
      saleInstallmentUSD: null,
      saleFirstInstallmentDate: null,
      saleNotes: null,
    }
  }

  try {
    const payload = JSON.parse(saleRetiro.nota.replace(SALE_PREFIX, ""))
    return {
      ...negocio,
      status: "sold",
      soldAt: payload.soldAt ?? saleRetiro.fecha,
      salePriceUSD: payload.salePriceUSD ?? saleRetiro.montoUSD,
      saleDownPaymentARS: payload.downPaymentUSD ?? null,
      saleDownPaymentExchangeRate: 1,
      saleDownPaymentUSD: payload.downPaymentUSD ?? null,
      saleInstallmentsCount: payload.installmentsCount ?? null,
      saleInstallmentARS: payload.installmentUSD ?? null,
      saleInstallmentExchangeRate: 1,
      saleInstallmentUSD: payload.installmentUSD ?? null,
      saleFirstInstallmentDate: payload.firstInstallmentDate ?? null,
      saleNotes: payload.notes ?? null,
    }
  } catch {
    return negocio
  }
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
    return NextResponse.json(withSyntheticSale(negocio))
  }

  const salePriceUSD = num(data.salePriceUSD) ?? 0
  const downPaymentUSD = num(data.saleDownPaymentARS) ?? null
  const installmentUSD = num(data.saleInstallmentARS) ?? null
  const installmentsCount = num(data.saleInstallmentsCount) ?? null
  const soldAt = data.soldAt ? new Date(data.soldAt) : new Date()

  const payload = {
    soldAt: soldAt.toISOString(),
    salePriceUSD,
    downPaymentUSD,
    installmentsCount,
    installmentUSD,
    firstInstallmentDate: data.saleFirstInstallmentDate ?? null,
    notes: data.saleNotes ?? null,
  }

  await prisma.retiro.deleteMany({
    where: {
      negocioId: id,
      nota: { startsWith: SALE_PREFIX },
    },
  })

  await prisma.retiro.create({
    data: {
      negocioId: id,
      fecha: soldAt,
      montoARS: salePriceUSD,
      tipoCambio: 1,
      montoUSD: salePriceUSD,
      nota: SALE_PREFIX + JSON.stringify(payload),
    },
  })

  const negocio = await prisma.negocio.findUnique({
    where: { id },
    include: { retiros: { orderBy: { fecha: "desc" } } },
  })

  return NextResponse.json(withSyntheticSale(negocio))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  if (!await getOwned(id, session.user.id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.negocio.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
