import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const SALE_PREFIX = "VENTA_LOCAL_JSON:"

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
    }
  } catch {
    return { ...negocio, retiros: retirosVisibles }
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const negocios = await prisma.negocio.findMany({
    where: { userId: session.user.id },
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

  return NextResponse.json(negocios.map(withSyntheticSale))
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { nombre, inversionUSD, porcentaje } = await req.json()
  if (!nombre || porcentaje == null) return NextResponse.json({ error: "Faltan campos" }, { status: 400 })

  const negocio = await prisma.negocio.create({
    data: { nombre, inversionUSD: inversionUSD ?? null, porcentaje, userId: session.user.id },
    include: { retiros: true },
  })

  return NextResponse.json(withSyntheticSale(negocio), { status: 201 })
}
