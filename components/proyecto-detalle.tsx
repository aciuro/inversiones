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

const MEMBER_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981"]

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
  const [payModal, setPayModal] = useState<{ cuotaId: string; number: number } | null>(null)
  const [payRefModal, setPayRefModal] = useState<{ refId: string; label: string } | null>(null)
  const [payUSD, setPayUSD] = useState("")
  const [payBy, setPayBy] = useState("")
  const [payRefUSD, setPayRefUSD] = useState("")

  interface PendingChange {
    id: string; type: string; description: string; status: string; createdAt: string
    proposer: { id: string; name: string }
    approvals: { userId: string; user: { id: string; name: string } }[]
  }
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [loadedChanges, setLoadedChanges] = useState(false)

  const isSolo = proyecto.members.length === 1

  const isBRL  = proyecto.currency === "BRL"
  const isSold = proyecto.status === "sold"

  const totalCuotas = proyecto.installments.filter(c => c.paidAt)
    .reduce((s, c) => s + (isBRL ? (c.amountUSD ?? c.amount) : c.amount), 0)
  const totalRefuerzos = proyecto.reinforcements.filter(r => r.paidAt)
    .reduce((s, r) => s + (isBRL ? (r.amountUSD ?? r.amount) : r.amount), 0)
  const totalInvertido = proyecto.entryPrice + totalCuotas + totalRefuerzos
  const balance  = proyecto.currentValue - totalInvertido
  const balanceP = totalInvertido > 0 ? (balance / totalInvertido) * 100 : 0

  // ── Aporte por socio ─────────────────────────────────────
  const aportes: Record<string, { entrada: number; cuotas: number; refuerzos: number }> = {}
  for (const m of proyecto.members) {
    aportes[m.userId] = { entrada: 0, cuotas: 0, refuerzos: 0 }
  }
  // Entrada — dividida por sharePercent
  for (const m of proyecto.members) {
    aportes[m.userId].entrada = proyecto.entryPrice * (m.sharePercent / 100)
  }
  // Cuotas pagadas — si tiene paidByUserId ese pagó todo, si no se divide
  for (const c of proyecto.installments.filter(x => x.paidAt)) {
    const monto = isBRL ? (c.amountUSD ?? c.amount) : c.amount
    if (c.paidByUserId && aportes[c.paidByUserId] != null) {
      aportes[c.paidByUserId].cuotas += monto
    } else {
      for (const m of proyecto.members) aportes[m.userId].cuotas += monto * (m.sharePercent / 100)
    }
  }
  // Refuerzos pagados
  for (const r of proyecto.reinforcements.filter(x => x.paidAt)) {
    const monto = isBRL ? (r.amountUSD ?? r.amount) : r.amount
    for (const m of proyecto.members) aportes[m.userId].refuerzos += monto * (m.sharePercent / 100)
  }

  function iniciarPago(cuota: Installment) {
    setPayUSD("")
    setPayBy("")
    setPayModal({ cuotaId: cuota.id, number: cuota.number })
  }

  async function confirmarPago() {
    if (!payModal) return
    const res = await fetch(`/api/proyectos/${proyecto.id}/cuotas/${payModal.cuotaId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paid: true,
        amountUSD: payUSD ? parseFloat(payUSD) : null,
        paidByUserId: payBy || null,
      }),
    })
    if (!res.ok) { toast.error("Error al actualizar cuota"); return }
    const updated = await res.json()
    setProyecto(p => ({ ...p, installments: p.installments.map(c => c.id === payModal.cuotaId ? { ...c, paidAt: updated.paidAt, amountUSD: updated.amountUSD, paidByUserId: updated.paidByUserId } : c) }))
    setPayModal(null)
    toast.success("Cuota marcada como pagada")
  }

  async function desmarcarCuota(id: string, number: number) {
    if (isSolo) {
      const res = await fetch(`/api/proyectos/${proyecto.id}/cuotas/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: false }),
      })
      if (!res.ok) { toast.error("Error al actualizar cuota"); return }
      const updated = await res.json()
      setProyecto(p => ({ ...p, installments: p.installments.map(c => c.id === id ? { ...c, paidAt: updated.paidAt, amountUSD: null, paidByUserId: null } : c) }))
    } else {
      await proponerCambio(
        "cuota_unmark",
        `Desmarcar cuota #${number} como no pagada`,
        JSON.stringify({ cuotaId: id })
      )
    }
  }

  async function proponerCambio(type: string, description: string, payload: string) {
    const res = await fetch(`/api/proyectos/${proyecto.id}/cambios`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, description, payload }),
    })
    if (!res.ok) { toast.error("Error al proponer cambio"); return }
    const data = await res.json()
    if (data.applied) {
      toast.success("Cambio aplicado")
      router.refresh()
    } else {
      toast.success("Cambio propuesto — esperando aprobación de los socios")
      setPendingChanges(prev => [data, ...prev])
      if (!loadedChanges) setLoadedChanges(true)
    }
  }

  async function aprobarCambio(changeId: string) {
    const res = await fetch(`/api/proyectos/${proyecto.id}/cambios/${changeId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    if (!res.ok) { toast.error("Error al aprobar"); return }
    const data = await res.json()
    if (data.status === "applied") {
      toast.success("Cambio aprobado y aplicado")
      setPendingChanges(prev => prev.filter(c => c.id !== changeId))
      router.refresh()
    } else {
      setPendingChanges(prev => prev.map(c => c.id === changeId ? data : c))
      toast.success("Aprobación registrada")
    }
  }

  async function cargarCambiosPendientes() {
    if (loadedChanges) return
    const res = await fetch(`/api/proyectos/${proyecto.id}/cambios`)
    if (!res.ok) return
    const data = await res.json()
    setPendingChanges(data)
    setLoadedChanges(true)
  }

  function iniciarPagoRefuerzo(r: Reinforcement) {
    setPayRefUSD("")
    setPayRefModal({ refId: r.id, label: r.label ?? "Refuerzo" })
  }

  async function confirmarPagoRefuerzo() {
    if (!payRefModal) return
    const res = await fetch(`/api/proyectos/${proyecto.id}/refuerzos/${payRefModal.refId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: true, amountUSD: payRefUSD ? parseFloat(payRefUSD) : null }),
    })
    if (!res.ok) { toast.error("Error al actualizar refuerzo"); return }
    const updated = await res.json()
    setProyecto(p => ({ ...p, reinforcements: p.reinforcements.map(r => r.id === payRefModal.refId ? { ...r, paidAt: updated.paidAt, amountUSD: updated.amountUSD } : r) }))
    setPayRefModal(null)
    toast.success("Refuerzo marcado como pagado")
  }

  async function desmarcarRefuerzo(id: string) {
    const res = await fetch(`/api/proyectos/${proyecto.id}/refuerzos/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: false }),
    })
    if (!res.ok) { toast.error("Error al actualizar refuerzo"); return }
    const updated = await res.json()
    setProyecto(p => ({ ...p, reinforcements: p.reinforcements.map(r => r.id === id ? { ...r, paidAt: updated.paidAt, amountUSD: null } : r) }))
  }

  async function saveCurrentValue() {
    const val = parseFloat(newValue)
    if (isNaN(val)) return
    setEditingValue(false)
    if (isSolo) {
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...proyecto, currentValue: val }),
      })
      if (!res.ok) { toast.error("Error al guardar"); return }
      setProyecto(p => ({ ...p, currentValue: val }))
      toast.success("Valor actualizado")
    } else {
      await proponerCambio(
        "value_update",
        `Actualizar valor actual a USD ${Math.round(val).toLocaleString("es-AR")}`,
        JSON.stringify({ currentValue: val })
      )
    }
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
    return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
  }
  function fmtSize(bytes: number) {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }
  function firstName(name: string) { return name.split(" ")[0] }

  const memberById = Object.fromEntries(proyecto.members.map(m => [m.userId, m]))
  const memberColor = Object.fromEntries(proyecto.members.map((m, i) => [m.userId, MEMBER_COLORS[i % MEMBER_COLORS.length]]))

  // Porción de cada socio en un monto dado (para mostrar debajo de cada pago)
  function partesSocios(montoUSD: number, paidByUserId?: string | null) {
    if (proyecto.members.length <= 1) return null
    return proyecto.members.map(m => ({
      name: firstName(m.user.name),
      color: memberColor[m.userId],
      monto: paidByUserId
        ? (m.userId === paidByUserId ? montoUSD : 0)
        : Math.round(montoUSD * m.sharePercent / 100),
      esPagador: paidByUserId === m.userId,
    }))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Toaster />

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>{proyecto.name}</h1>
            {isSold && <span style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 100, border: "1px solid #86efac" }}>✓ VENDIDO</span>}
            {isBRL  && <span style={{ background: "#eff6ff", color: "#1d4ed8", fontWeight: 600, fontSize: 12, padding: "3px 10px", borderRadius: 100, border: "1px solid #bfdbfe" }}>BRL / USD</span>}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            {proyecto.developer  && <span style={{ fontSize: 13, color: "#64748b" }}>🏢 {proyecto.developer}</span>}
            {proyecto.location   && <span style={{ fontSize: 13, color: "#64748b" }}>📍 {proyecto.location}</span>}
            {proyecto.unitNumber && <span style={{ fontSize: 13, color: "#64748b" }}>🔑 {proyecto.unitNumber}</span>}
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
                <p style={{ fontSize: 11, color: "#15803d", margin: "0 0 4px" }}>Balance</p>
                <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "#15803d" }}>
                  {fmtUSD(proyecto.soldPrice! - totalInvertido)} ({balanceP.toFixed(1)}%)
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
                      <button onClick={() => { setEditingValue(true); setNewValue(String(proyecto.currentValue)) }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13 }}>✎</button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card style={{ background: balance >= 0 ? "linear-gradient(135deg,#f0fdf4,#dcfce7)" : "linear-gradient(135deg,#fff1f2,#ffe4e6)", border: `1px solid ${balance >= 0 ? "#86efac" : "#fecdd3"}` }}>
              <CardContent style={{ paddingTop: 16, paddingBottom: 12 }}>
                <p style={{ fontSize: 11, color: balance >= 0 ? "#15803d" : "#be123c", margin: "0 0 4px" }}>Balance</p>
                <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: balance >= 0 ? "#15803d" : "#be123c" }}>
                  {fmtUSD(balance)} ({balanceP >= 0 ? "+" : ""}{balanceP.toFixed(1)}%)
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Socios ── */}
      {proyecto.members.length > 0 && (
        <Card>
          <CardHeader style={{ paddingBottom: 8 }}>
            <CardTitle style={{ fontSize: 15 }}>Socios y aportes</CardTitle>
          </CardHeader>
          <CardContent style={{ paddingTop: 0 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px 8px 0", color: "#64748b", fontWeight: 500, fontSize: 11 }}>Socio</th>
                    <th style={{ textAlign: "right", padding: "8px 8px", color: "#64748b", fontWeight: 500, fontSize: 11 }}>Entrada</th>
                    <th style={{ textAlign: "right", padding: "8px 8px", color: "#64748b", fontWeight: 500, fontSize: 11 }}>Cuotas</th>
                    {Object.values(aportes).some(a => a.refuerzos > 0) && (
                      <th style={{ textAlign: "right", padding: "8px 8px", color: "#64748b", fontWeight: 500, fontSize: 11 }}>Refuerzos</th>
                    )}
                    <th style={{ textAlign: "right", padding: "8px 0 8px 8px", color: "#64748b", fontWeight: 500, fontSize: 11 }}>Total aportado</th>
                  </tr>
                </thead>
                <tbody>
                  {proyecto.members.map((m, i) => {
                    const a = aportes[m.userId]
                    const total = a.entrada + a.cuotas + a.refuerzos
                    const color = MEMBER_COLORS[i % MEMBER_COLORS.length]
                    return (
                      <tr key={m.userId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 12px 10px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                              {m.user.name[0]}
                            </div>
                            <div>
                              <p style={{ margin: 0, fontWeight: 600, color: "#0f172a" }}>{m.user.name.split(" ").slice(0,2).join(" ")}</p>
                              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>{m.sharePercent}% del proyecto</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "right", padding: "10px 8px", color: "#475569" }}>USD {Math.round(a.entrada).toLocaleString("es-AR")}</td>
                        <td style={{ textAlign: "right", padding: "10px 8px", color: "#475569" }}>USD {Math.round(a.cuotas).toLocaleString("es-AR")}</td>
                        {Object.values(aportes).some(x => x.refuerzos > 0) && (
                          <td style={{ textAlign: "right", padding: "10px 8px", color: "#475569" }}>USD {Math.round(a.refuerzos).toLocaleString("es-AR")}</td>
                        )}
                        <td style={{ textAlign: "right", padding: "10px 0 10px 8px" }}>
                          <span style={{ fontWeight: 700, color, fontSize: 14 }}>USD {Math.round(total).toLocaleString("es-AR")}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 12px 6px 0", fontWeight: 700, color: "#0f172a", fontSize: 13 }}>Total</td>
                    <td style={{ textAlign: "right", padding: "10px 8px 6px", fontWeight: 600, color: "#0f172a" }}>USD {Math.round(proyecto.entryPrice).toLocaleString("es-AR")}</td>
                    <td style={{ textAlign: "right", padding: "10px 8px 6px", fontWeight: 600, color: "#0f172a" }}>USD {Math.round(totalCuotas).toLocaleString("es-AR")}</td>
                    {Object.values(aportes).some(x => x.refuerzos > 0) && (
                      <td style={{ textAlign: "right", padding: "10px 8px 6px", fontWeight: 600, color: "#0f172a" }}>USD {Math.round(totalRefuerzos).toLocaleString("es-AR")}</td>
                    )}
                    <td style={{ textAlign: "right", padding: "10px 0 6px 8px", fontWeight: 700, color: "#0f172a", fontSize: 14 }}>USD {Math.round(totalInvertido).toLocaleString("es-AR")}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Cambios pendientes ── */}
      {!isSolo && (
        <div>
          <button
            onClick={cargarCambiosPendientes}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6366f1", fontWeight: 600, padding: "4px 0", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
          >
            {loadedChanges ? null : "↓ "} Cambios pendientes de aprobación
            {pendingChanges.length > 0 && (
              <span style={{ background: "#6366f1", color: "#fff", borderRadius: 100, fontSize: 11, padding: "1px 7px", fontWeight: 700 }}>{pendingChanges.length}</span>
            )}
          </button>

          {loadedChanges && pendingChanges.length === 0 && (
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>Sin cambios pendientes</p>
          )}

          {pendingChanges.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {pendingChanges.map(change => {
                const yaAprobé = change.approvals.some(a => a.userId === userId)
                const aprobadores = proyecto.members.filter(m =>
                  change.approvals.some(a => a.userId === m.userId)
                )
                const pendientesDe = proyecto.members.filter(m =>
                  !change.approvals.some(a => a.userId === m.userId)
                )
                return (
                  <div key={change.id} style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#78350f" }}>{change.description}</p>
                        <p style={{ margin: "3px 0 8px", fontSize: 11, color: "#92400e" }}>
                          Propuesto por {change.proposer.name.split(" ")[0]} · {new Date(change.createdAt).toLocaleDateString("es-AR")}
                        </p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {aprobadores.map((m, i) => (
                            <span key={m.userId} style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 100, border: "1px solid #86efac" }}>
                              ✓ {m.user.name.split(" ")[0]}
                            </span>
                          ))}
                          {pendientesDe.map(m => (
                            <span key={m.userId} style={{ fontSize: 11, background: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: 100, border: "1px solid #e2e8f0" }}>
                              ⏳ {m.user.name.split(" ")[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                      {!yaAprobé && (
                        <Button size="sm" onClick={() => aprobarCambio(change.id)} style={{ flexShrink: 0, background: "#16a34a", fontSize: 12 }}>
                          Aprobar
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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

      {tab === "graficos" && <GraficosProyecto proyecto={proyecto} />}

      {tab === "detalle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── Entrada ── */}
          <Card>
            <CardHeader style={{ paddingBottom: 8 }}>
              <CardTitle style={{ fontSize: 15 }}>Entrada</CardTitle>
            </CardHeader>
            <CardContent style={{ paddingTop: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, border: "1px solid #86efac", background: "#f0fdf4" }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 16, margin: 0, color: "#15803d" }}>{fmtUSD(proyecto.entryPrice)}</p>
                  <p style={{ fontSize: 11, color: "#6ee7b7", margin: "2px 0 0" }}>Pagada ✓</p>
                </div>
                {proyecto.members.length > 1 && (
                  <div style={{ display: "flex", gap: 10 }}>
                    {proyecto.members.map((m, i) => (
                      <div key={m.userId} style={{ textAlign: "center" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: MEMBER_COLORS[i % MEMBER_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, margin: "0 auto 3px" }}>
                          {m.user.name[0]}
                        </div>
                        <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>USD {Math.round(proyecto.entryPrice * m.sharePercent / 100).toLocaleString("es-AR")}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Cuotas ── */}
          <Card>
            <CardHeader style={{ paddingBottom: 8 }}>
              <CardTitle style={{ fontSize: 15 }}>
                Cuotas — {proyecto.installments.filter(c => c.paidAt).length}/{proyecto.installments.length} pagadas
                {isBRL && <span style={{ fontSize: 11, fontWeight: 400, color: "#64748b", marginLeft: 8 }}>en BRL, pagadas en USD</span>}
              </CardTitle>
            </CardHeader>
            <CardContent style={{ paddingTop: 0 }}>
              {proyecto.installments.length === 0 ? (
                <p style={{ fontSize: 13, color: "#94a3b8" }}>Sin cuotas cargadas</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
                  {proyecto.installments.map(c => {
                    const montoUSD = isBRL ? c.amountUSD : c.amount
                    const partes = montoUSD != null ? partesSocios(montoUSD, c.paidByUserId) : null
                    const pagador = c.paidByUserId ? memberById[c.paidByUserId] : null
                    return (
                      <div key={c.id}
                        style={{ padding: "11px 13px", borderRadius: 12, border: `1px solid ${c.paidAt ? "#86efac" : "#e2e8f0"}`, background: c.paidAt ? "#f0fdf4" : "#fff", cursor: "pointer", transition: "all 0.15s" }}
                        onClick={() => c.paidAt ? desmarcarCuota(c.id, c.number) : iniciarPago(c)}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Checkbox checked={!!c.paidAt} onCheckedChange={v => v ? iniciarPago(c) : desmarcarCuota(c.id, c.number)} onClick={e => e.stopPropagation()} />
                            <span style={{ fontWeight: 700, fontSize: 13, color: c.paidAt ? "#15803d" : "#0f172a" }}>#{c.number}</span>
                          </div>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDate(c.dueDate)}</span>
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px", color: c.paidAt ? "#15803d" : "#334155" }}>
                          {fmtAmt(c.amount, c.amountUSD)}
                        </p>
                        {pagador && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                            <div style={{ width: 14, height: 14, borderRadius: "50%", background: memberColor[pagador.userId], flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>Pagó {firstName(pagador.user.name)}</span>
                          </div>
                        )}
                        {partes && proyecto.members.length > 1 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, borderTop: "1px solid #f1f5f9", paddingTop: 6, marginTop: 2 }}>
                            {partes.map(p => (
                              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
                                  <span style={{ fontSize: 10, color: "#64748b" }}>{p.name}</span>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 600, color: p.esPagador ? p.color : "#64748b" }}>
                                  {p.monto > 0 ? `USD ${p.monto.toLocaleString("es-AR")}` : "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Refuerzos ── */}
          {proyecto.reinforcements.length > 0 && (
            <Card>
              <CardHeader style={{ paddingBottom: 8 }}>
                <CardTitle style={{ fontSize: 15 }}>
                  Refuerzos — {proyecto.reinforcements.filter(r => r.paidAt).length}/{proyecto.reinforcements.length} pagados
                </CardTitle>
              </CardHeader>
              <CardContent style={{ paddingTop: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
                  {proyecto.reinforcements.map(r => {
                    const montoUSD = isBRL ? r.amountUSD : r.amount
                    const partes = montoUSD != null ? partesSocios(montoUSD) : null
                    return (
                      <div key={r.id}
                        style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${r.paidAt ? "#86efac" : "#e2e8f0"}`, background: r.paidAt ? "#f0fdf4" : "#fff", cursor: "pointer", transition: "all 0.15s" }}
                        onClick={() => r.paidAt ? desmarcarRefuerzo(r.id) : iniciarPagoRefuerzo(r)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <Checkbox checked={!!r.paidAt} onCheckedChange={v => v ? iniciarPagoRefuerzo(r) : desmarcarRefuerzo(r.id)} onClick={e => e.stopPropagation()} />
                          {r.label && <span style={{ fontWeight: 600, fontSize: 13, color: r.paidAt ? "#15803d" : "#0f172a" }}>{r.label}</span>}
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px", color: r.paidAt ? "#15803d" : "#334155" }}>
                          {fmtAmt(r.amount, r.amountUSD)}
                        </p>
                        <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 6px" }}>{fmtDate(r.dueDate)}</p>
                        {partes && proyecto.members.length > 1 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, borderTop: "1px solid #f1f5f9", paddingTop: 6 }}>
                            {partes.map(p => (
                              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
                                  <span style={{ fontSize: 10, color: "#64748b" }}>{p.name}</span>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b" }}>
                                  USD {p.monto.toLocaleString("es-AR")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Archivos ── */}
          <Card>
            <CardHeader style={{ paddingBottom: 8 }}>
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
            <CardContent style={{ paddingTop: 0 }}>
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

      {/* ── Modal pago refuerzo ── */}
      {payRefModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setPayRefModal(null)}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: 320, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 4px", color: "#0f172a" }}>Pagar {payRefModal.label}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>¿Cuánto equivalió en USD al momento del pago?</p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Equivalente en USD</label>
              <Input
                type="number"
                placeholder="ej: 1.540"
                value={payRefUSD}
                onChange={e => setPayRefUSD(e.target.value)}
                style={{ fontSize: 14 }}
                autoFocus
              />
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>Podés dejarlo vacío si no lo sabés todavía</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="outline" style={{ flex: 1 }} onClick={() => setPayRefModal(null)}>Cancelar</Button>
              <Button style={{ flex: 1 }} onClick={confirmarPagoRefuerzo}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal pago cuota ── */}
      {payModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setPayModal(null)}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 4px", color: "#0f172a" }}>Marcar cuota #{payModal.number} como pagada</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>Registrá el detalle del pago</p>

            {isBRL && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Equivalente en USD</label>
                <Input
                  type="number"
                  placeholder="ej: 312"
                  value={payUSD}
                  onChange={e => setPayUSD(e.target.value)}
                  style={{ fontSize: 14 }}
                  autoFocus
                />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>¿Quién pagó?</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {proyecto.members.map((m, i) => (
                  <label key={m.userId} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 12px", borderRadius: 10, border: `1px solid ${payBy === m.userId ? MEMBER_COLORS[i % MEMBER_COLORS.length] : "#e2e8f0"}`, background: payBy === m.userId ? "#f8faff" : "#fff" }}>
                    <input type="radio" name="payBy" value={m.userId} checked={payBy === m.userId} onChange={() => setPayBy(m.userId)} style={{ accentColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }} />
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: MEMBER_COLORS[i % MEMBER_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>{m.user.name[0]}</div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{m.user.name.split(" ").slice(0,2).join(" ")}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="outline" style={{ flex: 1 }} onClick={() => setPayModal(null)}>Cancelar</Button>
              <Button style={{ flex: 1 }} onClick={confirmarPago}>Confirmar pago</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
