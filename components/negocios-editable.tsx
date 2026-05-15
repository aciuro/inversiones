"use client"

import { useState, useEffect, useMemo } from "react"
import { Trash2, Plus, X, ChevronDown, ChevronUp, Pencil, CheckCircle2 } from "lucide-react"
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

type InstallmentPayment = {
  amountUSD?: number | null
  socios?: string | null
  note?: string | null
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
  saleInstallmentPayments?: Record<string, InstallmentPayment>
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

function parseAmount(value: string) {
  const cleaned = value.trim().replace(/\./g, "").replace(/,/g, ".")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function paidInstallmentsTotal(n: Negocio) {
  const installment = n.saleInstallmentUSD ?? 0
  const paid = n.saleInstallmentsPaid ?? []
  const payments = n.saleInstallmentPayments ?? {}
  return paid.reduce((sum, number) => {
    const savedAmount = payments[String(number)]?.amountUSD
    return sum + (typeof savedAmount === "number" && Number.isFinite(savedAmount) ? savedAmount : installment)
  }, 0)
}

function saleCollectedMyPart(n: Negocio) {
  const down = n.saleDownPaymentUSD ?? 0
  return myPart(down + paidInstallmentsTotal(n), n.porcentaje)
}

function salePendingMyPart(n: Negocio) {
  const salePrice = n.salePriceUSD ?? 0
  const down = n.saleDownPaymentUSD ?? 0
  const pending = Math.max(0, salePrice - (down + paidInstallmentsTotal(n)))
  return myPart(pending, n.porcentaje)
}

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

function VentaResumen({ negocio }: { negocio: Negocio }) {
  const salePrice = negocio.salePriceUSD ?? 0
  const down = negocio.saleDownPaymentUSD ?? 0
  const count = negocio.saleInstallmentsCount ?? 0
  const paidCount = negocio.saleInstallmentsPaid?.length ?? 0
  const paidTotalUSD = down + paidInstallmentsTotal(negocio)
  const pendingUSD = Math.max(0, salePrice - paidTotalUSD)
  const mySale = myPart(salePrice, negocio.porcentaje)
  const myPending = myPart(pendingUSD, negocio.porcentaje)
  const myPaid = myPart(paidTotalUSD, negocio.porcentaje)
  const myDown = myPart(down, negocio.porcentaje)
  const myInvestment = myPart(negocio.inversionUSD ?? 0, negocio.porcentaje)
  const roi = myInvestment > 0 ? ((mySale - myInvestment) / myInvestment) * 100 : null

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
    </div>
  )
}

function CuotasDetalle({ negocio, onChange }: { negocio: Negocio; onChange: (n: Negocio) => void }) {
  const [updating, setUpdating] = useState<number | null>(null)
  const payments = negocio.saleInstallmentPayments ?? {}
  const count = negocio.saleInstallmentsCount ?? 0
  const installment = negocio.saleInstallmentUSD ?? 0
  const paid = negocio.saleInstallmentsPaid ?? []
  const [drafts, setDrafts] = useState<Record<string, { amount: string; socios: string; note: string }>>({})

  useEffect(() => {
    const next: Record<string, { amount: string; socios: string; note: string }> = {}
    for (let i = 1; i <= count; i++) {
      const saved = payments[String(i)]
      next[String(i)] = {
        amount: saved?.amountUSD != null ? String(saved.amountUSD) : String(installment || ""),
        socios: saved?.socios ?? "",
        note: saved?.note ?? "",
      }
    }
    setDrafts(next)
  }, [count, installment, JSON.stringify(payments)])

  const rows = useMemo(() => {
    if (!negocio.saleFirstInstallmentDate || count <= 0 || installment <= 0) return []
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(negocio.saleFirstInstallmentDate as string)
      d.setMonth(d.getMonth() + i)
      return { number: i + 1, month: d.toISOString(), paid: paid.includes(i + 1) }
    })
  }, [negocio.saleFirstInstallmentDate, count, installment, paid])

  function updateDraft(number: number, field: "amount" | "socios" | "note", value: string) {
    setDrafts(prev => ({ ...prev, [String(number)]: { ...(prev[String(number)] ?? { amount: "", socios: "", note: "" }), [field]: value } }))
  }

  async function saveInstallment(number: number, markPaid = true) {
    if (updating) return
    setUpdating(number)
    const current = drafts[String(number)] ?? { amount: String(installment), socios: "", note: "" }
    const amountUSD = parseAmount(current.amount)
    const nextPaid = markPaid
      ? paid.includes(number) ? paid : [...paid, number].sort((a, b) => a - b)
      : paid.filter(n => n !== number)
    const nextPayments = {
      ...payments,
      [String(number)]: {
        amountUSD: amountUSD || installment,
        socios: current.socios || null,
        note: current.note || null,
      },
    }

    try {
      const res = await fetch(`/api/negocios/${negocio.id}/venta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soldAt: negocio.soldAt,
          salePriceUSD: negocio.salePriceUSD ?? 0,
          downPaymentUSD: negocio.saleDownPaymentUSD ?? null,
          installmentsCount: count || null,
          installmentUSD: installment || null,
          firstInstallmentDate: negocio.saleFirstInstallmentDate || null,
          notes: negocio.saleNotes || null,
          paidInstallments: nextPaid,
          installmentPayments: nextPayments,
        }),
      })
      const updated = await res.json()
      if (!res.ok) throw new Error(updated?.error || "No se pudo actualizar la cuota")
      onChange({ ...negocio, ...updated })
      toast.success(markPaid ? "Cuota guardada como pagada" : "Cuota marcada como pendiente")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar cuota")
    } finally {
      setUpdating(null)
    }
  }

  if (rows.length === 0) return <p className="text-sm text-gray-400 px-6 py-4">Sin cuotas cargadas.</p>

  return (
    <div className="space-y-3 px-4 pb-4">
      {rows.map(row => {
        const draft = drafts[String(row.number)] ?? { amount: String(installment), socios: "", note: "" }
        return (
          <div key={row.number} className={`rounded-2xl border p-4 ${row.paid ? "bg-green-50 border-green-200" : "bg-white"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold text-gray-900">Cuota #{row.number} · <span className="capitalize">{fmtMonth(row.month)}</span></p>
                <p className="text-xs text-gray-500">Cuota pactada 100%: USD {fmt(installment, 2)} · Mi parte estimada: USD {fmt(myPart(installment, negocio.porcentaje), 2)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${row.paid ? "bg-green-600 text-white" : "bg-orange-100 text-orange-700"}`}>
                {row.paid ? "Pagada" : "Pendiente"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Monto pagado 100% (USD)</label>
                <input value={draft.amount} onChange={e => updateDraft(row.number, "amount", e.target.value)} inputMode="decimal" className="w-full rounded-lg border px-3 py-2 text-sm" />
                <p className="mt-1 text-xs text-gray-400">Mi parte: USD {fmt(myPart(parseAmount(draft.amount), negocio.porcentaje), 2)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cuánto pagó cada socio</label>
                <input value={draft.socios} onChange={e => updateDraft(row.number, "socios", e.target.value)} placeholder="Ej: Augusto 1.000 / Lucas 1.000" className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nota</label>
                <input value={draft.note} onChange={e => updateDraft(row.number, "note", e.target.value)} placeholder="Ej: transferencia, efectivo..." className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 justify-end">
              {row.paid && (
                <button type="button" disabled={updating === row.number} onClick={() => saveInstallment(row.number, false)} className="rounded-full border px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                  Marcar pendiente
                </button>
              )}
              <button type="button" disabled={updating === row.number} onClick={() => saveInstallment(row.number, true)} className="inline-flex items-center gap-1 rounded-full bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                <CheckCircle2 className="h-3 w-3" />
                {updating === row.number ? "Guardando..." : row.paid ? "Actualizar pago" : "Guardar como paga"}
              </button>
            </div>
          </div>
        )
      })}
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
  const pendienteVentaUSD = isSold ? salePendingMyPart(negocio) : 0
  const pendienteUSD = isSold ? pendienteVentaUSD : Math.max(0, (negocio.inversionUSD ?? 0) - recuperadoRealUSD)
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
            {open ? "Ocultar detalle" : "Ver detalle"}
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
          <div className="rounded-lg p-3 bg-orange-50">
            <p className="text-xs text-gray-500 mb-1">Pendiente a cobrar</p>
            <p className="font-semibold text-orange-700">USD {fmt(pendienteUSD, 2)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">% Recuperado</p>
            {porcentajeRecuperado != null ? <><p className="font-semibold text-blue-700">{fmt(porcentajeRecuperado, 1)}%</p><div className="mt-1 h-1.5 bg-blue-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(porcentajeRecuperado, 100)}%` }} /></div></> : <p className="text-sm text-gray-400">—</p>}
          </div>
        </div>

        {isSold && <VentaResumen negocio={negocio} />}

        <div className="mt-4 flex flex-wrap gap-4">
          <button onClick={() => setModalRetiro(true)} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"><Plus className="w-4 h-4" />Agregar retiro</button>
          <button onClick={() => setModalVenta(true)} className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-800"><Plus className="w-4 h-4" />{isSold ? "Editar venta" : "Marcar vendido"}</button>
        </div>
      </div>

      {open && (
        <div className="border-t bg-gray-50/50">
          <div className="px-6 py-4 border-b">
            <h3 className="font-semibold text-gray-900">Detalle de cobros</h3>
            <p className="text-sm text-gray-500">Acá ves de dónde sale el recuperé real: retiros cobrados + anticipo + cuotas pagadas con monto real.</p>
          </div>

          {isSold && (
            <div className="border-b bg-white">
              <div className="px-6 py-3 flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Cuotas de la venta</h4>
                  <p className="text-xs text-gray-500">Editá el monto realmente pagado y el detalle de socios para cualquier local vendido.</p>
                </div>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-3 py-1">
                  {negocio.saleInstallmentsPaid?.length ?? 0}/{negocio.saleInstallmentsCount ?? 0} pagas
                </span>
              </div>
              <CuotasDetalle negocio={negocio} onChange={onChange} />
            </div>
          )}

          <div className="bg-white">
            <div className="px-6 py-3">
              <h4 className="font-medium text-gray-900">Retiros cobrados</h4>
              <p className="text-xs text-gray-500">Estos son los retiros históricos del local, convertidos a USD con blue compra.</p>
            </div>
            {negocio.retiros.length === 0 ? <p className="text-sm text-gray-400 px-6 pb-4">Sin retiros registrados aún.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-left"><th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th><th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ARS $</th><th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Blue</th><th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">USD</th><th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nota</th><th className="px-6 py-3"></th></tr></thead>
                  <tbody className="divide-y divide-gray-100">{negocio.retiros.map(r => <tr key={r.id} className="hover:bg-gray-50"><td className="px-6 py-3 text-gray-700">{fmtDate(r.fecha)}</td><td className="px-6 py-3 text-gray-700">$ {fmt(r.montoARS)}</td><td className="px-6 py-3 text-gray-500">${fmt(r.tipoCambio)}</td><td className="px-6 py-3 font-medium text-green-700">USD {fmt(r.montoUSD, 2)}</td><td className="px-6 py-3 text-gray-400">{r.nota ?? "—"}</td><td className="px-6 py-3"><button onClick={() => eliminarRetiro(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {modalRetiro && <ModalRetiro negocioId={negocio.id} onClose={() => setModalRetiro(false)} onSaved={onRetiroSaved} />}
      {modalInversion && <ModalEditarInversion negocio={negocio} onClose={() => setModalInversion(false)} onSaved={onInversionSaved} />}
      {modalVenta && <LocalVentaModal negocio={negocio} onClose={() => setModalVenta(false)} onSaved={onInversionSaved} />}
    </div>
  )
}

export function NegociosEditable() {
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
  const totalPendienteACobrar = negocios.reduce((s, n) => s + salePendingMyPart(n), 0)

  if (loading) return <p className="text-gray-400 text-sm py-8">Cargando...</p>

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Locales</h1><p className="text-sm text-gray-500 mt-1">Seguimiento de retiros, ventas y cuotas por local</p></div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">Total invertido</p><p className="text-xl font-bold text-gray-900">USD {fmt(totalInvertido)}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">Total recuperado real</p><p className="text-xl font-bold text-green-700">USD {fmt(totalRecuperado, 2)}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">Pendiente a cobrar</p><p className="text-xl font-bold text-orange-700">USD {fmt(totalPendienteACobrar, 2)}</p></div>
      </div>
      <div className="space-y-4">{negocios.map(n => <NegocioCard key={n.id} negocio={n} onChange={updateNegocio} />)}</div>
    </div>
  )
}
