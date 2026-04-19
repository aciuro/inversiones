import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; cuotaId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId, cuotaId } = await params
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!member) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { paid, amountUSD, paidByUserId } = await req.json()
  const cuota = await prisma.installment.update({
    where: { id: cuotaId },
    data: {
      paidAt: paid ? new Date() : null,
      amountUSD: paid ? (amountUSD ?? null) : null,
      paidByUserId: paid ? (paidByUserId ?? null) : null,
    },
  })

  return NextResponse.json(cuota)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; cuotaId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId, cuotaId } = await params
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!member || member.role !== "owner") return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  await prisma.installment.delete({ where: { id: cuotaId } })
  return NextResponse.json({ ok: true })
}
