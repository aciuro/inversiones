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

  const { name, description, entryPrice, currentValue, memberIds } = await req.json()

  if (!name || entryPrice == null || currentValue == null) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  const proyecto = await prisma.project.create({
    data: {
      name,
      description,
      entryPrice,
      currentValue,
      members: {
        create: [
          { userId: session.user!.id!, role: "owner" },
          ...(memberIds ?? []).filter((id: string) => id !== session.user!.id).map((id: string) => ({ userId: id, role: "member" })),
        ],
      },
    },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  })

  return NextResponse.json(proyecto, { status: 201 })
}
