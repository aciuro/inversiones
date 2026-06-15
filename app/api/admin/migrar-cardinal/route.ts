import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const OWNER_EMAIL = "augustociuro@gmail.com"
const CARDINAL_NEW_TOTAL = 70200
const BOLSILLO_AMOUNT = 3000

export async function GET() {
  const session = await auth()
  if (!session?.user?.email || session.user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const [cardinal, bari] = await Promise.all([
    prisma.project.findFirst({
      where: { name: "Cardinal" },
      include: {
        installments: { orderBy: { number: "asc" } },
        reinforcements: { orderBy: { dueDate: "asc" } },
      },
    }),
    prisma.project.findFirst({
      where: { name: "Bari" },
      include: {
        installments: { orderBy: { number: "asc" } },
        reinforcements: { orderBy: { dueDate: "asc" } },
      },
    }),
  ])

  if (!cardinal) return NextResponse.json({ error: "Proyecto Cardinal no encontrado" }, { status: 404 })
  if (!bari) return NextResponse.json({ error: "Proyecto Bari no encontrado" }, { status: 404 })

  const cardinalUnpaid = cardinal.installments.filter(i => !i.paidAt)
  const cardinalPaid = cardinal.installments.filter(i => i.paidAt)
  const bariPaid = bari.installments.filter(i => i.paidAt)
  const bariUnpaid = bari.installments.filter(i => !i.paidAt)
  const bariTotalPaid = bariPaid.reduce((s, i) => s + i.amount, 0)
  const cardinalTotalUnpaid = cardinalUnpaid.reduce((s, i) => s + i.amount, 0)

  return NextResponse.json({
    preview: true,
    message: "GET = preview. Ejecutar POST para aplicar los cambios.",
    cambios: [
      {
        accion: "UPDATE Cardinal.totalPrice",
        de: cardinal.totalPrice,
        a: CARDINAL_NEW_TOTAL,
      },
      {
        accion: "Marcar cuotas de Cardinal como PAGADAS",
        cuotasPagadas: cardinalPaid.length,
        cuotasSinPagar: cardinalUnpaid.length,
        montoAPagar: cardinalTotalUnpaid,
        detalle: cardinalUnpaid.map(i => ({ numero: i.number, monto: i.amount, vencimiento: i.dueDate })),
      },
      {
        accion: "Registrar refuerzo de $3.000 de bolsillo en Cardinal (pagado)",
        monto: BOLSILLO_AMOUNT,
      },
      {
        accion: "ELIMINAR proyecto Bari",
        bariId: bari.id,
        cuotasBari: bari.installments.length,
        cuotasPagadasBari: bariPaid.length,
        montoAportadoBari: bariTotalPaid,
        cuotasSinPagarBari: bariUnpaid.length,
      },
    ],
  })
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.email || session.user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const userId = session.user.id!

  const [cardinal, bari] = await Promise.all([
    prisma.project.findFirst({
      where: { name: "Cardinal" },
      include: { installments: { orderBy: { number: "asc" } } },
    }),
    prisma.project.findFirst({ where: { name: "Bari" } }),
  ])

  if (!cardinal) return NextResponse.json({ error: "Proyecto Cardinal no encontrado" }, { status: 404 })
  if (!bari) return NextResponse.json({ error: "Proyecto Bari no encontrado" }, { status: 404 })

  const unpaidInstallments = cardinal.installments.filter(i => !i.paidAt)
  const now = new Date()

  const results = await prisma.$transaction(async (tx) => {
    // 1. Actualizar totalPrice de Cardinal
    const updatedCardinal = await tx.project.update({
      where: { id: cardinal.id },
      data: { totalPrice: CARDINAL_NEW_TOTAL },
    })

    // 2. Marcar todas las cuotas sin pagar de Cardinal como pagadas
    const paidInstallments = await Promise.all(
      unpaidInstallments.map(i =>
        tx.installment.update({
          where: { id: i.id },
          data: { paidAt: now, paidByUserId: userId },
        })
      )
    )

    // 3. Agregar refuerzo de $3.000 de bolsillo como pagado
    const refuerzo = await tx.reinforcement.create({
      data: {
        projectId: cardinal.id,
        amount: BOLSILLO_AMOUNT,
        amountUSD: BOLSILLO_AMOUNT,
        dueDate: now,
        paidAt: now,
        label: "Aporte personal (traslado Bari)",
      },
    })

    // 4. Eliminar Bari (cascade elimina installments y reinforcements)
    await tx.project.delete({ where: { id: bari.id } })

    return {
      cardinalTotalPrice: updatedCardinal.totalPrice,
      cuotasMarcadasPagadas: paidInstallments.length,
      refuerzoCreado: { monto: refuerzo.amount, label: refuerzo.label },
      bariEliminado: bari.id,
    }
  })

  return NextResponse.json({
    success: true,
    message: "Migración completada exitosamente",
    resultados: results,
  })
}
