import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads")

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: projectId } = await params
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!member) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get("file") as File
  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const dir = path.join(UPLOAD_DIR, projectId)
  await mkdir(dir, { recursive: true })

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const filePath = path.join(dir, safeName)
  await writeFile(filePath, buffer)

  const record = await prisma.projectFile.create({
    data: {
      projectId,
      name: file.name,
      path: filePath,
      size: buffer.length,
      mimeType: file.type || "application/octet-stream",
    },
  })

  return NextResponse.json(record, { status: 201 })
}
