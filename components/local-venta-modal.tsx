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
  saleDownPaymentARS?: number | null
  saleDownPaymentExchangeRate?: number | null
  saleInstallmentsCount?: number | null
  saleInstallmentARS?: number | null
  saleInstallmentExchangeRate?: number | null
  saleFirstInstallmentDate?: string | null
  saleNotes?: string | null
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function myPart(amount: number, porcentaje: number) {
  return (amount * porcentaje) / 100
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function LocalVentaModal({
  negocio,
  onClose,
  onSaved,
}: {
  negocio: NegocioVenta
  onClose: () => void
  onSaved: (n: any) => void
}) {
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10))
  const [salePriceUSD, setSalePriceUSD] = useState(negocio.salePriceUSD?.toString() ?? "")
  const [downARS, setDownARS] = useState(negocio.saleDownPaymentARS?.toString() ?? "")
  const [downRate, setDownRate] = useState(negocio.saleDownPaymentExchangeRate?.toString() ?? "")
  const [installmentsCount, setInstallmentsCount] = useState(negocio.saleInstallmentsCount?.toString() ?? "")
  const [installmentARS, setInstallmentARS] = useState(negocio.saleInstallmentARS?.toString() ?? "")
  const [installmentRate, setInstallmentRate] = useState(negocio.saleInstallmentExchangeRate?.toString() ?? "")
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(
    negocio.saleFirstInstallmentDate?.slice(0, 10) ?? ""
  )
  const [notes, setNotes] = useState(negocio.saleNotes ?? "")
  const [saving, setSaving] = useState(false)

  const downUSD = downARS && downRate ? toNumber(downARS) / toNumber(downRate) : 0
  const installmentUSD =
    installmentARS && installmentRate ? toNumber(installmentARS) / toNumber(installmentRate) : 0
  const count = installmentsCount ? Math.max(0, Math.floor(toNumber(installmentsCount))) : 0
  const totalFutureUSD = installmentUSD * count
  const totalToCollectUSD = downUSD + totalFutureUSD
  const saleUSD = salePriceUSD ? toNumber(salePriceUSD) : totalToCollectUSD
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
            <p className="text-sm text-gray-500 mt-1">
              Se calcula tu parte con el {fmt(negocio.porcentaje, 2)}%.
            </p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha de venta">
              <input
                type="date"
                value={soldAt}
                onChange={(e) => setSoldAt(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </Field>

            <Field label="Valor total de venta (USD)">
              <input
                type="number"
                value={salePriceUSD}
                onChange={(e) => setSalePriceUSD(e.target.value)}
                placeholder="Opcional"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Section title="Anticipo cobrado">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Anticipo (ARS $)">
                <input
                  type="number"
                  value={downARS}
                  onChange={(e) => setDownARS(e.target.value)}
                  placeholder="Ej: 10000000"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Dólar blue compra">
                <input
                  type="number"
                  value={downRate}
                  onChange={(e) => setDownRate(e.target.value)}
                  placeholder="Ej: 1200"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoBox label="Anticipo en USD" value={`USD ${fmt(downUSD, 2)}`} />
              <InfoBox
                label="Tu parte del anticipo"
                value={`USD ${fmt(myPart(downUSD, negocio.porcentaje), 2)}`}
              />
            </div>
          </Section>

          <Section title="Cuotas futuras">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Cantidad">
                <input
                  type="number"
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Monto c/u (ARS)">
                <input
                  type="number"
                  value={installmentARS}
                  onChange={(e) => setInstallmentARS(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Blue compra">
                <input
                  type="number"
                  value={installmentRate}
                  onChange={(e) => setInstallmentRate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Primera cuota">
                <input
                  type="date"
                  value={firstInstallmentDate}
                  onChange={(e) => setFirstInstallmentDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoBox label="Total cuotas" value={`USD ${fmt(totalFutureUSD, 2)}`} />
              <InfoBox
                label="Tu parte futura"
                value={`USD ${fmt(myPart(totalFutureUSD, negocio.porcentaje), 2)}`}
              />
              <InfoBox
                label="ROI estimado"
                value={roi === null ? "—" : `${roi >= 0 ? "+" : ""}${fmt(roi, 1)}%`}
              />
            </div>

            {previewRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="p-3 text-left">Cuota</th>
                      <th className="p-3 text-left">Fecha</th>
                      <th className="p-3 text-right">ARS</th>
                      <th className="p-3 text-right">USD est.</th>
                      <th className="p-3 text-right">Mi parte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r) => (
                      <tr key={r.n} className="border-t">
                        <td className="p-3">#{r.n}</td>
                        <td className="p-3">{fmtDate(r.fecha)}</td>
                        <td className="p-3 text-right">$ {fmt(r.ars)}</td>
                        <td className="p-3 text-right">USD {fmt(r.usd, 2)}</td>
                        <td className="p-3 text-right font-medium">
                          USD {fmt(myPart(r.usd, negocio.porcentaje), 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Field label="Notas de venta">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-20"
              placeholder="Ej: anticipo recibido, cuotas mensuales, condiciones..."
            />
          </Field>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 grid gap-2 sm:grid-cols-3">
            <InfoMini label="A cobrar total" value={`USD ${fmt(totalToCollectUSD, 2)}`} />
            <InfoMini label="Tu total" value={`USD ${fmt(myTotal, 2)}`} />
            <InfoMini label="Ganancia estimada" value={`USD ${fmt(myTotal - myInvestment, 2)}`} />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar venta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <p className="font-semibold text-gray-900">{title}</p>
      {children}
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm">
      <span className="text-gray-500">{label}: </span>
      <span className="font-semibold text-blue-700">{value}</span>
    </div>
  )
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-emerald-700">{label}</p>
      <p className="font-bold text-emerald-950">{value}</p>
    </div>
  )
}
