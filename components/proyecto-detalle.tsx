"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { GraficosProyecto } from "@/components/graficos-proyecto"

interface Member {
  userId: string; role: string; sharePercent: number
  user: { id: string; name: string; email: string }
}
interface Installment {
  id: string; number: number; amount: number; amountUSD: number | null
  dueDate: string; paidAt: string | null; paidByUserId: string | null
}
interface Reinforcement {
  id: string; amount: number; amountUSD: number | null
  dueDate: string; paidAt: string | null; label: string | null
}
interface ProjectFile { id: string; name: string; size: number; mimeType: string; createdAt: string }
interface Project {
  id: string; name: string; description: string | null
  developer: string | null; location: string | null; unitNumber: string | null
  totalPrice: number | null; entryPrice: number; currentValue: number
  currency: string; status: string; soldPrice: number | null; soldAt: string | null
  members: Member[]; installments: Installment[]; reinforcements: Reinforcement[]; files: ProjectFile[]
}

export function ProyectoDetalle({ proyecto: initial, isOwner, userId }: {
  proyecto: Project; isOwner: boolean; userId: string
}) {
  const router = useRouter()
  const [proyecto, setProyecto] = useState(initial)
  const [editingValue, setEditingValue] = useState(false)
  const [newValue, setNewValue] = useState(String(initial.currentValue))
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState<"detalle" | "graficos">("detalle")
  const fileRef = useRef<HTMLInputElement>(null)

  const isBRL = proyecto.currency === "BRL"
  const isSold = proyecto.status === "sold"

  // Totales en USD (o moneda base del proyecto)
  const totalCuotas = proyecto.installments.filter(c => c.paidAt)
    .reduce((s, c) => s + (isBRL ? (c.amountUSD ?? c.amount) : c.amount), 0)
  const totalRefuerzos = proyecto.reinforcements.filter(r => r.paidAt)
    .reduce((s, r) => s + (isBRL ? (r.amountUSD ?? r.amount) : r.amount), 0)
  const totalInvertido = proyecto.entryPrice + totalCuotas + totalRefuerzos
  const ganancia = proyecto.currentValue - totalInvertido
  const gananciaP = totalInvertido > 0 ? (ganancia / totalInvertido) * 100 : 0

  async function toggleCuota(id: string, paid: boolean) {
    const res = await fetch(`/api/proyectos/${proyecto.id}/cuotas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid }),
    })
    if (!res.ok) { toast.error("Error al actualizar cuota"); return }
    const updated = await res.json()
    setProyecto(p => ({ ...p, installments: p.installments.map(c => c.id === id ? { ...c, paidAt: updated.paidAt } : c) }))
  }

  async function toggleRefuerzo(id: string, paid: boolean) {
    const res = await fetch(`/api/proyectos/${proyecto.id}/refuerzos/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid }),
    })
    if (!res.ok) { toast.error("Error al actualizar refuerzo"); return }
    const updated = await res.json()
    setProyecto(p => ({ ...p, reinforcements: p.reinforcements.map(r => r.id === id ? { ...r, paidAt: updated.paidAt } : r) }))
  }

  async function saveCurrentValue() {
    const val = parseFloat(newValue)
    if (isNaN(val)) return
    const res = await fetch(`/api/proyectos/${proyecto.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...proyecto, currentValue: val }),
    })
    if (!res.ok) { toast.error("Error al guardar"); return }
    setProyecto(p => ({ ...p, currentValue: val }))
    setEditingValue(false)
    toast.success("Valor actualizado")
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch(`/api/proyectos/${proyecto.id}/archivos`, { method: "POST", body: fd })
    if (!res.ok) { toast.error("Error al subir archivo"); setUploading(false); return }
    const record = await res.json()
    setProyecto(p => ({ ...p, files: [record, ...p.files] }))
    toast.success("Archivo subido")
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function deleteFile(id: string) {
    if (!confirm("¿Eliminar este archivo?")) return
    const res = await fetch(`/api/proyectos/${proyecto.id}/archivos/${id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Error al eliminar"); return }
    setProyecto(p => ({ ...p, files: p.files.filter(f => f.id !== id) }))
    toast.success("Archivo eliminado")
  }

  function fmtUSD(n: number) { return "USD " + Math.round(n).toLocaleString("es-AR") }
  function fmtAmt(n: number, amountUSD?: number | null) {
    if (isBRL) {
      const base = `R$ ${Math.round(n).toLocaleString("es-AR")}`
      return amountUSD ? `${base} ≈ USD ${Math.round(amountUSD).toLocaleString("es-AR")}` : base
    }
    return "USD " + Math.round(n).toLocaleString("es-AR")
  }
  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }
  function fmtSize(bytes: number) {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const memberById = Object.fromEntries(proyecto.members.map(m => [m.userId, m.user.name]))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Toaster />

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>{proyecto.name}</h1>
            {isSold && (
              <span style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 100, border: "1px solid #86efac" }}>
                ✓ VENDIDO
              </span>
            )}
            {isBRL && (
              <span style={{ background: "#eff6ff", color: "#1d4ed8", fontWeight: 600, fontSize: 12, padding: "3px 10px", borderRadius: 100, border: "1px solid #bfdbfe" }}>
                BRL / USD
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {proyecto.developer && <span style={{ fontSize: 13, color: "#64748b" }}>🏢 {proyecto.developer}</span>}
            {proyecto.location  && <span style={{ fontSize: 13, color: "#64748b" }}>📍 {proyecto.location}</span>}
            {proyecto.unitNumber && <span style={{ fontSize: 13, color: "#64748b" }}>🔑 {proyecto.unitNumber}</span>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {proyecto.members.map(m => (
              <Badge key={m.userId} variant={m.role === "owner" ? "default" : "outline"} style={{ fontSize: 11 }}>
                {m.user.name.split(" ")[0]} {m.sharePercent < 100 ? `${m.sharePercent}%` : ""}
              </Badge>
            ))}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/proyectos")}>← Volver</Button>
      </div>

      {/* ── Stats cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
        {proyecto.totalPrice && (
          <Card>
            <CardContent style={{ paddingTop: 16, paddingBottom: 12 }}>
              <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 4px" }}>Precio total</p>
              <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>
                {isBRL ? `R$ ${Math.round(proyecto.totalPrice).toLocaleString("es-AR")}` : fmtUSD(proyecto.totalPrice)}
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent style={{ paddingTop: 16, paddingBottom: 12 }}>
            <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 4px" }}>Total invertido</p>
            <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>{fmtUSD(totalInvertido)}</p>
          </CardContent>
        </Card>
        {isSold ? (
          <>
            <Card style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #86efac" }}>
              <CardContent style={{ paddingTop: 16, paddingBottom: 12 }}>
                <p style={{ fontSize: 11, color: "#15803d", margin: "0 0 4px" }}>Vendido por</p>
                <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "#15803d" }}>{fmtUSD(proyecto.soldPrice!)}</p>
              </CardContent>
            </Card>
            <Card style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #86efac" }}>
              <CardContent style={{ paddingTop: 16, paddingBottom: 12 }}>
                <p style={{ fontSize: 11, color: "#15803d", margin: "0 0 4px" }}>Ganancia total</p>
                <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "#15803d" }}>
                  {fmtUSD(proyecto.soldPrice! - totalInvertido)} ({gananciaP.toFixed(1)}%)
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent style={{ paddingTop: 16, paddingBottom: 12 }}>
                <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 4px" }}>Valor actual</p>
                {editingValue && isOwner ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <Input type="number" value={newValue} onChange={e => setNewValue(e.target.value)} style={{ height: 28, fontSize: 13 }} autoFocus />
                    <Button size="sm" style={{ height: 28, fontSize: 12 }} onClick={saveCurrentValue}>OK</Button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>{fmtUSD(proyecto.currentValue)}</p>
                    {isOwner && (
                      <button onClick={() => { setEditingValue(true); setNewValue(String(proyecto.currentValue)) }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13 }}>✎</button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card style={{ background: ganancia >= 0 ? "linear-gradient(135deg,#f0fdf4,#dcfce7)" : "linear-gradient(135deg,#fff1f2,#ffe4e6)", border: `1px solid ${ganancia >= 0 ? "#86efac" : "#fecdd3"}` }}>
              <CardContent style={{ paddingTop: 16, paddingBottom: 12 }}>
                <p style={{ fontSize: 11, color: ganancia >= 0 ? "#15803d" : "#be123c", margin: "0 0 4px" }}>Ganancia</p>
                <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: ganancia >= 0 ? "#15803d" : "#be123c" }}>
                  {fmtUSD(ganancia)} ({gananciaP >= 0 ? "+" : ""}{gananciaP.toFixed(1)}%)
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 12, padding: 3, gap: 2 }}>
        {(["detalle", "graficos"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer",
            fontWeight: tab === t ? 600 : 400, fontSize: 13,
            background: tab === t ? "#fff" : "transparent",
            color: tab === t ? "#0f172a" : "#64748b",
            boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            fontFamily: "inherit", transition: "all 0.15s",
          }}>
            {t === "detalle" ? "📋 Detalle" : "📊 Gráficos"}
          </button>
        ))}
      </div>

      {/* ── Tab Gráficos ── */}
      {tab === "graficos" && (
        <GraficosProyecto proyecto={proyecto} />
      )}

      {/* ── Tab Detalle ── */}
      {tab === "detalle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Cuotas */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: 15 }}>
                Cuotas — {proyecto.installments.filter(c => c.paidAt).length}/{proyecto.installments.length} pagadas
                {isBRL && <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b", marginLeft: 8 }}>en BRL, pagadas en USD</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {proyecto.installments.length === 0 ? (
                <p style={{ fontSize: 13, color: "#94a3b8" }}>Sin cuotas cargadas</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8 }}>
                  {proyecto.installments.map(c => (
                    <div key={c.id}
                      style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 12, border: `1px solid ${c.paidAt ? "#86efac" : "#e2e8f0"}`, background: c.paidAt ? "#f0fdf4" : "#fff", cursor: "pointer", transition: "all 0.15s" }}
                      onClick={() => toggleCuota(c.id, !c.paidAt)}
                    >
                      <Checkbox checked={!!c.paidAt} onCheckedChange={v => toggleCuota(c.id, !!v)} onClick={e => e.stopPropagation()} style={{ marginTop: 2 }} />
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 13, margin: 0, color: c.paidAt ? "#15803d" : "#0f172a" }}>#{c.number}</p>
                        <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0" }}>{fmtDate(c.dueDate)}</p>
                        <p style={{ fontSize: 11, margin: 0, color: c.paidAt ? "#15803d" : "#475569" }}>{fmtAmt(c.amount, c.amountUSD)}</p>
                        {c.paidByUserId && (
                          <p style={{ fontSize: 10, color: "#94a3b8", margin: "2px 0 0" }}>↳ {memberById[c.paidByUserId]?.split(" ")[0]}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Refuerzos */}
          {proyecto.reinforcements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle style={{ fontSize: 15 }}>
                  Refuerzos — {proyecto.reinforcements.filter(r => r.paidAt).length}/{proyecto.reinforcements.length} pagados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
                  {proyecto.reinforcements.map(r => (
                    <div key={r.id}
                      style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 14px", borderRadius: 12, border: `1px solid ${r.paidAt ? "#86efac" : "#e2e8f0"}`, background: r.paidAt ? "#f0fdf4" : "#fff", cursor: "pointer", transition: "all 0.15s" }}
                      onClick={() => toggleRefuerzo(r.id, !r.paidAt)}
                    >
                      <Checkbox checked={!!r.paidAt} onCheckedChange={v => toggleRefuerzo(r.id, !!v)} onClick={e => e.stopPropagation()} style={{ marginTop: 2 }} />
                      <div>
                        {r.label && <p style={{ fontWeight: 600, fontSize: 13, margin: "0 0 2px", color: r.paidAt ? "#15803d" : "#0f172a" }}>{r.label}</p>}
                        <p style={{ fontSize: 12, margin: 0, color: r.paidAt ? "#15803d" : "#475569" }}>{fmtAmt(r.amount, r.amountUSD)}</p>
                        <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>{fmtDate(r.dueDate)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Archivos */}
          <Card>
            <CardHeader>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <CardTitle style={{ fontSize: 15 }}>Archivos</CardTitle>
                <div>
                  <input ref={fileRef} type="file" style={{ display: "none" }} onChange={uploadFile} />
                  <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? "Subiendo..." : "+ Subir"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {proyecto.files.length === 0 ? (
                <p style={{ fontSize: 13, color: "#94a3b8" }}>Sin archivos cargados</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {proyecto.files.map(f => (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span>{f.mimeType.startsWith("image/") ? "🖼" : f.mimeType === "application/pdf" ? "📄" : "📎"}</span>
                        <div style={{ minWidth: 0 }}>
                          <a href={`/api/proyectos/${proyecto.id}/archivos/${f.id}`} target="_blank" rel="noopener noreferrer"
                            style={{ fontWeight: 500, color: "#0f172a", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {f.name}
                          </a>
                          <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{fmtSize(f.size)} · {fmtDate(f.createdAt)}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" style={{ color: "#ef4444", flexShrink: 0 }} onClick={() => deleteFile(f.id)}>Eliminar</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
