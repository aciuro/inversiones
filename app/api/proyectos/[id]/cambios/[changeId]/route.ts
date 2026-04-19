import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { applyChange } from "../route"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; changeId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId, changeId } = await params

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!member) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const change = await prisma.pendingChange.findUnique({
    where: { id: changeId },
    include: { approvals: true },
  })
  if (!change || change.projectId !== projectId) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (change.status !== "pending") return NextResponse.json({ error: "Ya aplicado" }, { status: 400 })

  // Registrar aprobación (upsert por si ya aprobó)
  await prisma.changeApproval.upsert({
    where: { pendingChangeId_userId: { pendingChangeId: changeId, userId: session.user.id } },
    update: {},
    create: { pendingChangeId: changeId, userId: session.user.id },
  })

  // Verificar si todos los miembros aprobaron
  const allMembers = await prisma.projectMember.findMany({ where: { projectId } })
  const approvals = await prisma.changeApproval.findMany({ where: { pendingChangeId: changeId } })
  const allApproved = allMembers.every(m => approvals.some(a => a.userId === m.userId))

  if (allApproved) {
    await applyChange(change.type, JSON.parse(change.payload), projectId)
    await prisma.pendingChange.update({ where: { id: changeId }, data: { status: "applied" } })
    return NextResponse.json({ status: "applied" })
  }

  // Devolver estado actualizado
  const updated = await prisma.pendingChange.findUnique({
    where: { id: changeId },
    include: {
      proposer: { select: { id: true, name: true } },
      approvals: { include: { user: { select: { id: true, name: true } } } },
    },
  })
  return NextResponse.json(updated)
}
