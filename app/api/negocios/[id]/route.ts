import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function getOwned(id: string, userId: string) {
  return prisma.negocio.findFirst({ where: { id, userId } })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  if (!await getOwned(id, session.user.id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const { nombre, inversionUSD, porcentaje } = await req.json()
  const negocio = await prisma.negocio.update({
    where: { id },
    data: { nombre, inversionUSD: inversionUSD ?? null, porcentaje },
    include: { retiros: { orderBy: { fecha: "desc" } } },
  })

  return NextResponse.json(negocio)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  if (!await getOwned(id, session.user.id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.negocio.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
