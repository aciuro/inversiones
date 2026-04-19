import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const proyectos = await prisma.project.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { installments: true, reinforcements: true, files: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(proyectos)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const {
    name, description, developer, location, unitNumber,
    currency, totalPrice, entryPrice, entryPriceBRL, currentValue,
    memberIds, memberShares, status,
  } = await req.json()

  if (!name || entryPrice == null) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  const myId = session.user!.id!
  const otherIds: string[] = (memberIds ?? []).filter((id: string) => id !== myId)
  const myShare = memberShares?.[myId] ?? 100

  const proyecto = await prisma.project.create({
    data: {
      name, description, developer, location, unitNumber,
      currency: currency ?? "USD",
      totalPrice: totalPrice ?? null,
      entryPrice,
      entryPriceBRL: entryPriceBRL ?? null,
      currentValue: currentValue ?? entryPrice,
      status: status ?? "active",
      members: {
        create: [
          { userId: myId, role: "owner", sharePercent: myShare },
          ...otherIds.map((id: string) => ({
            userId: id, role: "member",
            sharePercent: memberShares?.[id] ?? Math.floor(100 / (otherIds.length + 1)),
          })),
        ],
      },
    },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  })

  return NextResponse.json(proyecto, { status: 201 })
}
