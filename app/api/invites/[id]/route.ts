import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params

  const invite = await prisma.projectInvite.update({
    where: { id, userId: session.user.id },
    data: { status: "accepted" },
  })

  // Check if all invites for this project are accepted
  const pending = await prisma.projectInvite.count({
    where: { projectId: invite.projectId, status: "pending" },
  })

  if (pending === 0) {
    await prisma.project.update({
      where: { id: invite.projectId },
      data: { status: "active" },
    })
  }

  return NextResponse.json({ ok: true })
}
