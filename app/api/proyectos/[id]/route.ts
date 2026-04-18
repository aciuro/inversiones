import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function getMember(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const member = await getMember(id, session.user.id)
  if (!member) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const proyecto = await prisma.project.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      installments: { orderBy: { number: "asc" } },
      reinforcements: { orderBy: { dueDate: "asc" } },
      files: { orderBy: { createdAt: "desc" } },
    },
  })

  return NextResponse.json(proyecto)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const member = await getMember(id, session.user.id)
  if (!member || member.role !== "owner") return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const data = await req.json()
  const proyecto = await prisma.project.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      entryPrice: data.entryPrice,
      currentValue: data.currentValue,
    },
  })

  return NextResponse.json(proyecto)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const member = await getMember(id, session.user.id)
  if (!member || member.role !== "owner") return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  await prisma.project.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
