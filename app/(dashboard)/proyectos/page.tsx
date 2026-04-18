import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"

export default async function ProyectosPage() {
  const session = await auth()
  const userId = session?.user?.id ?? ""
  const proyectos = await prisma.project.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      installments: true,
      reinforcements: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mis Proyectos</h1>
        <Link href="/proyectos/nuevo" className={buttonVariants()}>+ Nuevo proyecto</Link>
      </div>

      {proyectos.length === 0 ? (
        <p className="text-gray-500 text-center py-16">No tenés proyectos todavía.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {proyectos.map((p) => {
            const totalInvertido =
              p.entryPrice +
              p.installments.filter((c) => c.paidAt).reduce((s, c) => s + c.amount, 0) +
              p.reinforcements.filter((r) => r.paidAt).reduce((s, r) => s + r.amount, 0)
            const ganancia = p.currentValue - totalInvertido
            const gananciaP = totalInvertido > 0 ? (ganancia / totalInvertido) * 100 : 0
            const cuotasPagadas = p.installments.filter((c) => c.paidAt).length

            return (
              <Link key={p.id} href={`/proyectos/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{p.name}</CardTitle>
                      <Badge variant={ganancia >= 0 ? "default" : "destructive"}>
                        {gananciaP >= 0 ? "+" : ""}
                        {gananciaP.toFixed(1)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Total invertido</span>
                      <span className="font-medium">USD {totalInvertido.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Valor actual</span>
                      <span className="font-medium">USD {p.currentValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Cuotas pagadas</span>
                      <span className="font-medium">
                        {cuotasPagadas}/{p.installments.length}
                      </span>
                    </div>
                    <div className="flex gap-1 pt-1 flex-wrap">
                      {p.members.map((m) => (
                        <Badge key={m.userId} variant="outline" className="text-xs">
                          {m.user.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
