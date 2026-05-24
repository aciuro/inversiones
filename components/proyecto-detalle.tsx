"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { GraficosProyecto } from "@/components/graficos-proyecto"
import { ExportProyectoButton } from "@/components/export-proyecto-button"

interface Member { userId: string; role: string; sharePercent: number; user: { id: string; name: string; email: string } }
interface Installment { id: string; number: number; amount: number; amountUSD: number | null; dueDate: string; paidAt: string | null; paidByUserId: string | null }
interface Reinforcement { id: string; amount: number; amountUSD: number | null; dueDate: string; paidAt: string | null; label: string | null }
interface ProjectFile { id: string; name: string; size: number; mimeType: string; createdAt: string }
interface Project { id: string; name: string; description: string | null; developer: string | null; location: string | null; unitNumber: string | null; totalPrice: number | null; entryPrice: number; entryPriceBRL: number | null; currentValue: number; currency: string; status: string; soldPrice: number | null; soldAt: string | null; members: Member[]; installments: Installment[]; reinforcements: Reinforcement[]; files: ProjectFile[] }

type EditTarget = { kind: "cuota"; item: Installment } | { kind: "refuerzo"; item: Reinforcement } | null
const COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981"]

function firstName(name: string) { return name.split(" ")[0] }
function money(n: number) { return "USD " + Math.round(n).toLocaleString("es-AR") }
function dateFmt(d: string) { return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) }
function sizeFmt(bytes: number) { if (bytes < 1024) return bytes + " B"; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"; return (bytes / (1024 * 1024)).toFixed(1) + " MB" }
function parseAmount(v: string) { if (!v.trim()) return null; const n = Number(v.replace(/,/g, ".")); return Number.isFinite(n) ? n : null }

export function ProyectoDetalle({ proyecto: initial, isOwner }: { proyecto: Project; isOwner: boolean; userId: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [proyecto, setProyecto] = useState(initial)
  const [tab, setTab] = useState<"detalle" | "graficos">("detalle")
  const [uploading, setUploading] = useState(false)
  const [editingValue, setEditingValue] = useState(false)
  const [newValue, setNewValue] = useState(String(initial.currentValue))
  const [target, setTarget] = useState<EditTarget>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editUSD, setEditUSD] = useState("")
  const [editPaid, setEditPaid] = useState(false)
  const [editPayer, setEditPayer] = useState("")
  const [saving, setSaving] = useState(false)

  const isBRL = proyecto.currency === "BRL"
  const shownValue = proyecto.status === "sold" ? (proyecto.soldPrice ?? proyecto.currentValue) : proyecto.currentValue
  const memberById = Object.fromEntries(proyecto.members.map(m => [m.userId, m]))
  const memberColor = Object.fromEntries(proyecto.members.map((m, i) => [m.userId, COLORS[i % COLORS.length]]))
  const usdValue = (amount: number, amountUSD: number | null) => isBRL ? (amountUSD ?? amount) : amount
  const fmtAmt = (amount: number, amountUSD?: number | null) => isBRL ? `R$ ${Math.round(amount).toLocaleString("es-AR")}${amountUSD != null ? ` ≈ ${money(amountUSD)}` : ""}` : money(amount)

  const totalCuotas = proyecto.installments.filter(c => c.paidAt).reduce((s, c) => s + usdValue(c.amount, c.amountUSD), 0)
  const totalRefuerzos = proyecto.reinforcements.filter(r => r.paidAt).reduce((s, r) => s + usdValue(r.amount, r.amountUSD), 0)
  const totalInvertido = proyecto.entryPrice + totalCuotas + totalRefuerzos
  const balance = shownValue - totalInvertido
  const balanceP = totalInvertido > 0 ? (balance / totalInvertido) * 100 : 0

  const aportes: Record<string, { entrada: number; cuotas: number; refuerzos: number }> = {}
  for (const m of proyecto.members) aportes[m.userId] = { entrada: proyecto.entryPrice * m.sharePercent / 100, cuotas: 0, refuerzos: 0 }
  for (const c of proyecto.installments.filter(c => c.paidAt)) {
    const monto = usdValue(c.amount, c.amountUSD)
    if (c.paidByUserId && aportes[c.paidByUserId]) aportes[c.paidByUserId].cuotas += monto
    else for (const m of proyecto.members) aportes[m.userId].cuotas += monto * m.sharePercent / 100
  }
  for (const r of proyecto.reinforcements.filter(r => r.paidAt)) for (const m of proyecto.members) aportes[m.userId].refuerzos += usdValue(r.amount, r.amountUSD) * m.sharePercent / 100

  function parts(monto: number, paidBy?: string | null) {
    if (proyecto.members.length <= 1) return []
    return proyecto.members.map(m => ({ name: firstName(m.user.name), color: memberColor[m.userId], amount: paidBy ? (m.userId === paidBy ? monto : 0) : Math.round(monto * m.sharePercent / 100), paid: paidBy === m.userId }))
  }

  function editCuota(c: Installment) { setTarget({ kind: "cuota", item: c }); setEditAmount(String(c.amount)); setEditUSD(c.amountUSD != null ? String(c.amountUSD) : ""); setEditPaid(Boolean(c.paidAt)); setEditPayer(c.paidByUserId ?? "") }
  function editRefuerzo(r: Reinforcement) { setTarget({ kind: "refuerzo", item: r }); setEditAmount(String(r.amount)); setEditUSD(r.amountUSD != null ? String(r.amountUSD) : ""); setEditPaid(Boolean(r.paidAt)); setEditPayer("") }
  function closeEdit() { setTarget(null); setEditAmount(""); setEditUSD(""); setEditPaid(false); setEditPayer("") }

  async function saveEdit() {
    if (!target) return
    const amount = parseAmount(editAmount)
    if (amount === null) { toast.error("Monto inválido"); return }
    const amountUSD = parseAmount(editUSD)
    setSaving(true)
    try {
      const url = target.kind === "cuota" ? `/api/proyectos/${proyecto.id}/cuotas/${target.item.id}` : `/api/proyectos/${proyecto.id}/refuerzos/${target.item.id}`
      const body = target.kind === "cuota" ? { amount, amountUSD, paid: editPaid, paidByUserId: editPaid ? editPayer || null : null } : { amount, amountUSD, paid: editPaid }
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const updated = await res.json()
      if (!res.ok) throw new Error(updated?.error || "No se pudo guardar")
      if (target.kind === "cuota") setProyecto(p => ({ ...p, installments: p.installments.map(c => c.id === updated.id ? updated : c) }))
      else setProyecto(p => ({ ...p, reinforcements: p.reinforcements.map(r => r.id === updated.id ? updated : r) }))
      toast.success("Guardado")
      closeEdit()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error al guardar") } finally { setSaving(false) }
  }

  async function saveCurrentValue() {
    const val = parseAmount(newValue)
    if (val === null) return
    const res = await fetch(`/api/proyectos/${proyecto.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...proyecto, currentValue: val }) })
    if (!res.ok) { toast.error("Error al guardar"); return }
    setProyecto(p => ({ ...p, currentValue: val }))
    setEditingValue(false)
    toast.success("Valor actualizado")
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append("file", file)
    const res = await fetch(`/api/proyectos/${proyecto.id}/archivos`, { method: "POST", body: fd })
    if (!res.ok) { toast.error("Error al subir archivo"); setUploading(false); return }
    const record = await res.json()
    setProyecto(p => ({ ...p, files: [record, ...p.files] }))
    toast.success("Archivo subido")
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function removeFile(id: string) {
    if (!confirm("¿Eliminar este archivo?")) return
    const res = await fetch(`/api/proyectos/${proyecto.id}/archivos/${id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Error al eliminar"); return }
    setProyecto(p => ({ ...p, files: p.files.filter(f => f.id !== id) }))
  }

  return (
    <div className="space-y-5">
      <Toaster />
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="m-0 text-2xl font-bold text-slate-900">{proyecto.name}</h1><div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">{proyecto.developer && <span>🏢 {proyecto.developer}</span>}{proyecto.location && <span>📍 {proyecto.location}</span>}{proyecto.unitNumber && <span>🔑 {proyecto.unitNumber}</span>}</div></div>
        <div className="flex gap-2"><ExportProyectoButton projectId={proyecto.id} /><Button variant="outline" size="sm" onClick={() => router.push("/proyectos")}>← Volver</Button></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {proyecto.totalPrice && <Card><CardContent className="pt-4 pb-3"><p className="mb-1 text-xs text-slate-500">Precio total</p><p className="m-0 text-sm font-bold">{isBRL ? `R$ ${Math.round(proyecto.totalPrice).toLocaleString("es-AR")}` : money(proyecto.totalPrice)}</p></CardContent></Card>}
        <Card><CardContent className="pt-4 pb-3"><p className="mb-1 text-xs text-slate-500">Total invertido</p><p className="m-0 text-sm font-bold">{money(totalInvertido)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="mb-1 text-xs text-slate-500">Valor actual</p>{editingValue && isOwner ? <div className="flex gap-2"><Input value={newValue} onChange={e => setNewValue(e.target.value)} className="h-8" /><Button size="sm" onClick={saveCurrentValue}>OK</Button></div> : <div className="flex items-center gap-2"><p className="m-0 text-sm font-bold">{money(shownValue)}</p>{isOwner && <button className="text-slate-400" onClick={() => { setEditingValue(true); setNewValue(String(proyecto.currentValue)) }}>✎</button>}</div>}</CardContent></Card>
        <Card className={balance >= 0 ? "border-green-200 bg-green-50" : "border-rose-200 bg-rose-50"}><CardContent className="pt-4 pb-3"><p className="mb-1 text-xs text-slate-500">Balance</p><p className="m-0 text-sm font-bold">{money(balance)} ({balanceP >= 0 ? "+" : ""}{balanceP.toFixed(1)}%)</p></CardContent></Card>
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Socios y aportes</CardTitle></CardHeader><CardContent className="overflow-x-auto pt-0"><table className="w-full text-sm"><thead><tr className="border-b"><th className="py-2 text-left text-xs text-slate-500">Socio</th><th className="py-2 text-right text-xs text-slate-500">Entrada</th><th className="py-2 text-right text-xs text-slate-500">Cuotas</th><th className="py-2 text-right text-xs text-slate-500">Refuerzos</th><th className="py-2 text-right text-xs text-slate-500">Total</th></tr></thead><tbody>{proyecto.members.map((m, i) => { const a = aportes[m.userId]; const total = a.entrada + a.cuotas + a.refuerzos; const color = COLORS[i % COLORS.length]; return <tr key={m.userId} className="border-b"><td className="py-3"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: color }}>{m.user.name[0]}</div><div><p className="m-0 font-semibold">{m.user.name}</p><p className="m-0 text-xs text-slate-400">{m.sharePercent}%</p></div></div></td><td className="py-3 text-right">{money(a.entrada)}</td><td className="py-3 text-right">{money(a.cuotas)}</td><td className="py-3 text-right">{money(a.refuerzos)}</td><td className="py-3 text-right font-bold" style={{ color }}>{money(total)}</td></tr> })}</tbody></table></CardContent></Card>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1"><button onClick={() => setTab("detalle")} className={`flex-1 rounded-lg py-2 text-sm ${tab === "detalle" ? "bg-white font-semibold shadow-sm" : "text-slate-500"}`}>📋 Detalle</button><button onClick={() => setTab("graficos")} className={`flex-1 rounded-lg py-2 text-sm ${tab === "graficos" ? "bg-white font-semibold shadow-sm" : "text-slate-500"}`}>📊 Gráficos</button></div>
      {tab === "graficos" && <GraficosProyecto proyecto={proyecto} />}

      {tab === "detalle" && <div className="space-y-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Entrada</CardTitle></CardHeader><CardContent className="pt-0"><div className="rounded-xl border border-green-300 bg-green-50 p-4"><p className="m-0 font-bold text-green-700">{money(proyecto.entryPrice)}</p><p className="m-0 text-xs text-green-600">Pagada ✓</p></div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Cuotas — {proyecto.installments.filter(c => c.paidAt).length}/{proyecto.installments.length} pagadas</CardTitle></CardHeader><CardContent className="pt-0"><div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">{proyecto.installments.map(c => { const monto = usdValue(c.amount, c.amountUSD); const payer = c.paidByUserId ? memberById[c.paidByUserId] : null; return <div key={c.id} className={`rounded-xl border p-3 ${c.paidAt ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><Checkbox checked={!!c.paidAt} onCheckedChange={() => editCuota(c)} /><span className="font-bold">#{c.number}</span></div><span className="text-xs text-slate-400">{dateFmt(c.dueDate)}</span></div><p className="m-0 text-sm font-semibold">{fmtAmt(c.amount, c.amountUSD)}</p>{payer && <p className="mt-1 text-xs text-slate-500">Pagó {firstName(payer.user.name)}</p>}{c.paidAt && parts(monto, c.paidByUserId).length > 0 && <div className="mt-2 border-t pt-2">{parts(monto, c.paidByUserId).map(p => <div key={p.name} className="flex justify-between text-xs"><span>{p.name}</span><span className="font-semibold" style={{ color: p.paid ? p.color : "#64748b" }}>{p.amount > 0 ? money(p.amount) : "—"}</span></div>)}</div>}<Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => editCuota(c)}>Editar</Button></div> })}</div></CardContent></Card>
        {proyecto.reinforcements.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-base">Refuerzos — {proyecto.reinforcements.filter(r => r.paidAt).length}/{proyecto.reinforcements.length} pagados</CardTitle></CardHeader><CardContent className="pt-0"><div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">{proyecto.reinforcements.map(r => <div key={r.id} className={`rounded-xl border p-3 ${r.paidAt ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}><div className="mb-2 flex items-center gap-2"><Checkbox checked={!!r.paidAt} onCheckedChange={() => editRefuerzo(r)} /><span className="font-bold">{r.label || "Refuerzo"}</span></div><p className="m-0 text-sm font-semibold">{fmtAmt(r.amount, r.amountUSD)}</p><p className="m-0 text-xs text-slate-400">{dateFmt(r.dueDate)}</p><Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => editRefuerzo(r)}>Editar</Button></div>)}</div></CardContent></Card>}
        <Card><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base">Archivos</CardTitle><div><input ref={fileRef} type="file" className="hidden" onChange={uploadFile} /><Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Subiendo..." : "+ Subir"}</Button></div></div></CardHeader><CardContent className="pt-0">{proyecto.files.length === 0 ? <p className="text-sm text-slate-400">Sin archivos cargados</p> : <div className="space-y-2">{proyecto.files.map(f => <div key={f.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><div className="min-w-0"><a href={`/api/proyectos/${proyecto.id}/archivos/${f.id}`} target="_blank" rel="noopener noreferrer" className="block truncate font-medium text-slate-900 no-underline">{f.name}</a><p className="m-0 text-xs text-slate-400">{sizeFmt(f.size)} · {dateFmt(f.createdAt)}</p></div><Button size="sm" variant="ghost" className="text-red-500" onClick={() => removeFile(f.id)}>Eliminar</Button></div>)}</div>}</CardContent></Card>
      </div>}

      {target && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeEdit}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}><h3 className="text-lg font-bold">Editar {target.kind === "cuota" ? `cuota #${target.item.number}` : target.item.label || "refuerzo"}</h3><p className="mt-1 text-sm text-slate-500">Guardado directo, sin aprobación de socios.</p><div className="mt-5 space-y-4"><div><label className="mb-1 block text-xs font-semibold text-slate-600">Monto original ({proyecto.currency})</label><Input value={editAmount} onChange={e => setEditAmount(e.target.value)} /></div><div><label className="mb-1 block text-xs font-semibold text-slate-600">Equivalente USD</label><Input value={editUSD} onChange={e => setEditUSD(e.target.value)} placeholder={isBRL ? "Ej: 289" : "Opcional"} /></div><label className="flex items-center gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={editPaid} onChange={e => setEditPaid(e.target.checked)} /> Marcar como pagado</label>{target.kind === "cuota" && proyecto.members.length > 1 && editPaid && <div><label className="mb-1 block text-xs font-semibold text-slate-600">¿Quién pagó?</label><select value={editPayer} onChange={e => setEditPayer(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm"><option value="">Repartido por porcentaje</option>{proyecto.members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}</select></div>}</div><div className="mt-6 flex gap-3"><Button variant="outline" className="flex-1" onClick={closeEdit}>Cancelar</Button><Button className="flex-1" disabled={saving} onClick={saveEdit}>{saving ? "Guardando..." : "Guardar"}</Button></div></div></div>}
    </div>
  )
}
