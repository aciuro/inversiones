"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { editarCuotaProyecto, editarRefuerzoProyecto } from "@/app/actions/proyecto-manual"

type Member = {
  userId: string
  sharePercent: number
  user: { id: string; name: string; email: string }
}

type Installment = {
  id: string
  number: number
  amount: number
  amountUSD: number | null
  dueDate: string
  paidAt: string | null
  paidByUserId: string | null
}

type Reinforcement = {
  id: string
  amount: number
  amountUSD: number | null
  dueDate: string
  paidAt: string | null
  label: string | null
}

type Project = {
  id: string
  name: string
  currency: string
  members: Member[]
  installments: Installment[]
  reinforcements: Reinforcement[]
}

type EditTarget =
  | { kind: "cuota"; item: Installment }
  | { kind: "refuerzo"; item: Reinforcement }
  | null

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 })
}

function dateOnly(value: string) {
  return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function firstName(name: string) {
  return name.split(" ")[0]
}

export function ProyectoEditorManual({ proyecto }: { proyecto: Project }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [target, setTarget] = useState<EditTarget>(null)
  const [amount, setAmount] = useState("")
  const [amountUSD, setAmountUSD] = useState("")
  const [paid, setPaid] = useState(false)
  const [paidByUserId, setPaidByUserId] = useState("")

  const isBRL = proyecto.currency === "BRL"
  const hasPartners = proyecto.members.length > 1

  function openCuota(cuota: Installment) {
    setTarget({ kind: "cuota", item: cuota })
    setAmount(String(cuota.amount ?? ""))
    setAmountUSD(cuota.amountUSD != null ? String(cuota.amountUSD) : "")
    setPaid(Boolean(cuota.paidAt))
    setPaidByUserId(cuota.paidByUserId ?? "")
  }

  function openRefuerzo(refuerzo: Reinforcement) {
    setTarget({ kind: "refuerzo", item: refuerzo })
    setAmount(String(refuerzo.amount ?? ""))
    setAmountUSD(refuerzo.amountUSD != null ? String(refuerzo.amountUSD) : "")
    setPaid(Boolean(refuerzo.paidAt))
    setPaidByUserId("")
  }

  function closeModal() {
    setTarget(null)
    setAmount("")
    setAmountUSD("")
    setPaid(false)
    setPaidByUserId("")
  }

  function save() {
    if (!target) return

    startTransition(async () => {
      try {
        if (target.kind === "cuota") {
          await editarCuotaProyecto({
            projectId: proyecto.id,
            cuotaId: target.item.id,
            amount,
            amountUSD,
            paid,
            paidByUserId: paid ? paidByUserId || null : null,
          })
          toast.success("Cuota actualizada")
        } else {
          await editarRefuerzoProyecto({
            projectId: proyecto.id,
            refuerzoId: target.item.id,
            amount,
            amountUSD,
            paid,
          })
          toast.success("Refuerzo actualizado")
        }
        closeModal()
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar")
      }
    })
  }

  return (
    <>
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Editor manual</h2>
          <p className="text-sm text-gray-500">
            Usalo para corregir cuotas y refuerzos sin depender de la IA. Podés cambiar monto, equivalente USD, estado y pagador.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Cuotas</h3>
          {proyecto.installments.length === 0 ? (
            <p className="text-sm text-gray-400">Sin cuotas cargadas.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Cuota</th>
                    <th className="px-3 py-2 text-left">Vence</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-right">USD</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left">Pagador</th>
                    <th className="px-3 py-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {proyecto.installments.map(c => {
                    const payer = proyecto.members.find(m => m.userId === c.paidByUserId)
                    return (
                      <tr key={c.id}>
                        <td className="px-3 py-2 font-semibold">#{c.number}</td>
                        <td className="px-3 py-2 text-gray-500">{dateOnly(c.dueDate)}</td>
                        <td className="px-3 py-2 text-right">{proyecto.currency} {fmt(c.amount)}</td>
                        <td className="px-3 py-2 text-right">USD {fmt(c.amountUSD)}</td>
                        <td className="px-3 py-2">{c.paidAt ? "Pagada" : "Pendiente"}</td>
                        <td className="px-3 py-2">{payer ? firstName(payer.user.name) : c.paidAt ? "Repartido" : "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => openCuota(c)}>Editar</Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {proyecto.reinforcements.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Refuerzos</h3>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Refuerzo</th>
                    <th className="px-3 py-2 text-left">Vence</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-right">USD</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {proyecto.reinforcements.map(r => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-semibold">{r.label || "Refuerzo"}</td>
                      <td className="px-3 py-2 text-gray-500">{dateOnly(r.dueDate)}</td>
                      <td className="px-3 py-2 text-right">{proyecto.currency} {fmt(r.amount)}</td>
                      <td className="px-3 py-2 text-right">USD {fmt(r.amountUSD)}</td>
                      <td className="px-3 py-2">{r.paidAt ? "Pagado" : "Pendiente"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => openRefuerzo(r)}>Editar</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">
              Editar {target.kind === "cuota" ? `cuota #${target.item.number}` : target.item.label || "refuerzo"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">Modificá los datos reales del pago.</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Monto original ({proyecto.currency})</label>
                <Input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Equivalente USD</label>
                <Input value={amountUSD} onChange={e => setAmountUSD(e.target.value)} inputMode="decimal" placeholder={isBRL ? "Ej: 289" : "Opcional"} />
              </div>

              <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                <input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} />
                Marcar como pagado
              </label>

              {target.kind === "cuota" && hasPartners && paid && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">¿Quién pagó?</label>
                  <select
                    value={paidByUserId}
                    onChange={e => setPaidByUserId(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">Repartido por porcentaje</option>
                    {proyecto.members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.user.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeModal}>Cancelar</Button>
              <Button className="flex-1" disabled={isPending} onClick={save}>{isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
