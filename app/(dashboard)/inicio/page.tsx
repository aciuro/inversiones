import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Dashboard } from "@/components/dashboard"

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const [proyectos, notas, cambiosPendientes, invitesPendientes] = await Promise.all([
    prisma.project.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, name: true } } } },
        installments: true,
        reinforcements: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.note.findMany({
      where: { userId, projectId: null },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.pendingChange.findMany({
      where: {
        status: "pending",
        project: { members: { some: { userId } } },
        proposedBy: { not: userId },
        approvals: { none: { userId } },
      },
      include: {
        proposer: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.projectInvite.findMany({
      where: { userId, status: "pending" },
      include: {
        project: {
          include: {
            members: { include: { user: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
  ])

  const serialized = JSON.parse(JSON.stringify({
    proyectos, notas, cambiosPendientes, invitesPendientes,
  }))

  return <Dashboard {...serialized} userId={userId} userName={session!.user!.name!} />
}
