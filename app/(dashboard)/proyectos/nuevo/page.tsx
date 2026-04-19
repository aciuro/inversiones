import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NuevoProyectoForm } from "@/components/nuevo-proyecto-form"

export default async function NuevoProyectoPage() {
  const session = await auth()
  const userId = session!.user!.id!
  const usuarios = await prisma.user.findMany({
    where: { id: { not: userId } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  })
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Nuevo Proyecto</h1>
      <NuevoProyectoForm usuarios={usuarios} currentUserId={userId} currentUserName={session!.user!.name!} />
    </div>
  )
}
