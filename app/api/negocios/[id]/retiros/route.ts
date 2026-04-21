import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: negocioId } = await params
  const owned = await prisma.negocio.findFirst({ where: { id: negocioId, userId: session.user.id } })
  if (!owned) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const { fecha, montoARS, tipoCambio, nota } = await req.json()
  if (!fecha || !montoARS || !tipoCambio) return NextResponse.json({ error: "Faltan campos" }, { status: 400 })

  const montoUSD = montoARS / tipoCambio

  const retiro = await prisma.retiro.create({
    data: { negocioId, fecha: new Date(fecha), montoARS, tipoCambio, montoUSD, nota: nota || null },
  })

  return NextResponse.json(retiro, { status: 201 })
}
