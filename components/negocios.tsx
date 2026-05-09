"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react"
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
  status?: string
  soldAt?: string | null
  salePriceUSD?: number | null
  saleDownPaymentARS?: number | null
  saleDownPaymentExchangeRate?: number | null
  saleDownPaymentUSD?: number | null
  saleInstallmentsCount?: number | null
  saleInstallmentARS?: number | null
  saleInstallmentExchangeRate?: number | null
  saleInstallmentUSD?: number | null
  saleFirstInstallmentDate?: string | null
  saleNotes?: string | null
  retiros: Retiro[]
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function myPart(amount: number, porcentaje: number) {
  return amount * porcentaje / 100
}

function ModalRetiro({ negocioId, onClose, onSaved }: { negocioId: string; onClose: () => void; onSaved: (r: Retiro) => void }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [montoARS, setMontoARS] = useState("")
  const [tipoCambio, setTipoCambio] = useState("")
  const [nota, setNota] = useState("")
  const [saving, setSaving] = useState(false)
  const montoUSD = montoARS && tipoCambio ? toNumber(montoARS) / toNumber(tipoCambio) : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!montoARS || !tipoCambio) return
    setSaving(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/retiros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, montoARS: toNumber(montoARS), tipoCambio: toNumber(tipoCambio), nota }),
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Registrar retiro</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input" required /></Field>
          <Field label="Monto retirado (ARS $)"><input type="number" value={montoARS} onChange={e => setMontoARS(e.target.value)} placeholder="500000" className="input" required /></Field>
          <Field label="Dólar blue"><input type="number" value={tipoCambio} onChange={e => setTipoCambio(e.target.value)} placeholder="1250" step="0.01" className="input" required /></Field>
          {montoUSD !== null && <InfoBox label="Equivalente" value={`USD ${fmt(montoUSD, 2)}`} />}
          <Field label="Nota"><input value={nota} onChange={e => setNota(e.target.value)} placeholder="ej: Distribución mensual" className="input" /></Field>
          <ModalButtons onClose={onClose} saving={saving} saveText="Guardar" />
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
        body: JSON.stringify({ nombre: negocio.nombre, porcentaje: negocio.porcentaje, inversionUSD: inversionUSD ? toNumber(inversionUSD) : null }),
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Editar inversión</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Inversión total (USD)"><input type="number" value={inversionUSD} onChange={e => setInversionUSD(e.target.value)} placeholder="15000" className="input" /></Field>
          <ModalButtons onClose={onClose} saving={saving} saveText="Guardar" />
        </form>
      </div>
    </div>
  )
}

function ModalVendido({ negocio, onClose, onSaved }: { negocio: Negocio; onClose: () => void; onSaved: (n: Negocio) => void }) {
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10))
  const [salePriceUSD, setSalePriceUSD] = useState(negocio.salePriceUSD?.toString() ?? "")
  const [downARS, setDownARS] = useState(negocio.saleDownPaymentARS?.toString() ?? "")
  const [downRate, setDownRate] = useState(negocio.saleDownPaymentExchangeRate?.toString() ?? "")
  const [installmentsCount, setInstallmentsCount] = useState(negocio.saleInstallmentsCount?.toString() ?? "")
  const [installmentARS, setInstallmentARS] = useState(negocio.saleInstallmentARS?.toString() ?? "")
  const [installmentRate, setInstallmentRate] = useState(negocio.saleInstallmentExchangeRate?.toString() ?? "")
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(negocio.saleFirstInstallmentDate?.slice(0, 10) ?? "")
  const [notes, setNotes] = useState(negocio.saleNotes ?? "")
  const [saving, setSaving] = useState(false)

  const downUSD = downARS && downRate ? toNumber(downARS) / toNumber(downRate) : 0
  const installmentUSD = installmentARS && installmentRate ? toNumber(installmentARS) / toNumber(installmentRate) : 0
  const count = installmentsCount ? Math.max(0, Math.floor(toNumber(installmentsCount))) : 0
  const totalFutureUSD = installmentUSD * count
  const collectedUSD = downUSD
  const saleUSD = salePriceUSD ? toNumber(salePriceUSD) : collectedUSD + totalFutureUSD
  const totalToCollectUSD = collectedUSD + totalFutureUSD
  const myCollected = myPart(collectedUSD, negocio.porcentaje)
  const myFuture = myPart(totalFutureUSD, negocio.porcentaje)
  const myTotal = myPart(totalToCollectUSD, negocio.porcentaje)
  const myInvestment = myPart(negocio.inversionUSD ?? 0, negocio.porcentaje)
  const roi = myInvestment > 0 ? ((myTotal - myInvestment) / myInvestment) * 100 : null

  const previewRows = useMemo(() => {
    if (!firstInstallmentDate || count <= 0 || !installmentARS) return []
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(firstInstallmentDate)
      d.setMonth(d.getMonth() + i)
      return { n: i + 1, fecha: d.toISOString(), ars: toNumber(installmentARS), usd: installmentUSD }
    })
  }, [firstInstallmentDate, count, installmentARS, installmentUSD])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/negocios/${negocio.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "sold",
          soldAt,
          salePriceUSD: saleUSD || null,
          saleDownPaymentARS: downARS ? toNumber(downARS) : null,
          saleDownPaymentExchangeRate: downRate ? toNumber(downRate) : null,
          saleInstallmentsCount: count || null,
          saleInstallmentARS: installmentARS ? toNumber(installmentARS) : null,
          saleInstallmentExchangeRate: installmentRate ? toNumber(installmentRate) : null,
          saleFirstInstallmentDate: firstInstallmentDate || null,
          saleNotes: notes || null,
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      onSaved(updated)
      toast.success("Local marcado como vendido")
      onClose()
    } catch {
      toast.error("Error al guardar la venta")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h3 className="font-semibold text-xl">Marcar vendido — {negocio.nombre}</h3>
            <p className="text-sm text-gray-500 mt-1">Se calcula tu parte con el {fmt(negocio.porcentaje, 2)}%.</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha de venta"><input type="date" value={soldAt} onChange={e => setSoldAt(e.target.value)} className="input" required /></Field>
            <Field label="Valor total de venta (USD)"><input type="number" value={salePriceUSD} onChange={e => setSalePriceUSD(e.target.value)} placeholder="Opcional" className="input" /></Field>
          </div>

          <Section title="Anticipo cobrado">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Anticipo (ARS $)"><input type="number" value={downARS} onChange={e => setDownARS(e.target.value)} placeholder="Ej: 10000000" className="input" /></Field>
              <Field label="Tipo de cambio"><input type="number" value={downRate} onChange={e => setDownRate(e.target.value)} placeholder="Ej: 1200" className="input" /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoBox label="Anticipo en USD" value={`USD ${fmt(downUSD, 2)}`} />
              <InfoBox label="Tu parte del anticipo" value={`USD ${fmt(myCollected, 2)}`} />
            </div>
          </Section>

          <Section title="Cuotas futuras">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Cantidad"><input type="number" value={installmentsCount} onChange={e => setInstallmentsCount(e.target.value)} className="input" /></Field>
              <Field label="Monto c/u (ARS)"><input type="number" value={installmentARS} onChange={e => setInstallmentARS(e.target.value)} className="input" /></Field>
              <Field label="Cambio estimado"><input type="number" value={installmentRate} onChange={e => setInstallmentRate(e.target.value)} className="input" /></Field>
              <Field label="Primera cuota"><input type="date" value={firstInstallmentDate} onChange={e => setFirstInstallmentDate(e.target.value)} className="input" /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoBox label="Total cuotas" value={`USD ${fmt(totalFutureUSD, 2)}`} />
              <InfoBox label="Tu parte futura" value={`USD ${fmt(myFuture, 2)}`} />
              <InfoBox label="ROI estimado" value={roi === null ? "—" : `${roi >= 0 ? "+" : ""}${fmt(roi, 1)}%`} />
            </div>
            {previewRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="p-3 text-left">Cuota</th><th className="p-3 text-left">Fecha</th><th className="p-3 text-right">ARS</th><th className="p-3 text-right">USD est.</th><th className="p-3 text-right">Mi parte</th></tr></thead>
                  <tbody>
                    {previewRows.map(r => <tr key={r.n} className="border-t"><td className="p-3">#{r.n}</td><td className="p-3">{fmtDate(r.fecha)}</td><td className="p-3 text-right">$ {fmt(r.ars)}</td><td className="p-3 text-right">USD {fmt(r.usd, 2)}</td><td className="p-3 text-right font-medium">USD {fmt(myPart(r.usd, negocio.porcentaje), 2)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Field label="Notas de venta"><textarea value={notes} onChange={e => setNotes(e.target.value)} className="input min-h-20" placeholder="Ej: anticipo recibido, cuotas mensuales, condiciones..." /></Field>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 grid gap-2 sm:grid-cols-3">
            <InfoMini label="A cobrar total" value={`USD ${fmt(totalToCollectUSD, 2)}`} />
            <InfoMini label="Tu total" value={`USD ${fmt(myTotal, 2)}`} />
            <InfoMini label="Ganancia estimada" value={`USD ${fmt(myTotal - myInvestment, 2)}`} />
          </div>

          <ModalButtons onClose={onClose} saving={saving} saveText="Guardar venta" />
        </form>
      </div>
    </div>
  )
}

function NegocioCard({ negocio, onChange }: { negocio: Negocio; onChange: (n: Negocio) => void }) {
  const [open, setOpen] = useState(false)
  const [modalRetiro, setModalRetiro] = useState(false)
  const [modalInversion, setModalInversion] = useState(false)
  const [modalVendido, setModalVendido] = useState(false)
  const isSold = negocio.status === "sold"
  const totalRecuperadoUSD = negocio.retiros.reduce((s, r) => s + r.montoUSD, 0)
  const anticipoUSD = negocio.saleDownPaymentUSD ?? 0
  const cuotasVentaUSD = (negocio.saleInstallmentUSD ?? 0) * (negocio.saleInstallmentsCount ?? 0)
  const totalVentaUSD = anticipoUSD + cuotasVentaUSD
  const totalCobradoUSD = totalRecuperadoUSD + anticipoUSD
  const inversion = negocio.inversionUSD ?? 0
  const pendienteUSD = inversion - totalRecuperadoUSD
  const pendienteVentaUSD = Math.max(0, cuotasVentaUSD)
  const porcentajeRecuperado = inversion ? (totalRecuperadoUSD / inversion) * 100 : null
  const gananciaVenta = totalVentaUSD ? myPart(totalVentaUSD, negocio.porcentaje) - myPart(inversion, negocio.porcentaje) : null

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

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isSold ? "border-emerald-200" : ""}`}>
      <div className="px-5 py-5">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900">{negocio.nombre}</h2>
              {isSold && <span className="text-xs rounded-full bg-emerald-100 text-emerald-700 px-2 py-1 font-bold">VENDIDO</span>}
            </div>
            <p className="text-sm text-gray-500">Mi participación: {fmt(negocio.porcentaje, 2)}%</p>
            {isSold && negocio.soldAt && <p className="text-xs text-emerald-700 mt-1">Venta: {fmtDate(negocio.soldAt)}</p>}
          </div>
          <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {open ? "Ocultar" : "Ver detalle"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Invertí" value={negocio.inversionUSD != null ? `USD ${fmt(negocio.inversionUSD)}` : "—"} action={!isSold ? <button onClick={() => setModalInversion(true)} className="text-gray-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></button> : null} />
          <Metric label={isSold ? "Cobrado" : "Recuperé"} value={`USD ${fmt(totalCobradoUSD, 2)}`} tone="green" />
          <Metric label={isSold ? "Pendiente cobro" : "Pendiente"} value={isSold ? `USD ${fmt(pendienteVentaUSD, 2)}` : pendienteUSD <= 0 ? "¡Recuperado!" : `USD ${fmt(pendienteUSD, 2)}`} tone={isSold || pendienteUSD <= 0 ? "green" : "orange"} />
          <Metric label={isSold ? "Ganancia mi parte" : "% Recuperado"} value={isSold ? (gananciaVenta === null ? "—" : `USD ${fmt(gananciaVenta, 2)}`) : porcentajeRecuperado === null ? "—" : `${fmt(porcentajeRecuperado, 1)}%`} tone={isSold ? "blue" : undefined} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => setModalRetiro(true)} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"><Plus className="w-4 h-4" /> Agregar retiro</button>
          {!isSold && <button onClick={() => setModalVendido(true)} className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-900"><CheckCircle2 className="w-4 h-4" /> Marcar vendido</button>}
          {isSold && <button onClick={() => setModalVendido(true)} className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-900"><Pencil className="w-4 h-4" /> Editar venta</button>}
        </div>
      </div>

      {open && (
        <div className="border-t bg-gray-50/40">
          {isSold && (
            <div className="px-5 py-4 border-b bg-emerald-50/60">
              <p className="font-semibold text-sm text-emerald-900 mb-3">Timeline de venta</p>
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <TimelineItem done label="Local vendido" value={negocio.soldAt ? fmtDate(negocio.soldAt) : "—"} />
                <TimelineItem done={anticipoUSD > 0} label="Anticipo" value={`USD ${fmt(anticipoUSD, 2)}`} />
                <TimelineItem done={pendienteVentaUSD === 0} label="Cuotas pendientes" value={`USD ${fmt(pendienteVentaUSD, 2)}`} />
              </div>
              {negocio.saleNotes && <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{negocio.saleNotes}</p>}
            </div>
          )}
          {negocio.retiros.length === 0 ? <p className="text-sm text-gray-400 px-5 py-4">Sin retiros registrados aún.</p> : <RetirosTable retiros={negocio.retiros} onDelete={eliminarRetiro} />}
        </div>
      )}

      {modalRetiro && <ModalRetiro negocioId={negocio.id} onClose={() => setModalRetiro(false)} onSaved={r => onChange({ ...negocio, retiros: [r, ...negocio.retiros] })} />}
      {modalInversion && <ModalEditarInversion negocio={negocio} onClose={() => setModalInversion(false)} onSaved={onChange} />}
      {modalVendido && <ModalVendido negocio={negocio} onClose={() => setModalVendido(false)} onSaved={onChange} />}
    </div>
  )
}

function RetirosTable({ retiros, onDelete }: { retiros: Retiro[]; onDelete: (id: string) => void }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left"><th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase">Fecha</th><th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase">ARS</th><th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase">Blue</th><th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase">USD</th><th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase">Nota</th><th /></tr></thead><tbody className="divide-y divide-gray-100 bg-white">{retiros.map(r => <tr key={r.id}><td className="px-5 py-3 text-gray-700">{fmtDate(r.fecha)}</td><td className="px-5 py-3">$ {fmt(r.montoARS)}</td><td className="px-5 py-3 text-gray-500">${fmt(r.tipoCambio)}</td><td className="px-5 py-3 font-medium text-green-700">USD {fmt(r.montoUSD, 2)}</td><td className="px-5 py-3 text-gray-400">{r.nota ?? "—"}</td><td className="px-5 py-3"><button onClick={() => onDelete(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td></tr>)}</tbody></table></div>
}

export function Negocios() {
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch("/api/negocios").then(r => r.json()).then(setNegocios).finally(() => setLoading(false)) }, [])
  const totalInvertido = negocios.reduce((s, n) => s + (n.inversionUSD ?? 0), 0)
  const totalRecuperado = negocios.reduce((s, n) => s + n.retiros.reduce((sr, r) => sr + r.montoUSD, 0) + (n.saleDownPaymentUSD ?? 0), 0)
  if (loading) return <p className="text-gray-400 text-sm py-8">Cargando...</p>
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Locales</h1><p className="text-sm text-gray-500 mt-1">Seguimiento de retiros, ventas y recupero por local</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Summary label="Total invertido" value={`USD ${fmt(totalInvertido)}`} /><Summary label="Total recuperado" value={`USD ${fmt(totalRecuperado, 2)}`} tone="green" /><Summary label="Pendiente de recuperar" value={`USD ${fmt(totalInvertido - totalRecuperado, 2)}`} tone="orange" /></div><div className="space-y-4">{negocios.map(n => <NegocioCard key={n.id} negocio={n} onChange={updated => setNegocios(ns => ns.map(x => x.id === updated.id ? updated : x))} />)}</div></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>{children}</div> }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border p-4 space-y-3"><p className="font-semibold text-gray-900">{title}</p>{children}</div> }
function InfoBox({ label, value }: { label: string; value: string }) { return <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm"><span className="text-gray-500">{label}: </span><span className="font-semibold text-blue-700">{value}</span></div> }
function InfoMini({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-emerald-700">{label}</p><p className="font-bold text-emerald-950">{value}</p></div> }
function ModalButtons({ onClose, saving, saveText }: { onClose: () => void; saving: boolean; saveText: string }) { return <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 border rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button><button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? "Guardando..." : saveText}</button></div> }
function Metric({ label, value, tone, action }: { label: string; value: string; tone?: "green" | "orange" | "blue"; action?: React.ReactNode }) { const cls = tone === "green" ? "bg-green-50 text-green-700" : tone === "orange" ? "bg-orange-50 text-orange-700" : tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-900"; return <div className={`rounded-xl p-3 ${cls}`}><p className="text-xs text-gray-500 mb-1">{label}</p><div className="flex items-center gap-1"><p className="font-semibold">{value}</p>{action}</div></div> }
function Summary({ label, value, tone }: { label: string; value: string; tone?: "green" | "orange" }) { return <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">{label}</p><p className={`text-xl font-bold ${tone === "green" ? "text-green-700" : tone === "orange" ? "text-orange-700" : "text-gray-900"}`}>{value}</p></div> }
function TimelineItem({ done, label, value }: { done: boolean; label: string; value: string }) { return <div className="flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${done ? "bg-emerald-500" : "bg-gray-300"}`} /><div><p className="text-xs text-gray-500">{label}</p><p className="font-semibold text-gray-900">{value}</p></div></div> }
