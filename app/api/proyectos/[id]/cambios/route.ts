import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId } = await params
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!member) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const changes = await prisma.pendingChange.findMany({
    where: { projectId, status: "pending" },
    include: {
      proposer: { select: { id: true, name: true } },
      approvals: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(changes)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId } = await params
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true } } },
  })
  const member = members.find(m => m.userId === session.user!.id)
  if (!member) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  // Solo proyecto → aplicar directo (caller decides, but we provide the pending change)
  const { type, description, payload } = await req.json()

  // Si es proyecto solo, aplicar directo
  if (members.length === 1) {
    await applyChange(type, JSON.parse(payload), projectId)
    return NextResponse.json({ applied: true })
  }

  const change = await prisma.pendingChange.create({
    data: {
      projectId,
      proposedBy: session.user.id,
      type,
      description,
      payload,
      status: "pending",
    },
    include: {
      proposer: { select: { id: true, name: true } },
      approvals: { include: { user: { select: { id: true, name: true } } } },
    },
  })

  return NextResponse.json(change)
}

export async function applyChange(type: string, payload: Record<string, unknown>, projectId: string) {
  if (type === "cuota_unmark") {
    await prisma.installment.update({
      where: { id: payload.cuotaId as string },
      data: { paidAt: null, amountUSD: null, paidByUserId: null },
    })
  } else if (type === "value_update") {
    await prisma.project.update({
      where: { id: projectId },
      data: { currentValue: payload.currentValue as number },
    })
  }
}
