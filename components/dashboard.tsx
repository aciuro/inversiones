"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"

const MEMBER_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981"]

interface Project {
  id: string; name: string; currency: string; status: string
  entryPrice: number; currentValue: number
  members: { userId: string; sharePercent: number; user: { id: string; name: string } }[]
  installments: { paidAt: string | null; amount: number; amountUSD: number | null }[]
  reinforcements: { paidAt: string | null; amount: number; amountUSD: number | null }[]
}
interface Note { id: string; content: string; createdAt: string; updatedAt: string }
interface PendingChange {
  id: string; description: string; createdAt: string
  proposer: { id: string; name: string }
  project: { id: string; name: string }
}
interface Invite {
  id: string; projectId: string
  project: { id: string; name: string; members: { user: { id: string; name: string } }[] }
}

function calcTotales(p: Project, userId: string) {
  const isBRL = p.currency === "BRL"
  const myShare = p.members.find(m => m.userId === userId)?.sharePercent ?? 100
  const cuotasPagadas = p.installments.filter(c => c.paidAt)
  const refPagados = p.reinforcements.filter(r => r.paidAt)
  const totalCuotas = cuotasPagadas.reduce((s, c) => s + (isBRL ? (c.amountUSD ?? 0) : c.amount), 0)
  const totalRef = refPagados.reduce((s, r) => s + (isBRL ? (r.amountUSD ?? 0) : r.amount), 0)
  const totalInvertido = p.entryPrice + totalCuotas + totalRef
  const miParte = totalInvertido * myShare / 100
  const balance = p.currentValue - totalInvertido
  const miBalance = balance * myShare / 100
  return { totalInvertido, miParte, balance, miBalance, myShare }
}

export function Dashboard({ proyectos, notas: initialNotas, cambiosPendientes, invitesPendientes, userId, userName }: {
  proyectos: Project[]
  notas: Note[]
  cambiosPendientes: PendingChange[]
  invitesPendientes: Invite[]
  userId: string
  userName: string
}) {
  const router = useRouter()
  const [notas, setNotas] = useState(initialNotas)
  const [nuevaNota, setNuevaNota] = useState("")
  const [invites, setInvites] = useState(invitesPendientes)
  const [cambios, setCambios] = useState(cambiosPendientes)

  const activos = proyectos.filter(p => p.status === "active" || p.status === "pending_approval")
  const vendidos = proyectos.filter(p => p.status === "sold")

  // Totales globales (mi parte)
  let totalMiParte = 0, totalMiBalance = 0
  for (const p of activos) {
    const t = calcTotales(p, userId)
    totalMiParte += t.miParte
    totalMiBalance += t.miBalance
  }

  async function agregarNota() {
    if (!nuevaNota.trim()) return
    const res = await fetch("/api/notas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: nuevaNota.trim() }),
    })
    if (!res.ok) return
    const nota = await res.json()
    setNotas(prev => [nota, ...prev])
    setNuevaNota("")
  }

  async function eliminarNota(id: string) {
    await fetch(`/api/notas/${id}`, { method: "DELETE" })
    setNotas(prev => prev.filter(n => n.id !== id))
  }

  async function aceptarInvite(id: string) {
    await fetch(`/api/invites/${id}`, { method: "POST" })
    setInvites(prev => prev.filter(i => i.id !== id))
    toast.success("Te uniste al proyecto")
    router.refresh()
  }

  async function aprobarCambio(changeId: string, projectId: string) {
    const res = await fetch(`/api/proyectos/${projectId}/cambios/${changeId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    if (!res.ok) { toast.error("Error al aprobar"); return }
    const data = await res.json()
    if (data.status === "applied") toast.success("Cambio aplicado")
    else toast.success("Aprobación registrada")
    setCambios(prev => prev.filter(c => c.id !== changeId))
  }

  const firstName = userName.split(" ")[0]
  const pendingCount = invites.length + cambios.length

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Toaster />

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0 }}>Proyectos</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Hola, {firstName} — tu resumen de inversiones</p>
        </div>
        <Link href="/proyectos/nuevo" style={{ textDecoration: "none" }}>
          <Button>+ Agregar proyecto</Button>
        </Link>
      </div>

      {/* ── Resumen personal ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
        {[
          { label: "Lo que invertí", value: `USD ${Math.round(totalMiParte).toLocaleString("es-AR")}`, color: "#6366f1" },
          { label: "Balance", value: `${totalMiBalance >= 0 ? "+" : ""}USD ${Math.round(totalMiBalance).toLocaleString("es-AR")}`, color: totalMiBalance >= 0 ? "#10b981" : "#ef4444" },
          { label: "En curso", value: String(activos.length), color: "#06b6d4" },
          { label: "Finalizados", value: String(vendidos.length), color: "#f59e0b" },
        ].map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
            <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: c.color, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Aprobaciones pendientes ── */}
      {pendingCount > 0 && (
        <div style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 20, padding: 20 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "#78350f", margin: "0 0 12px" }}>
            ⏳ Pendiente de tu aprobación ({pendingCount})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invites.map(inv => (
              <div key={inv.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#0f172a" }}>Invitación: {inv.project.name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
                    Socios: {inv.project.members.map(m => m.user.name.split(" ")[0]).join(", ")}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button size="sm" style={{ background: "#16a34a", fontSize: 12 }} onClick={() => aceptarInvite(inv.id)}>Unirme</Button>
                  <Link href={`/proyectos/${inv.project.id}`}>
                    <Button size="sm" variant="outline" style={{ fontSize: 12 }}>Ver</Button>
                  </Link>
                </div>
              </div>
            ))}
            {cambios.map(c => (
              <div key={c.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{c.description}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
                    {c.project.name} · propuesto por {c.proposer.name.split(" ")[0]}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button size="sm" style={{ background: "#16a34a", fontSize: 12 }} onClick={() => aprobarCambio(c.id, c.project.id)}>Aprobar</Button>
                  <Link href={`/proyectos/${c.project.id}`}>
                    <Button size="sm" variant="outline" style={{ fontSize: 12 }}>Ver</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Proyectos activos ── */}
      <div>
        <p style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", margin: "0 0 12px" }}>En curso</p>
        {activos.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>No tenés proyectos activos. <Link href="/proyectos/nuevo" style={{ color: "#6366f1" }}>Agregá uno</Link>.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activos.map(p => {
              const { miParte, miBalance, myShare } = calcTotales(p, userId)
              const isPending = p.status === "pending_approval"
              const myMemberIdx = p.members.findIndex(m => m.userId === userId)
              const myColor = MEMBER_COLORS[myMemberIdx % MEMBER_COLORS.length]
              return (
                <Link key={p.id} href={`/proyectos/${p.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "#fff", borderRadius: 16,
                    border: `1px solid ${isPending ? "#fde047" : "#e2e8f0"}`,
                    padding: "14px 18px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: myColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                        {p.name[0]}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{p.name}</span>
                          {isPending && <span style={{ fontSize: 10, background: "#fef9c3", color: "#92400e", padding: "1px 7px", borderRadius: 100, fontWeight: 700 }}>PENDIENTE</span>}
                          {p.currency === "BRL" && <span style={{ fontSize: 10, background: "#eff6ff", color: "#1d4ed8", padding: "1px 7px", borderRadius: 100, fontWeight: 600 }}>BRL</span>}
                        </div>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                          {myShare < 100 ? `Mi parte: ${myShare}% · ` : ""}
                          {p.members.map(m => m.user.name.split(" ")[0]).join(" + ")}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 2px", textTransform: "uppercase" }}>Mi aporte</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: myColor, margin: 0 }}>USD {Math.round(miParte).toLocaleString("es-AR")}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 2px", textTransform: "uppercase" }}>Balance</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: miBalance >= 0 ? "#10b981" : "#ef4444", margin: 0 }}>
                          {miBalance >= 0 ? "+" : ""}USD {Math.round(miBalance).toLocaleString("es-AR")}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Proyectos finalizados ── */}
      {vendidos.length > 0 && (
        <div>
          <p style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", margin: "0 0 12px" }}>Finalizados</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vendidos.map(p => {
              const { miParte, miBalance, myShare } = calcTotales(p, userId)
              const myMemberIdx = p.members.findIndex(m => m.userId === userId)
              const myColor = MEMBER_COLORS[myMemberIdx % MEMBER_COLORS.length]
              return (
                <Link key={p.id} href={`/proyectos/${p.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "#f8fafc", borderRadius: 16,
                    border: "1px solid #86efac",
                    padding: "14px 18px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", color: "#15803d", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                        {p.name[0]}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "#374151" }}>{p.name}</span>
                          <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "1px 7px", borderRadius: 100, fontWeight: 700 }}>VENDIDO</span>
                        </div>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                          {myShare < 100 ? `Mi parte: ${myShare}% · ` : ""}
                          {p.members.map(m => m.user.name.split(" ")[0]).join(" + ")}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 2px", textTransform: "uppercase" }}>Mi aporte</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: myColor, margin: 0 }}>USD {Math.round(miParte).toLocaleString("es-AR")}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 2px", textTransform: "uppercase" }}>Balance</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: miBalance >= 0 ? "#10b981" : "#ef4444", margin: 0 }}>
                          {miBalance >= 0 ? "+" : ""}USD {Math.round(miBalance).toLocaleString("es-AR")}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Notas ── */}
      <div>
        <p style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", margin: "0 0 12px" }}>Mis notas</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <textarea
            value={nuevaNota}
            onChange={e => setNuevaNota(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); agregarNota() } }}
            placeholder="Escribí una nota… (Enter para guardar)"
            rows={2}
            style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none" }}
          />
          <Button onClick={agregarNota} disabled={!nuevaNota.trim()} style={{ alignSelf: "flex-end" }}>
            Guardar
          </Button>
        </div>
        {notas.length === 0 ? (
          <p style={{ fontSize: 13, color: "#94a3b8" }}>Sin notas todavía.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notas.map(n => (
              <div key={n.id} style={{ background: "#fefce8", border: "1px solid #fef08a", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 8 }}>
                <p style={{ fontSize: 13, color: "#0f172a", margin: 0, whiteSpace: "pre-wrap", flex: 1 }}>{n.content}</p>
                <button onClick={() => eliminarNota(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, flexShrink: 0, padding: "0 4px" }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
