import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NuevoProyectoForm } from "@/components/nuevo-proyecto-form"

export default async function NuevoProyectoPage() {
  const session = await auth()
  const usuarios = await prisma.user.findMany({
    where: { id: { not: session!.user!.id } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuevo Proyecto</h1>
      <NuevoProyectoForm usuarios={usuarios} />
    </div>
  )
}
