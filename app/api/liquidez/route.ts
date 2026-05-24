import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const PREFIX = "LIQUIDEZ_JSON:"

function parseMovement(note: any) {
  if (typeof note.content !== "string" || !note.content.startsWith(PREFIX)) return null
  try {
    return { id: note.id, ...JSON.parse(note.content.replace(PREFIX, "")), createdAt: note.createdAt }
  } catch {
    return null
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const notes = await prisma.note.findMany({
    where: { userId: session.user.id, projectId: null },
    orderBy: { createdAt: "desc" },
  })

  const movements = notes.map(parseMovement).filter(Boolean)
  return NextResponse.json(movements)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const amountUSD = Number(body.amountUSD)
  if (!Number.isFinite(amountUSD) || amountUSD <= 0) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 })
  }

  const type = String(body.type || "expense")
  if (!["income", "expense", "reinvestment", "adjustment"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
  }

  const payload = {
    type,
    amountUSD,
    date: body.date || new Date().toISOString().slice(0, 10),
    note: body.note ? String(body.note) : null,
  }

  const record = await prisma.note.create({
    data: {
      userId: session.user.id,
      projectId: null,
      content: PREFIX + JSON.stringify(payload),
    },
  })

  return NextResponse.json({ id: record.id, ...payload, createdAt: record.createdAt }, { status: 201 })
}
