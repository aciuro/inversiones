import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const negocios = await prisma.negocio.findMany({
    where: { userId: session.user.id },
    include: { retiros: { orderBy: { fecha: "desc" } } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(negocios)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { nombre, inversionUSD, porcentaje } = await req.json()
  if (!nombre || porcentaje == null) return NextResponse.json({ error: "Faltan campos" }, { status: 400 })

  const negocio = await prisma.negocio.create({
    data: { nombre, inversionUSD: inversionUSD ?? null, porcentaje, userId: session.user.id },
    include: { retiros: true },
  })

  return NextResponse.json(negocio, { status: 201 })
}
