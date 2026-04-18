import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId } = await params
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!member || member.role !== "owner") return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { cuotas } = await req.json()

  await prisma.installment.createMany({
    data: cuotas.map((c: { number: number; amount: number; dueDate: string }) => ({
      projectId,
      number: c.number,
      amount: c.amount,
      dueDate: new Date(c.dueDate),
    })),
  })

  const all = await prisma.installment.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
  })

  return NextResponse.json(all, { status: 201 })
}
