"use client"

import { useState, useEffect, useMemo } from "react"
import { Trash2, Plus, X, ChevronDown, ChevronUp, Pencil, CheckCircle2, Circle } from "lucide-react"
import { toast } from "sonner"
import { LocalVentaModal } from "@/components/local-venta-modal"

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
  status?: string
  soldAt?: string | null
  salePriceUSD?: number | null
  saleDownPaymentUSD?: number | null
  saleInstallmentsCount?: number | null
  saleInstallmentUSD?: number | null
  saleFirstInstallmentDate?: string | null
  saleNotes?: string | null
  saleInstallmentsPaid?: number[]
  retiros: Retiro[]
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function fmtMonth(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

function myPart(amount: number, porcentaje: number) {
  return (amount * porcentaje) / 100
}

function saleCollectedMyPart(n: Negocio) {
  const down = n.saleDownPaymentUSD ?? 0
  const installment = n.saleInstallmentUSD ?? 0
  const paidCount = n.saleInstallmentsPaid?.length ?? 0
  return myPart(down + paidCount * installment, n.porcentaje)
}

// ── Modal agregar retiro ──────────────────────────────────────────────────────
function ModalRetiro({ negocioId, onClose, onSaved }: { negocioId: string; onClose: () => void; onSaved: (r: Retiro) => void }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [montoARS, setMontoARS] = useState("")
  const [tipoCambio, setTipoCambio] = useState("")
  const [nota, setNota] = useState("")
  const [saving, setSaving] = useState(false)
  const [blueInfo, setBlueInfo] = useState<{ compra: number; venta: number; fecha: string } | null>(null)
  const [loadingBlue, setLoadingBlue] = useState(false)

  useEffect(() => {
    if (!fecha) return
    setLoadingBlue(true)
    fetch(`/api/dolar-blue?fecha=${fecha}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setBlueInfo(data)
          setTipoCambio(String(data.compra))
        } else {
          setBlueInfo(null)
        }
      })
      .catch(() => setBlueInfo(null))
      .finally(() => setLoadingBlue(false))
  }, [fecha])

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
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Monto retirado (ARS $)</label>
            <input type="number" value={montoARS} onChange={e => setMontoARS(e.target.value)} placeholder="500000" step="1" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Dólar blue compra
              {loadingBlue && <span className="text-gray-400 font-normal ml-2">cargando...</span>}
              {!loadingBlue && blueInfo && <span className="text-gray-400 font-normal ml-2">(venta ${fmt(blueInfo.venta)} · {new Date(blueInfo.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })})</span>}
            </label>
            <input type="number" value={tipoCambio} onChange={e => setTipoCambio(e.target.value)} placeholder="1250" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          {montoUSD !== null && <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm"><span className="text-gray-500">Equivalente en USD: </span><span className="font-semibold text-blue-700">USD {fmt(montoUSD, 2)}</span></div>}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Nota (opcional)</label>
            <input type="text" value={nota} onChange={e => setNota(e.target.value)} placeholder="ej: Distribución mensual" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

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
            <input type="number" value={inversionUSD} onChange={e => setInversionUSD(e.target.value)} placeholder="ej: 15000" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function VentaResumen({ negocio, onChange }: { negocio: Negocio; onChange: (n: Negocio) => void }) {
  const [updating, setUpdating] = useState<number | null>(null)
  const salePrice = negocio.salePriceUSD ?? 0
  const down = negocio.saleDownPaymentUSD ?? 0
  const count = negocio.saleInstallmentsCount ?? 0
  const installment = negocio.saleInstallmentUSD ?? 0
  const paid = negocio.saleInstallmentsPaid ?? []
  const paidCount = paid.length
  const paidInstallmentsUSD = paidCount * installment
  const paidTotalUSD = down + paidInstallmentsUSD
  const pendingUSD = Math.max(0, salePrice - paidTotalUSD)
  const mySale = myPart(salePrice, negocio.porcentaje)
  const myPending = myPart(pendingUSD, negocio.porcentaje)
  const myPaid = myPart(paidTotalUSD, negocio.porcentaje)
  const myDown = myPart(down, negocio.porcentaje)
  const myInvestment = myPart(negocio.inversionUSD ?? 0, negocio.porcentaje)
  const roi = myInvestment > 0 ? ((mySale - myInvestment) / myInvestment) * 100 : null

  const rows = useMemo(() => {
    if (!negocio.saleFirstInstallmentDate || count <= 0 || installment <= 0) return []
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(negocio.saleFirstInstallmentDate as string)
      d.setMonth(d.getMonth() + i)
      return { number: i + 1, month: d.toISOString(), paid: paid.includes(i + 1) }
    })
  }, [negocio.saleFirstInstallmentDate, count, installment, paid])

  async function togglePaid(number: number) {
    if (updating) return
    setUpdating(number)
    const nextPaid = paid.includes(number) ? paid.filter(n => n !== number) : [...paid, number].sort((a, b) => a - b)
    try {
      const res = await fetch(`/api/negocios/${negocio.id}/venta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soldAt: negocio.soldAt,
          salePriceUSD: salePrice,
          downPaymentUSD: down || null,
          installmentsCount: count || null,
          installmentUSD: installment || null,
          firstInstallmentDate: negocio.saleFirstInstallmentDate || null,
          notes: negocio.saleNotes || null,
          paidInstallments: nextPaid,
        }),
      })
      const updated = await res.json()
      if (!res.ok) throw new Error(updated?.error || "No se pudo actualizar la cuota")
      onChange({ ...negocio, ...updated })
      toast.success(nextPaid.includes(number) ? "Cuota marcada como pagada" : "Cuota marcada como pendiente")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar cuota")
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">VENDIDO</div>
          <p className="mt-2 text-sm text-emerald-900">Venta 100%: <strong>USD {fmt(salePrice, 2)}</strong> · Mi parte total: <strong>USD {fmt(mySale, 2)}</strong></p>
          <p className="text-xs text-emerald-700">Cobrado de mi parte: USD {fmt(myPaid, 2)} · Falta de mi parte: USD {fmt(myPending, 2)}</p>
        </div>
        <div className="text-sm text-right">
          <p className="text-emerald-700">ROI mi parte</p>
          <p className="font-bold text-emerald-950">{roi === null ? "—" : `${roi >= 0 ? "+" : ""}${fmt(roi, 1)}%`}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Info label="Anticipo 100%" value={`USD ${fmt(down, 2)}`} />
        <Info label="Mi anticipo" value={`USD ${fmt(myDown, 2)}`} />
        <Info label="Cuotas pagas" value={`${paidCount}/${count}`} />
        <Info label="Mi cobrado venta" value={`USD ${fmt(myPaid, 2)}`} strong />
        <Info label="Mi falta cobrar" value={`USD ${fmt(myPending, 2)}`} strong />
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Cuota</th>
                <th className="px-4 py-3 text-left">Mes</th>
                <th className="px-4 py-3 text-right">Cuota 100%</th>
                <th className="px-4 py-3 text-right">Mi parte</th>
                <th className="px-4 py-3 text-right">Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => (
                <tr key={row.number} className={row.paid ? "bg-green-50/40" : ""}>
                  <td className="px-4 py-3">#{row.number}</td>
                  <td className="px-4 py-3 capitalize">{fmtMonth(row.month)}</td>
                  <td className="px-4 py-3 text-right">USD {fmt(installment, 2)}</td>
                  <td className="px-4 py-3 text-right">USD {fmt(myPart(installment, negocio.porcentaje), 2)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={updating === row.number}
                      onClick={() => togglePaid(row.number)}
                      className={`inline-flex min-w-[130px] justify-center items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${row.paid ? "bg-green-600 text-white hover:bg-green-700" : "bg-white border border-orange-300 text-orange-700 hover:bg-orange-50"}`}
                    >
                      {row.paid ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                      {updating === row.number ? "Actualizando..." : row.paid ? "Pagada" : "Marcar paga"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {negocio.saleNotes && <p className="text-sm text-gray-500">Notas: {negocio.saleNotes}</p>}
    </div>
  )
}

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="rounded-xl bg-white p-3"><p className="text-xs text-gray-500">{label}</p><p className={`font-semibold ${strong ? "text-emerald-800" : "text-gray-900"}`}>{value}</p></div>
}

function NegocioCard({ negocio, onChange }: { negocio: Negocio; onChange: (n: Negocio) => void }) {
  const [open, setOpen] = useState(false)
  const [modalRetiro, setModalRetiro] = useState(false)
  const [modalInversion, setModalInversion] = useState(false)
  const [modalVenta, setModalVenta] = useState(false)

  const totalRecuperadoUSD = negocio.retiros.reduce((s, r) => s + r.montoUSD, 0)
  const isSold = negocio.status === "sold" || !!negocio.salePriceUSD
  const ventaCobradoMiParteUSD = saleCollectedMyPart(negocio)
  const recuperadoRealUSD = totalRecuperadoUSD + ventaCobradoMiParteUSD
  const pendienteUSD = negocio.inversionUSD != null ? negocio.inversionUSD - recuperadoRealUSD : null
  const porcentajeRecuperado = negocio.inversionUSD ? (recuperadoRealUSD / negocio.inversionUSD) * 100 : null

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
    onChange({ ...negocio, ...updated })
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900">{negocio.nombre}</h2>
              {isSold && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">VENDIDO</span>}
            </div>
            <p className="text-sm text-gray-500">Mi participación: {negocio.porcentaje}%</p>
          </div>
          <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {open ? "Ocultar" : "Ver detalle"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Invertí</p>
            {negocio.inversionUSD != null ? <div className="flex items-center gap-1"><p className="font-semibold text-gray-900">USD {fmt(negocio.inversionUSD)}</p><button onClick={() => setModalInversion(true)} className="text-gray-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></button></div> : <button onClick={() => setModalInversion(true)} className="text-sm text-blue-600 hover:underline font-medium">+ Agregar</button>}
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Recuperé real</p>
            <p className="font-semibold text-green-700">USD {fmt(recuperadoRealUSD, 2)}</p>
          </div>
          <div className={`rounded-lg p-3 ${pendienteUSD != null && pendienteUSD > 0 ? "bg-orange-50" : pendienteUSD != null ? "bg-green-50" : "bg-gray-50"}`}>
            <p className="text-xs text-gray-500 mb-1">Pendiente inversión</p>
            {pendienteUSD != null ? <p className={`font-semibold ${pendienteUSD > 0 ? "text-orange-700" : "text-green-700"}`}>{pendienteUSD <= 0 ? "¡Recuperado!" : `USD ${fmt(pendienteUSD, 2)}`}</p> : <p className="text-sm text-gray-400">—</p>}
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">% Recuperado</p>
            {porcentajeRecuperado != null ? <><p className="font-semibold text-blue-700">{fmt(porcentajeRecuperado, 1)}%</p><div className="mt-1 h-1.5 bg-blue-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(porcentajeRecuperado, 100)}%` }} /></div></> : <p className="text-sm text-gray-400">—</p>}
          </div>
        </div>

        {isSold && <VentaResumen negocio={negocio} onChange={onChange} />}

        <div className="mt-4 flex flex-wrap gap-4">
          <button onClick={() => setModalRetiro(true)} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"><Plus className="w-4 h-4" />Agregar retiro</button>
          <button onClick={() => setModalVenta(true)} className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-800"><Plus className="w-4 h-4" />{isSold ? "Editar venta" : "Marcar vendido"}</button>
        </div>
      </div>

      {open && (
        <div className="border-t">
          {negocio.retiros.length === 0 ? <p className="text-sm text-gray-400 px-6 py-4">Sin retiros registrados aún.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-left"><th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th><th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ARS $</th><th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Blue</th><th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">USD</th><th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nota</th><th className="px-6 py-3"></th></tr></thead>
                <tbody className="divide-y divide-gray-100">{negocio.retiros.map(r => <tr key={r.id} className="hover:bg-gray-50"><td className="px-6 py-3 text-gray-700">{fmtDate(r.fecha)}</td><td className="px-6 py-3 text-gray-700">$ {fmt(r.montoARS)}</td><td className="px-6 py-3 text-gray-500">${fmt(r.tipoCambio)}</td><td className="px-6 py-3 font-medium text-green-700">USD {fmt(r.montoUSD, 2)}</td><td className="px-6 py-3 text-gray-400">{r.nota ?? "—"}</td><td className="px-6 py-3"><button onClick={() => eliminarRetiro(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modalRetiro && <ModalRetiro negocioId={negocio.id} onClose={() => setModalRetiro(false)} onSaved={onRetiroSaved} />}
      {modalInversion && <ModalEditarInversion negocio={negocio} onClose={() => setModalInversion(false)} onSaved={onInversionSaved} />}
      {modalVenta && <LocalVentaModal negocio={negocio} onClose={() => setModalVenta(false)} onSaved={onInversionSaved} />}
    </div>
  )
}

export function Negocios() {
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/negocios").then(r => r.json()).then(setNegocios).finally(() => setLoading(false))
  }, [])

  function updateNegocio(updated: Negocio) {
    setNegocios(ns => ns.map(n => n.id === updated.id ? updated : n))
  }

  const totalInvertido = negocios.reduce((s, n) => s + (n.inversionUSD ?? 0), 0)
  const totalRecuperado = negocios.reduce((s, n) => {
    const retiros = n.retiros.reduce((sr, r) => sr + r.montoUSD, 0)
    return s + retiros + saleCollectedMyPart(n)
  }, 0)

  if (loading) return <p className="text-gray-400 text-sm py-8">Cargando...</p>

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Locales</h1><p className="text-sm text-gray-500 mt-1">Seguimiento de retiros, ventas y cuotas por local</p></div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">Total invertido</p><p className="text-xl font-bold text-gray-900">USD {fmt(totalInvertido)}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">Total recuperado real</p><p className="text-xl font-bold text-green-700">USD {fmt(totalRecuperado, 2)}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">Pendiente de recuperar</p><p className="text-xl font-bold text-orange-700">USD {fmt(totalInvertido - totalRecuperado, 2)}</p></div>
      </div>
      <div className="space-y-4">{negocios.map(n => <NegocioCard key={n.id} negocio={n} onChange={updateNegocio} />)}</div>
    </div>
  )
}
