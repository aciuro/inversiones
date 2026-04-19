import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { content, projectId } = await req.json()
  const note = await prisma.note.create({
    data: { userId: session.user.id, content, projectId: projectId ?? null },
  })
  return NextResponse.json(note)
}
