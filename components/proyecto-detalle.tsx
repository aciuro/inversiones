"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"

interface Member { userId: string; role: string; user: { id: string; name: string; email: string } }
interface Installment { id: string; number: number; amount: number; dueDate: string; paidAt: string | null }
interface Reinforcement { id: string; amount: number; dueDate: string; paidAt: string | null; label: string | null }
interface ProjectFile { id: string; name: string; size: number; mimeType: string; createdAt: string }
interface Project {
  id: string; name: string; description: string | null; entryPrice: number; currentValue: number
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
  const fileRef = useRef<HTMLInputElement>(null)

  const totalCuotas = proyecto.installments.filter((c) => c.paidAt).reduce((s, c) => s + c.amount, 0)
  const totalRefuerzos = proyecto.reinforcements.filter((r) => r.paidAt).reduce((s, r) => s + r.amount, 0)
  const totalInvertido = proyecto.entryPrice + totalCuotas + totalRefuerzos
  const ganancia = proyecto.currentValue - totalInvertido
  const gananciaP = totalInvertido > 0 ? (ganancia / totalInvertido) * 100 : 0

  async function toggleCuota(id: string, paid: boolean) {
    const res = await fetch(`/api/proyectos/${proyecto.id}/cuotas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid }),
    })
    if (!res.ok) { toast.error("Error al actualizar cuota"); return }
    const updated = await res.json()
    setProyecto((p) => ({
      ...p,
      installments: p.installments.map((c) => (c.id === id ? { ...c, paidAt: updated.paidAt } : c)),
    }))
  }

  async function toggleRefuerzo(id: string, paid: boolean) {
    const res = await fetch(`/api/proyectos/${proyecto.id}/refuerzos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid }),
    })
    if (!res.ok) { toast.error("Error al actualizar refuerzo"); return }
    const updated = await res.json()
    setProyecto((p) => ({
      ...p,
      reinforcements: p.reinforcements.map((r) => (r.id === id ? { ...r, paidAt: updated.paidAt } : r)),
    }))
  }

  async function saveCurrentValue() {
    const val = parseFloat(newValue)
    if (isNaN(val)) return
    const res = await fetch(`/api/proyectos/${proyecto.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...proyecto, currentValue: val }),
    })
    if (!res.ok) { toast.error("Error al guardar"); return }
    setProyecto((p) => ({ ...p, currentValue: val }))
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
    setProyecto((p) => ({ ...p, files: [record, ...p.files] }))
    toast.success("Archivo subido")
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function deleteFile(id: string) {
    if (!confirm("¿Eliminar este archivo?")) return
    const res = await fetch(`/api/proyectos/${proyecto.id}/archivos/${id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Error al eliminar"); return }
    setProyecto((p) => ({ ...p, files: p.files.filter((f) => f.id !== id) }))
    toast.success("Archivo eliminado")
  }

  function fmt(n: number) {
    return "USD " + n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  function fmtSize(bytes: number) {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <div className="space-y-6">
      <Toaster />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{proyecto.name}</h1>
          {proyecto.description && <p className="text-gray-500 mt-1">{proyecto.description}</p>}
          <div className="flex gap-1 mt-2 flex-wrap">
            {proyecto.members.map((m) => (
              <Badge key={m.userId} variant={m.role === "owner" ? "default" : "outline"} className="text-xs">
                {m.user.name}
              </Badge>
            ))}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/proyectos")}>
          ← Volver
        </Button>
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">Entrada</p>
            <p className="font-semibold">{fmt(proyecto.entryPrice)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">Total invertido</p>
            <p className="font-semibold">{fmt(totalInvertido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">Valor actual</p>
            {editingValue && isOwner ? (
              <div className="flex gap-1 mt-1">
                <Input
                  type="number"
                  step="0.01"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="h-7 text-sm"
                  autoFocus
                />
                <Button size="sm" className="h-7 text-xs" onClick={saveCurrentValue}>OK</Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <p className="font-semibold">{fmt(proyecto.currentValue)}</p>
                {isOwner && (
                  <button onClick={() => { setEditingValue(true); setNewValue(String(proyecto.currentValue)) }} className="text-gray-400 hover:text-gray-700 text-xs ml-1">✎</button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">Ganancia</p>
            <p className={`font-semibold ${ganancia >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmt(ganancia)} ({gananciaP >= 0 ? "+" : ""}{gananciaP.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cuotas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Cuotas — {proyecto.installments.filter((c) => c.paidAt).length}/{proyecto.installments.length} pagadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proyecto.installments.length === 0 ? (
            <p className="text-sm text-gray-400">Sin cuotas cargadas</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {proyecto.installments.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 p-2 rounded border text-sm cursor-pointer transition-colors ${
                    c.paidAt ? "bg-green-50 border-green-200" : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                  onClick={() => toggleCuota(c.id, !c.paidAt)}
                >
                  <Checkbox checked={!!c.paidAt} onCheckedChange={(v) => toggleCuota(c.id, !!v)} onClick={(e) => e.stopPropagation()} />
                  <div>
                    <p className="font-medium">#{c.number}</p>
                    <p className="text-xs text-gray-500">{fmtDate(c.dueDate)}</p>
                    <p className="text-xs">{fmt(c.amount)}</p>
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
            <CardTitle className="text-base">
              Refuerzos — {proyecto.reinforcements.filter((r) => r.paidAt).length}/{proyecto.reinforcements.length} pagados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {proyecto.reinforcements.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-2 p-3 rounded border cursor-pointer transition-colors ${
                    r.paidAt ? "bg-green-50 border-green-200" : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                  onClick={() => toggleRefuerzo(r.id, !r.paidAt)}
                >
                  <Checkbox checked={!!r.paidAt} onCheckedChange={(v) => toggleRefuerzo(r.id, !!v)} onClick={(e) => e.stopPropagation()} />
                  <div>
                    {r.label && <p className="font-medium text-sm">{r.label}</p>}
                    <p className="text-sm">{fmt(r.amount)} — {fmtDate(r.dueDate)}</p>
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Archivos</CardTitle>
            <div>
              <input ref={fileRef} type="file" className="hidden" onChange={uploadFile} />
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "Subiendo..." : "+ Subir archivo"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {proyecto.files.length === 0 ? (
            <p className="text-sm text-gray-400">Sin archivos cargados</p>
          ) : (
            <div className="space-y-2">
              {proyecto.files.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{f.mimeType.startsWith("image/") ? "🖼" : f.mimeType === "application/pdf" ? "📄" : "📎"}</span>
                    <div className="min-w-0">
                      <a
                        href={`/api/proyectos/${proyecto.id}/archivos/${f.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline truncate block"
                      >
                        {f.name}
                      </a>
                      <p className="text-xs text-gray-400">{fmtSize(f.size)} · {fmtDate(f.createdAt)}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 shrink-0" onClick={() => deleteFile(f.id)}>
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
