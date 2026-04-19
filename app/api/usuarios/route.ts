import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(users)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { name, email, password } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 400 })

  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, password: hashed },
    select: { id: true, name: true, email: true, createdAt: true },
  })

  return NextResponse.json(user, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await req.json()
  if (id === session.user.id) return NextResponse.json({ error: "No podés eliminarte a vos mismo" }, { status: 400 })

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
