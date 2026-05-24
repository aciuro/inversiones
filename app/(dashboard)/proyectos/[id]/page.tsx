import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ProyectoDetalle } from "@/components/proyecto-detalle"
import { ProyectoEditorManual } from "@/components/proyecto-editor-manual"

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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-bold text-blue-900">Editor manual activo</p>
        <p className="text-xs text-blue-700">Abajo podés editar cuotas y refuerzos sin usar la IA.</p>
      </div>
      <ProyectoEditorManual proyecto={serialized} />
      <ProyectoDetalle proyecto={serialized} isOwner={member.role === "owner"} userId={userId} />
    </div>
  )
}
