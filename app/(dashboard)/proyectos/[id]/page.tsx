import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ProyectoDetalle } from "@/components/proyecto-detalle"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function ProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) notFound()

  const { id } = await params

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId: id } },
  })
  if (!member) notFound()

  const proyecto = await prisma.project.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      installments: { orderBy: { number: "asc" } },
      reinforcements: { orderBy: { dueDate: "asc" } },
      files: { orderBy: { createdAt: "desc" } },
    },
  })
  if (!proyecto) notFound()

  const serialized = JSON.parse(JSON.stringify(proyecto))

  return <ProyectoDetalle proyecto={serialized} isOwner={member.role === "owner"} userId={userId} />
}
