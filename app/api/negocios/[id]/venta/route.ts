import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const SALE_PREFIX = "VENTA_LOCAL_JSON:"

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalize(negocio: any) {
  const saleRetiro = negocio.retiros?.find((r: any) => typeof r.nota === "string" && r.nota.startsWith(SALE_PREFIX))
  const retirosVisibles = negocio.retiros?.filter((r: any) => !(typeof r.nota === "string" && r.nota.startsWith(SALE_PREFIX))) ?? []

  if (!saleRetiro) return { ...negocio, retiros: retirosVisibles, status: "active" }

  try {
    const payload = JSON.parse(saleRetiro.nota.replace(SALE_PREFIX, ""))
    return {
      ...negocio,
      retiros: retirosVisibles,
      status: "sold",
      soldAt: payload.soldAt,
      salePriceUSD: payload.salePriceUSD,
      saleDownPaymentUSD: payload.downPaymentUSD,
      saleInstallmentsCount: payload.installmentsCount,
      saleInstallmentUSD: payload.installmentUSD,
      saleFirstInstallmentDate: payload.firstInstallmentDate,
      saleNotes: payload.notes,
      saleInstallmentsPaid: payload.paidInstallments ?? [],
    }
  } catch {
    return { ...negocio, retiros: retirosVisibles, status: "sold" }
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const { id } = await params
    const negocio = await prisma.negocio.findFirst({ where: { id, userId: session.user.id } })
    if (!negocio) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const body = await req.json()
    const salePriceUSD = n(body.salePriceUSD)
    if (!salePriceUSD || salePriceUSD <= 0) {
      return NextResponse.json({ error: "Cargá el valor total de venta en USD" }, { status: 400 })
    }

    const soldAt = body.soldAt ? new Date(body.soldAt) : new Date()
    const payload = {
      soldAt: soldAt.toISOString(),
      salePriceUSD,
      downPaymentUSD: n(body.downPaymentUSD),
      installmentsCount: n(body.installmentsCount),
      installmentUSD: n(body.installmentUSD),
      firstInstallmentDate: body.firstInstallmentDate || null,
      notes: body.notes || null,
      paidInstallments: Array.isArray(body.paidInstallments) ? body.paidInstallments : [],
    }

    await prisma.retiro.deleteMany({ where: { negocioId: id, nota: { startsWith: SALE_PREFIX } } })

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

    const updated = await prisma.negocio.findUnique({ where: { id }, include: { retiros: { orderBy: { fecha: "desc" } } } })
    return NextResponse.json(normalize(updated))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido"
    return NextResponse.json({ error: `No se pudo guardar la venta: ${message}` }, { status: 500 })
  }
}
