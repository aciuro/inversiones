import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

function num(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

async function assertOwner(negocioId: string, userId: string) {
  const owned = await prisma.negocio.findFirst({ where: { id: negocioId, userId } })
  return Boolean(owned)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; retiroId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: negocioId, retiroId } = await params
  if (!(await assertOwner(negocioId, session.user.id))) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const body = await req.json()
  const montoARS = num(body.montoARS)
  const tipoCambio = num(body.tipoCambio)
  const montoUSD = num(body.montoUSD) ?? (montoARS && tipoCambio ? montoARS / tipoCambio : null)

  if (montoARS === null || tipoCambio === null || montoUSD === null) {
    return NextResponse.json({ error: "Montos inválidos" }, { status: 400 })
  }

  const retiro = await prisma.retiro.update({
    where: { id: retiroId },
    data: {
      fecha: body.fecha ? new Date(body.fecha) : undefined,
      montoARS,
      tipoCambio,
      montoUSD,
      nota: body.nota ?? null,
    },
  })

  return NextResponse.json(retiro)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; retiroId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: negocioId, retiroId } = await params
  if (!(await assertOwner(negocioId, session.user.id))) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.retiro.delete({ where: { id: retiroId } })
  return NextResponse.json({ ok: true })
}
