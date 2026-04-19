import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { projectId, userId } = await req.json()
  const invite = await prisma.projectInvite.create({
    data: { projectId, userId },
  })
  return NextResponse.json(invite)
}
