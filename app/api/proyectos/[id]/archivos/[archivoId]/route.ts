export const runtime = "nodejs"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { readFile, unlink } from "fs/promises"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; archivoId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId, archivoId } = await params
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!member) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const archivo = await prisma.projectFile.findUnique({ where: { id: archivoId } })
  if (!archivo || archivo.projectId !== projectId) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const buffer = await readFile(archivo.path)
  return new Response(buffer, {
    headers: {
      "Content-Type": archivo.mimeType,
      "Content-Disposition": `inline; filename="${archivo.name}"`,
    },
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; archivoId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId, archivoId } = await params
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!member) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const archivo = await prisma.projectFile.findUnique({ where: { id: archivoId } })
  if (!archivo || archivo.projectId !== projectId) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await unlink(archivo.path).catch(() => {})
  await prisma.projectFile.delete({ where: { id: archivoId } })

  return NextResponse.json({ ok: true })
}
