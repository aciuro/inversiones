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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Mis Proyectos</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>{proyectos.length} proyecto{proyectos.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/proyectos/nuevo" className={buttonVariants()}>+ Nuevo proyecto</Link>
      </div>

      {proyectos.length === 0 ? (
        <p style={{ color: "#94a3b8", textAlign: "center", padding: "64px 0" }}>No tenés proyectos todavía.</p>
      ) : (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
          {proyectos.map((p) => {
            const isBRL  = p.currency === "BRL"
            const isSold = p.status === "sold"
            const totalInvertido =
              p.entryPrice +
              p.installments.filter(c => c.paidAt).reduce((s, c) => s + ((isBRL ? (c as any).amountUSD ?? c.amount : c.amount)), 0) +
              p.reinforcements.filter(r => r.paidAt).reduce((s, r) => s + ((isBRL ? (r as any).amountUSD ?? r.amount : r.amount)), 0)
            const ganancia  = p.currentValue - totalInvertido
            const gananciaP = totalInvertido > 0 ? (ganancia / totalInvertido) * 100 : 0
            const cuotasPagadas  = p.installments.filter(c => c.paidAt).length
            const myShare = p.members.find(m => m.userId === userId)
            const sharePercent = (myShare as any)?.sharePercent ?? 100

            return (
              <Link key={p.id} href={`/proyectos/${p.id}`} style={{ textDecoration: "none" }}>
                <Card style={{
                  cursor: "pointer", height: "100%", transition: "box-shadow 0.15s",
                  border: isSold ? "1px solid #86efac" : "1px solid #e2e8f0",
                  background: isSold ? "linear-gradient(135deg,#f0fdf4,#fff)" : "#fff",
                }}>
                  <CardHeader style={{ paddingBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <CardTitle style={{ fontSize: 17, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {p.name}
                          {isSold && <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", fontWeight: 700, padding: "2px 8px", borderRadius: 100, border: "1px solid #86efac" }}>VENDIDO</span>}
                          {isBRL && <span style={{ fontSize: 10, background: "#eff6ff", color: "#1d4ed8", fontWeight: 600, padding: "2px 8px", borderRadius: 100, border: "1px solid #bfdbfe" }}>BRL</span>}
                        </CardTitle>
                        {(p as any).developer && (
                          <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0" }}>
                            {(p as any).developer}{(p as any).location ? ` · ${(p as any).location}` : ""}
                          </p>
                        )}
                        {(p as any).unitNumber && (
                          <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>{(p as any).unitNumber}</p>
                        )}
                      </div>
                      <Badge variant={gananciaP >= 0 ? "default" : "destructive"} style={{ flexShrink: 0, fontSize: 12 }}>
                        {gananciaP >= 0 ? "+" : ""}{gananciaP.toFixed(1)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent style={{ paddingTop: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                        <span>Total invertido</span>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>USD {Math.round(totalInvertido).toLocaleString("es-AR")}</span>
                      </div>
                      {sharePercent < 100 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                          <span>Mi parte ({sharePercent}%)</span>
                          <span style={{ fontWeight: 600, color: "#0f172a" }}>USD {Math.round(totalInvertido * sharePercent / 100).toLocaleString("es-AR")}</span>
                        </div>
                      )}
                      {isSold ? (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#15803d" }}>
                          <span>Balance</span>
                          <span style={{ fontWeight: 700 }}>USD {Math.round(ganancia).toLocaleString("es-AR")}</span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                          <span>Cuotas pagadas</span>
                          <span style={{ fontWeight: 600, color: "#0f172a" }}>{cuotasPagadas}/{p.installments.length}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 4, paddingTop: 4, flexWrap: "wrap" }}>
                        {p.members.map(m => (
                          <Badge key={m.userId} variant="outline" style={{ fontSize: 11 }}>
                            {m.user.name.split(" ")[0]}
                          </Badge>
                        ))}
                      </div>
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
