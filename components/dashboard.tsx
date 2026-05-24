"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { LiquidezControl } from "@/components/liquidez-control"

const MEMBER_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981"]

interface Project {
  id: string; name: string; currency: string; status: string
  entryPrice: number; currentValue: number; soldPrice?: number | null
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
interface Negocio {
  id: string
  nombre: string
  inversionUSD: number | null
  porcentaje: number
  status?: string
  salePriceUSD?: number | null
  saleDownPaymentUSD?: number | null
  saleInstallmentUSD?: number | null
  saleInstallmentsCount?: number | null
  saleInstallmentsPaid?: number[]
  saleInstallmentPayments?: Record<string, { amountUSD?: number | null }>
  retiros: { montoUSD: number }[]
}

function usd(n: number, decimals = 0) {
  return `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`
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
  const valorProyecto = p.status === "sold" ? (p.soldPrice ?? p.currentValue) : p.currentValue
  const miValorActivo = valorProyecto * myShare / 100
  const balance = valorProyecto - totalInvertido
  const miBalance = balance * myShare / 100
  return { totalInvertido, miParte, valorProyecto, miValorActivo, balance, miBalance, myShare }
}

function paidLocalInstallments(n: Negocio) {
  const paid = n.saleInstallmentsPaid ?? []
  const payments = n.saleInstallmentPayments ?? {}
  const defaultInstallment = n.saleInstallmentUSD ?? 0
  return paid.reduce((sum, cuota) => {
    const saved = payments[String(cuota)]?.amountUSD
    return sum + (typeof saved === "number" ? saved : defaultInstallment)
  }, 0)
}

function localSaleCollectedMyPart(n: Negocio) {
  if (n.status !== "sold" && !n.salePriceUSD) return 0
  const collected100 = (n.saleDownPaymentUSD ?? 0) + paidLocalInstallments(n)
  return collected100 * (n.porcentaje / 100)
}

function localSalePendingMyPart(n: Negocio) {
  if (n.status !== "sold" && !n.salePriceUSD) return 0
  const sale100 = n.salePriceUSD ?? 0
  const collected100 = (n.saleDownPaymentUSD ?? 0) + paidLocalInstallments(n)
  return Math.max(0, sale100 - collected100) * (n.porcentaje / 100)
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
  const [, setCambios] = useState(cambiosPendientes)
  const [negocios, setNegocios] = useState<Negocio[]>([])

  useEffect(() => {
    fetch("/api/negocios")
      .then(r => r.json())
      .then((data: Negocio[]) => setNegocios(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const activos = proyectos.filter(p => p.status === "active" || p.status === "pending_approval")
  const vendidos = proyectos.filter(p => p.status === "sold")
  const negociosActivos = negocios.filter(n => n.status !== "sold")
  const negociosVendidos = negocios.filter(n => n.status === "sold")

  let valorActivosProyectos = 0
  let balanceProyectos = 0
  for (const p of activos) {
    const t = calcTotales(p, userId)
    valorActivosProyectos += t.miValorActivo
    balanceProyectos += t.miBalance
  }

  const valorLocalesActivos = negociosActivos.reduce((s, n) => s + (n.inversionUSD ?? 0), 0)
  const activosTotales = valorActivosProyectos + valorLocalesActivos

  const liquidezBase = negociosVendidos.reduce((s, n) => s + localSaleCollectedMyPart(n), 0)
  const liquidezACobrar = negociosVendidos.reduce((s, n) => s + localSalePendingMyPart(n), 0)
  const retirosLocales = negocios.reduce((s, n) => s + n.retiros.reduce((sr, r) => sr + r.montoUSD, 0), 0)

  const totalPatrimonial = activosTotales + liquidezBase + liquidezACobrar
  const firstName = userName.split(" ")[0]

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Toaster />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0 }}>Mis inversiones</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Hola, {firstName} — tablero patrimonial</p>
        </div>
        <Link href="/proyectos/nuevo" style={{ textDecoration: "none" }}>
          <Button>+ Agregar proyecto</Button>
        </Link>
      </div>

      <div style={{ background: "#0f172a", borderRadius: 20, padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(165px,1fr))", gap: 16 }}>
        {[
          { label: "Patrimonio estimado", value: usd(totalPatrimonial), sub: "Activos + liquidez base + cuentas a cobrar", color: "#a5f3fc" },
          { label: "Activos", value: usd(activosTotales), sub: "Proyectos en curso + locales activos", color: "#818cf8" },
          { label: "Liquidez base", value: usd(liquidezBase), sub: "Cobrado por ventas antes de movimientos", color: "#34d399" },
          { label: "Liquidez a cobrar", value: usd(liquidezACobrar), sub: "Cuotas futuras de ventas", color: "#fbbf24" },
          { label: "Retiros locales", value: usd(retirosLocales), sub: "Informativo, no suma al patrimonio", color: "#fb923c" },
        ].map(c => (
          <div key={c.label}>
            <p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: c.color, margin: 0 }}>{c.value}</p>
            <p style={{ fontSize: 11, color: "#64748b", margin: "3px 0 0" }}>{c.sub}</p>
          </div>
        ))}
      </div>

      <LiquidezControl liquidezBase={liquidezBase} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 12 }}>
        {[
          { label: "Valor activos proyectos", value: usd(valorActivosProyectos), color: "#6366f1" },
          { label: "Valor locales activos", value: usd(valorLocalesActivos), color: "#8b5cf6" },
          { label: "Balance proyectos", value: `${balanceProyectos >= 0 ? "+" : ""}${usd(balanceProyectos)}`, color: balanceProyectos >= 0 ? "#10b981" : "#ef4444" },
          { label: "Retiros acumulados", value: usd(retirosLocales), color: "#64748b" },
        ].map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
            <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: c.color, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <div style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 20, padding: 20 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "#78350f", margin: "0 0 12px" }}>Invitaciones pendientes ({invites.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invites.map(inv => (
              <div key={inv.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#0f172a" }}>Invitación: {inv.project.name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>Socios: {inv.project.members.map(m => m.user.name.split(" ")[0]).join(", ")}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button size="sm" style={{ background: "#16a34a", fontSize: 12 }} onClick={() => aceptarInvite(inv.id)}>Unirme</Button>
                  <Link href={`/proyectos/${inv.project.id}`}><Button size="sm" variant="outline" style={{ fontSize: 12 }}>Ver</Button></Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", margin: "0 0 12px" }}>En curso</p>
        {activos.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>No tenés proyectos activos. <Link href="/proyectos/nuevo" style={{ color: "#6366f1" }}>Agregá uno</Link>.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activos.map(p => {
              const { miParte, miBalance, myShare } = calcTotales(p, userId)
              const myMemberIdx = p.members.findIndex(m => m.userId === userId)
              const myColor = MEMBER_COLORS[Math.max(0, myMemberIdx) % MEMBER_COLORS.length]
              return (
                <Link key={p.id} href={`/proyectos/${p.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: myColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{p.name[0]}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{p.name}</span>
                          {p.currency === "BRL" && <span style={{ fontSize: 10, background: "#eff6ff", color: "#1d4ed8", padding: "1px 7px", borderRadius: 100, fontWeight: 600 }}>BRL</span>}
                        </div>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>{myShare < 100 ? `Mi parte: ${myShare}% · ` : ""}{p.members.map(m => m.user.name.split(" ")[0]).join(" + ")}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}><p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 2px", textTransform: "uppercase" }}>Mi aporte</p><p style={{ fontSize: 14, fontWeight: 700, color: myColor, margin: 0 }}>USD {Math.round(miParte).toLocaleString("es-AR")}</p></div>
                      <div style={{ textAlign: "right" }}><p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 2px", textTransform: "uppercase" }}>Balance</p><p style={{ fontSize: 14, fontWeight: 700, color: miBalance >= 0 ? "#10b981" : "#ef4444", margin: 0 }}>{miBalance >= 0 ? "+" : ""}USD {Math.round(miBalance).toLocaleString("es-AR")}</p></div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {vendidos.length > 0 && (
        <div>
          <p style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", margin: "0 0 12px" }}>Finalizados</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vendidos.map(p => {
              const { miParte, miBalance, myShare } = calcTotales(p, userId)
              const myMemberIdx = p.members.findIndex(m => m.userId === userId)
              const myColor = MEMBER_COLORS[Math.max(0, myMemberIdx) % MEMBER_COLORS.length]
              return (
                <Link key={p.id} href={`/proyectos/${p.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: "#f8fafc", borderRadius: 16, border: "1px solid #86efac", padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", color: "#15803d", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{p.name[0]}</div>
                      <div style={{ minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontWeight: 700, fontSize: 14, color: "#374151" }}>{p.name}</span><span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "1px 7px", borderRadius: 100, fontWeight: 700 }}>VENDIDO</span></div><p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>{myShare < 100 ? `Mi parte: ${myShare}% · ` : ""}{p.members.map(m => m.user.name.split(" ")[0]).join(" + ")}</p></div>
                    </div>
                    <div style={{ display: "flex", gap: 24, flexShrink: 0 }}><div style={{ textAlign: "right" }}><p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 2px", textTransform: "uppercase" }}>Mi aporte</p><p style={{ fontSize: 14, fontWeight: 700, color: myColor, margin: 0 }}>USD {Math.round(miParte).toLocaleString("es-AR")}</p></div><div style={{ textAlign: "right" }}><p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 2px", textTransform: "uppercase" }}>Balance</p><p style={{ fontSize: 14, fontWeight: 700, color: miBalance >= 0 ? "#10b981" : "#ef4444", margin: 0 }}>{miBalance >= 0 ? "+" : ""}USD {Math.round(miBalance).toLocaleString("es-AR")}</p></div></div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {retirosLocales > 0 && (
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", padding: 18 }}>
          <p style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", margin: "0 0 6px" }}>Retiros de locales</p>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Retiros históricos acumulados: <strong>{usd(retirosLocales)}</strong>. Se muestran aparte para no duplicarlos en el patrimonio.</p>
        </div>
      )}

      <div>
        <p style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", margin: "0 0 12px" }}>Mis notas</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <textarea value={nuevaNota} onChange={e => setNuevaNota(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); agregarNota() } }} placeholder="Escribí una nota… (Enter para guardar)" rows={2} style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none" }} />
          <Button onClick={agregarNota} disabled={!nuevaNota.trim()} style={{ alignSelf: "flex-end" }}>Guardar</Button>
        </div>
        {notas.length === 0 ? <p style={{ fontSize: 13, color: "#94a3b8" }}>Sin notas todavía.</p> : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{notas.map(n => <div key={n.id} style={{ background: "#fefce8", border: "1px solid #fef08a", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 8 }}><p style={{ fontSize: 13, color: "#0f172a", margin: 0, whiteSpace: "pre-wrap", flex: 1 }}>{n.content}</p><button onClick={() => eliminarNota(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, flexShrink: 0, padding: "0 4px" }}>✕</button></div>)}</div>}
      </div>
    </div>
  )
}
