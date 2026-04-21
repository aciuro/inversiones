import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; retiroId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: negocioId, retiroId } = await params
  const owned = await prisma.negocio.findFirst({ where: { id: negocioId, userId: session.user.id } })
  if (!owned) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.retiro.delete({ where: { id: retiroId } })
  return NextResponse.json({ ok: true })
}
