"use client"

import { useState, useEffect } from "react"
import { Trash2, Plus, X, ChevronDown, ChevronUp, Pencil } from "lucide-react"
import { toast } from "sonner"

type Retiro = {
  id: string
  fecha: string
  montoARS: number
  tipoCambio: number
  montoUSD: number
  nota: string | null
}

type Negocio = {
  id: string
  nombre: string
  inversionUSD: number | null
  porcentaje: number
  retiros: Retiro[]
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// ── Modal agregar retiro ──────────────────────────────────────────────────────
function ModalRetiro({ negocioId, onClose, onSaved }: { negocioId: string; onClose: () => void; onSaved: (r: Retiro) => void }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [montoARS, setMontoARS] = useState("")
  const [tipoCambio, setTipoCambio] = useState("")
  const [nota, setNota] = useState("")
  const [saving, setSaving] = useState(false)

  const montoUSD = montoARS && tipoCambio ? parseFloat(montoARS) / parseFloat(tipoCambio) : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!montoARS || !tipoCambio) return
    setSaving(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/retiros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, montoARS: parseFloat(montoARS), tipoCambio: parseFloat(tipoCambio), nota }),
      })
      if (!res.ok) throw new Error()
      const retiro = await res.json()
      onSaved(retiro)
      toast.success("Retiro registrado")
      onClose()
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Registrar retiro</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Monto retirado (ARS $)</label>
            <input type="number" value={montoARS} onChange={e => setMontoARS(e.target.value)}
              placeholder="500000" step="1"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Dólar blue (ARS por USD)</label>
            <input type="number" value={tipoCambio} onChange={e => setTipoCambio(e.target.value)}
              placeholder="1250" step="0.01"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          {montoUSD !== null && (
            <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm">
              <span className="text-gray-500">Equivalente en USD: </span>
              <span className="font-semibold text-blue-700">USD {fmt(montoUSD, 2)}</span>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Nota (opcional)</label>
            <input type="text" value={nota} onChange={e => setNota(e.target.value)}
              placeholder="ej: Distribución mensual"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal editar inversión ────────────────────────────────────────────────────
function ModalEditarInversion({ negocio, onClose, onSaved }: { negocio: Negocio; onClose: () => void; onSaved: (n: Negocio) => void }) {
  const [inversionUSD, setInversionUSD] = useState(negocio.inversionUSD?.toString() ?? "")
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/negocios/${negocio.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: negocio.nombre, porcentaje: negocio.porcentaje, inversionUSD: inversionUSD ? parseFloat(inversionUSD) : null }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      onSaved(updated)
      toast.success("Inversión actualizada")
      onClose()
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Editar inversión — {negocio.nombre}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Inversión total (USD)</label>
            <input type="number" value={inversionUSD} onChange={e => setInversionUSD(e.target.value)}
              placeholder="ej: 15000" step="0.01"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Card de negocio ───────────────────────────────────────────────────────────
function NegocioCard({ negocio, onChange }: { negocio: Negocio; onChange: (n: Negocio) => void }) {
  const [open, setOpen] = useState(false)
  const [modalRetiro, setModalRetiro] = useState(false)
  const [modalInversion, setModalInversion] = useState(false)

  const totalRecuperadoUSD = negocio.retiros.reduce((s, r) => s + r.montoUSD, 0)
  const pendienteUSD = negocio.inversionUSD != null ? negocio.inversionUSD - totalRecuperadoUSD : null
  const porcentajeRecuperado = negocio.inversionUSD ? (totalRecuperadoUSD / negocio.inversionUSD) * 100 : null

  async function eliminarRetiro(retiroId: string) {
    if (!confirm("¿Eliminar este retiro?")) return
    try {
      await fetch(`/api/negocios/${negocio.id}/retiros/${retiroId}`, { method: "DELETE" })
      onChange({ ...negocio, retiros: negocio.retiros.filter(r => r.id !== retiroId) })
      toast.success("Retiro eliminado")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  function onRetiroSaved(r: Retiro) {
    onChange({ ...negocio, retiros: [r, ...negocio.retiros] })
  }

  function onInversionSaved(updated: Negocio) {
    onChange(updated)
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{negocio.nombre}</h2>
            <p className="text-sm text-gray-500">Mi participación: {negocio.porcentaje}%</p>
          </div>
          <button onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {open ? "Ocultar" : "Ver retiros"}
          </button>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Invertí</p>
            {negocio.inversionUSD != null ? (
              <div className="flex items-center gap-1">
                <p className="font-semibold text-gray-900">USD {fmt(negocio.inversionUSD)}</p>
                <button onClick={() => setModalInversion(true)} className="text-gray-400 hover:text-blue-600">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button onClick={() => setModalInversion(true)}
                className="text-sm text-blue-600 hover:underline font-medium">
                + Agregar
              </button>
            )}
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Recuperé</p>
            <p className="font-semibold text-green-700">USD {fmt(totalRecuperadoUSD, 2)}</p>
          </div>
          <div className={`rounded-lg p-3 ${pendienteUSD != null && pendienteUSD > 0 ? "bg-orange-50" : pendienteUSD != null ? "bg-green-50" : "bg-gray-50"}`}>
            <p className="text-xs text-gray-500 mb-1">Pendiente</p>
            {pendienteUSD != null ? (
              <p className={`font-semibold ${pendienteUSD > 0 ? "text-orange-700" : "text-green-700"}`}>
                {pendienteUSD <= 0 ? "¡Recuperado!" : `USD ${fmt(pendienteUSD, 2)}`}
              </p>
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">% Recuperado</p>
            {porcentajeRecuperado != null ? (
              <>
                <p className="font-semibold text-blue-700">{fmt(porcentajeRecuperado, 1)}%</p>
                <div className="mt-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(porcentajeRecuperado, 100)}%` }} />
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </div>
        </div>

        <button onClick={() => setModalRetiro(true)}
          className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800">
          <Plus className="w-4 h-4" />
          Agregar retiro
        </button>
      </div>

      {/* Tabla de retiros */}
      {open && (
        <div className="border-t">
          {negocio.retiros.length === 0 ? (
            <p className="text-sm text-gray-400 px-6 py-4">Sin retiros registrados aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ARS $</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Blue</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">USD</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nota</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {negocio.retiros.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-700">{fmtDate(r.fecha)}</td>
                      <td className="px-6 py-3 text-gray-700">$ {fmt(r.montoARS)}</td>
                      <td className="px-6 py-3 text-gray-500">${fmt(r.tipoCambio)}</td>
                      <td className="px-6 py-3 font-medium text-green-700">USD {fmt(r.montoUSD, 2)}</td>
                      <td className="px-6 py-3 text-gray-400">{r.nota ?? "—"}</td>
                      <td className="px-6 py-3">
                        <button onClick={() => eliminarRetiro(r.id)} className="text-gray-300 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modalRetiro && <ModalRetiro negocioId={negocio.id} onClose={() => setModalRetiro(false)} onSaved={onRetiroSaved} />}
      {modalInversion && <ModalEditarInversion negocio={negocio} onClose={() => setModalInversion(false)} onSaved={onInversionSaved} />}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export function Negocios() {
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/negocios")
      .then(r => r.json())
      .then(setNegocios)
      .finally(() => setLoading(false))
  }, [])

  function updateNegocio(updated: Negocio) {
    setNegocios(ns => ns.map(n => n.id === updated.id ? updated : n))
  }

  const totalInvertido = negocios.reduce((s, n) => s + (n.inversionUSD ?? 0), 0)
  const totalRecuperado = negocios.reduce((s, n) => s + n.retiros.reduce((sr, r) => sr + r.montoUSD, 0), 0)

  if (loading) return <p className="text-gray-400 text-sm py-8">Cargando...</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Negocios</h1>
        <p className="text-sm text-gray-500 mt-1">Seguimiento de retiros por negocio</p>
      </div>

      {/* Resumen global */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Total invertido</p>
          <p className="text-xl font-bold text-gray-900">USD {fmt(totalInvertido)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Total recuperado</p>
          <p className="text-xl font-bold text-green-700">USD {fmt(totalRecuperado, 2)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Pendiente de recuperar</p>
          <p className="text-xl font-bold text-orange-700">USD {fmt(totalInvertido - totalRecuperado, 2)}</p>
        </div>
      </div>

      {/* Cards de negocios */}
      <div className="space-y-4">
        {negocios.map(n => (
          <NegocioCard key={n.id} negocio={n} onChange={updateNegocio} />
        ))}
      </div>
    </div>
  )
}
