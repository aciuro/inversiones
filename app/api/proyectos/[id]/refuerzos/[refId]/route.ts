import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; refId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId, refId } = await params
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!member) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { paid } = await req.json()
  const refuerzo = await prisma.reinforcement.update({
    where: { id: refId },
    data: { paidAt: paid ? new Date() : null },
  })

  return NextResponse.json(refuerzo)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; refId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId, refId } = await params
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!member || member.role !== "owner") return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  await prisma.reinforcement.delete({ where: { id: refId } })
  return NextResponse.json({ ok: true })
}
