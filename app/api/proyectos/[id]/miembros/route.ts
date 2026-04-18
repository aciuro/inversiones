import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId } = await params
  const me = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!me || me.role !== "owner") return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { userId } = await req.json()
  const member = await prisma.projectMember.create({
    data: { projectId, userId, role: "member" },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json(member, { status: 201 })
}
