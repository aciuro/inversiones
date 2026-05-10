"use client"

import { useMemo, useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"

type NegocioVenta = {
  id: string
  nombre: string
  inversionUSD: number | null
  porcentaje: number
  salePriceUSD?: number | null
  saleInstallmentsCount?: number | null
  saleFirstInstallmentDate?: string | null
  saleNotes?: string | null
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function toNumber(value: string) {
  const clean = String(value || "").trim().replace(/\./g, "").replace(/,/g, ".")
  const parsed = Number(clean)
  return Number.isFinite(parsed) ? parsed : 0
}

function myPart(amount: number, porcentaje: number) {
  return (amount * porcentaje) / 100
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function LocalVentaModal({ negocio, onClose, onSaved }: { negocio: NegocioVenta; onClose: () => void; onSaved: (n: any) => void }) {
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10))
  const [salePriceUSD, setSalePriceUSD] = useState(negocio.salePriceUSD?.toString() ?? "")
  const [downPaymentUSD, setDownPaymentUSD] = useState("")
  const [installmentsCount, setInstallmentsCount] = useState(negocio.saleInstallmentsCount?.toString() ?? "")
  const [installmentUSD, setInstallmentUSD] = useState("")
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(negocio.saleFirstInstallmentDate?.slice(0, 10) ?? "")
  const [notes, setNotes] = useState(negocio.saleNotes ?? "")
  const [saving, setSaving] = useState(false)

  const saleTotalUSD = toNumber(salePriceUSD)
  const downUSD = toNumber(downPaymentUSD)
  const count = installmentsCount ? Math.max(0, Math.floor(toNumber(installmentsCount))) : 0
  const eachInstallmentUSD = toNumber(installmentUSD)
  const totalInstallmentsUSD = eachInstallmentUSD * count
  const scheduledUSD = downUSD + totalInstallmentsUSD
  const pendingToScheduleUSD = Math.max(0, saleTotalUSD - scheduledUSD)

  const mySaleTotal = myPart(saleTotalUSD, negocio.porcentaje)
  const myDownPayment = myPart(downUSD, negocio.porcentaje)
  const myInstallmentsTotal = myPart(totalInstallmentsUSD, negocio.porcentaje)
  const myInvestment = myPart(negocio.inversionUSD ?? 0, negocio.porcentaje)
  const myGain = mySaleTotal - myInvestment
  const roi = myInvestment > 0 ? (myGain / myInvestment) * 100 : null

  const previewRows = useMemo(() => {
    if (!firstInstallmentDate || count <= 0 || !installmentUSD) return []
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(firstInstallmentDate)
      d.setMonth(d.getMonth() + i)
      return { n: i + 1, fecha: d.toISOString(), usd: eachInstallmentUSD }
    })
  }, [firstInstallmentDate, count, installmentUSD, eachInstallmentUSD])

  async function guardarVenta() {
    if (saving) return
    if (!saleTotalUSD || saleTotalUSD <= 0) {
      toast.error("Cargá el valor total de venta en USD")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/negocios/${negocio.id}/venta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soldAt,
          salePriceUSD: saleTotalUSD,
          downPaymentUSD: downUSD || null,
          installmentsCount: count || null,
          installmentUSD: eachInstallmentUSD || null,
          firstInstallmentDate: firstInstallmentDate || null,
          notes: notes || null,
          paidInstallments: [],
        }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || payload?.details || `Error ${res.status}`)

      onSaved(payload)
      toast.success("Local marcado como vendido")
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar la venta")
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
            <p className="text-sm text-gray-500 mt-1">
              Cargá la venta en USD por el 100% del local. La app calcula tu parte con el {fmt(negocio.porcentaje, 2)}%.
            </p>
          </div>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-5">
          <Section title="Venta total del local">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha de venta">
                <input type="date" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Valor total de venta 100% (USD)">
                <input type="text" inputMode="decimal" value={salePriceUSD} onChange={(e) => setSalePriceUSD(e.target.value)} placeholder="Ej: 70000" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoBox label="Venta 100%" value={`USD ${fmt(saleTotalUSD, 2)}`} />
              <InfoBox label="Tu porcentaje" value={`${fmt(negocio.porcentaje, 2)}%`} />
              <InfoBox label="Tu parte venta" value={`USD ${fmt(mySaleTotal, 2)}`} />
            </div>
          </Section>

          <Section title="Forma de cobro en USD">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Anticipo recibido (USD)">
                <input type="text" inputMode="decimal" value={downPaymentUSD} onChange={(e) => setDownPaymentUSD(e.target.value)} placeholder="Ej: 25000" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
              <InfoBox label="Tu parte del anticipo" value={`USD ${fmt(myDownPayment, 2)}`} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Cantidad de cuotas">
                <input type="text" inputMode="numeric" value={installmentsCount} onChange={(e) => setInstallmentsCount(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Valor de cada cuota (USD)">
                <input type="text" inputMode="decimal" value={installmentUSD} onChange={(e) => setInstallmentUSD(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Primera cuota">
                <input type="date" value={firstInstallmentDate} onChange={(e) => setFirstInstallmentDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoBox label="Total cuotas" value={`USD ${fmt(totalInstallmentsUSD, 2)}`} />
              <InfoBox label="Tu parte cuotas" value={`USD ${fmt(myInstallmentsTotal, 2)}`} />
              <InfoBox label="Falta calendarizar" value={`USD ${fmt(pendingToScheduleUSD, 2)}`} />
            </div>

            {previewRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr><th className="p-3 text-left">Cuota</th><th className="p-3 text-left">Fecha</th><th className="p-3 text-right">USD</th><th className="p-3 text-right">Mi parte</th></tr>
                  </thead>
                  <tbody>{previewRows.map((r) => <tr key={r.n} className="border-t"><td className="p-3">#{r.n}</td><td className="p-3">{fmtDate(r.fecha)}</td><td className="p-3 text-right">USD {fmt(r.usd, 2)}</td><td className="p-3 text-right font-medium">USD {fmt(myPart(r.usd, negocio.porcentaje), 2)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </Section>

          <Field label="Notas de venta">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm min-h-20" placeholder="Ej: condiciones, fechas, comprador, observaciones..." />
          </Field>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 grid gap-2 sm:grid-cols-4">
            <InfoMini label="Venta 100%" value={`USD ${fmt(saleTotalUSD, 2)}`} />
            <InfoMini label="Mi parte" value={`USD ${fmt(mySaleTotal, 2)}`} />
            <InfoMini label="Ganancia mi parte" value={`USD ${fmt(myGain, 2)}`} />
            <InfoMini label="ROI mi parte" value={roi === null ? "—" : `${roi >= 0 ? "+" : ""}${fmt(roi, 1)}%`} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="button" disabled={saving} onClick={guardarVenta} className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar venta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>{children}</div> }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border p-4 space-y-3"><p className="font-semibold text-gray-900">{title}</p>{children}</div> }
function InfoBox({ label, value }: { label: string; value: string }) { return <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm"><span className="text-gray-500">{label}: </span><span className="font-semibold text-blue-700">{value}</span></div> }
function InfoMini({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-emerald-700">{label}</p><p className="font-bold text-emerald-950">{value}</p></div> }
