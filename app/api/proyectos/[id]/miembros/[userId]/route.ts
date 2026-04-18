import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId, userId } = await params
  const me = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!me || me.role !== "owner") return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  await prisma.projectMember.delete({
    where: { userId_projectId: { userId, projectId } },
  })

  return NextResponse.json({ ok: true })
}
