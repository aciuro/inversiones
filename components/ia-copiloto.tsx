"use client"

import { useState } from "react"
import { Bot, Send, X, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

type BatchItem = {
  installmentId: string
  cuota: number
  amountUSD: number
  paidByUserId: string | null
  paidByName: string | null
}

type ProposedAction =
  | {
      type: "UPDATE_INSTALLMENT_PAYMENT"
      negocioId: string
      negocioNombre: string
      cuota: number
      amountUSD: number
      socios: string | null
      note: string | null
    }
  | {
      type: "UPDATE_PROJECT_INSTALLMENT_SPLIT"
      projectId: string
      projectName: string
      installmentId: string
      cuota: number
      amountUSD: number
      socios: string | null
      note: string | null
    }
  | {
      type: "UPDATE_PROJECT_INSTALLMENTS_BATCH"
      projectId: string
      projectName: string
      items: BatchItem[]
    }
  | Record<string, any>

type Message = {
  role: "user" | "assistant"
  text: string
  proposedAction?: ProposedAction | null
}

function actionTitle(action: ProposedAction) {
  if (action.type === "UPDATE_PROJECT_INSTALLMENTS_BATCH") return `Aplicar ${action.items.length} cambios`
  return "Aplicar cambio"
}

function actionEndpoint(action: ProposedAction) {
  if (action.type === "UPDATE_PROJECT_INSTALLMENTS_BATCH") return "/api/ia-batch"
  return "/api/ia"
}

function renderActionDetails(action: ProposedAction) {
  if (action.type === "UPDATE_PROJECT_INSTALLMENTS_BATCH") {
    return (
      <div className="text-xs space-y-1">
        <p><strong>Proyecto:</strong> {action.projectName}</p>
        {action.items.map(item => (
          <p key={item.cuota}>
            <strong>Cuota #{item.cuota}:</strong> USD {item.amountUSD.toLocaleString("es-AR")} · pagó {item.paidByName || "repartida"}
          </p>
        ))}
      </div>
    )
  }

  if (action.type === "UPDATE_PROJECT_INSTALLMENT_SPLIT") {
    return (
      <div className="text-xs space-y-1">
        <p><strong>Proyecto:</strong> {action.projectName}</p>
        <p><strong>Cuota:</strong> #{action.cuota}</p>
        <p><strong>Monto:</strong> USD {action.amountUSD.toLocaleString("es-AR")}</p>
        <p><strong>Detalle:</strong> {action.socios || "por porcentaje entre socios"}</p>
      </div>
    )
  }

  return (
    <div className="text-xs space-y-1">
      <p><strong>Local:</strong> {(action as any).negocioNombre ?? "—"}</p>
      <p><strong>Cuota:</strong> #{(action as any).cuota ?? "—"}</p>
      <p><strong>Monto 100%:</strong> USD {Number((action as any).amountUSD ?? 0).toLocaleString("es-AR")}</p>
      <p><strong>Socios:</strong> {(action as any).socios || "sin detalle"}</p>
    </div>
  )
}

export function IaCopiloto() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Soy tu IA financiera. Puedo explicarte recuperos, pendientes, cuotas y preparar cambios para que los confirmes antes de aplicarlos.",
    },
  ])

  async function askEndpoint(url: string, text: string) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || "No pude responder")
    return data
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    setInput("")
    setMessages(prev => [...prev, { role: "user", text }])
    setLoading(true)

    try {
      const batchData = await askEndpoint("/api/ia-batch", text)
      if (batchData?.proposedAction) {
        setMessages(prev => [...prev, { role: "assistant", text: batchData.reply, proposedAction: batchData.proposedAction }])
        return
      }

      const data = await askEndpoint("/api/ia", text)
      setMessages(prev => [...prev, { role: "assistant", text: data.reply, proposedAction: data.proposedAction ?? null }])
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al consultar la IA"
      setMessages(prev => [...prev, { role: "assistant", text: msg }])
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function applyAction(action: ProposedAction) {
    if (applying) return
    setApplying(true)
    try {
      const res = await fetch(actionEndpoint(action), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "apply", action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "No pude aplicar el cambio")
      setMessages(prev => [...prev, { role: "assistant", text: data.message || "Cambio aplicado." }])
      toast.success("Cambio aplicado")
      window.dispatchEvent(new Event("inversiones:refresh"))
      window.location.reload()
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al aplicar cambio"
      setMessages(prev => [...prev, { role: "assistant", text: msg }])
      toast.error(msg)
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-xl hover:bg-black"
      >
        <Bot className="h-4 w-4" />
        IA
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 flex justify-end">
          <div className="h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="border-b px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900 flex items-center gap-2"><Bot className="h-5 w-5" /> IA financiera</h2>
                <p className="text-xs text-gray-500">Lee datos, explica y prepara cambios con confirmación.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.map((m, idx) => (
                <div key={idx} className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-blue-600 text-white ml-8" : "bg-white border text-gray-800 mr-8"}`}>
                  {m.text}
                  {m.proposedAction && (
                    <div className="mt-3 rounded-xl border bg-emerald-50 p-3 text-gray-800">
                      <p className="text-xs font-bold text-emerald-800 mb-2">Cambio listo para aplicar</p>
                      {renderActionDetails(m.proposedAction)}
                      <button
                        type="button"
                        disabled={applying}
                        onClick={() => applyAction(m.proposedAction as ProposedAction)}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        {actionTitle(m.proposedAction)}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="rounded-2xl px-4 py-3 text-sm bg-white border text-gray-500 mr-8 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Pensando...
                </div>
              )}
            </div>

            <div className="border-t p-4 bg-white">
              <div className="mb-2 grid grid-cols-1 gap-2 text-xs text-gray-500">
                <button type="button" onClick={() => setInput("Dame un resumen financiero general")} className="text-left rounded-lg border px-3 py-2 hover:bg-gray-50">Dame un resumen financiero general</button>
                <button type="button" onClick={() => setInput("Tenemos que corregir las cuotas de Tiwa.\nLa 1 la pago completo Augusto, son usd 289\nLa 2 la pago completo Fernando, son usd 304\nLa 3 la pago completo Maria, son usd 292,64")} className="text-left rounded-lg border px-3 py-2 hover:bg-gray-50">Ejemplo: corregir varias cuotas</button>
              </div>
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder="Pedime algo: resumir, explicar o preparar un cambio..."
                  className="min-h-12 flex-1 resize-none rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button type="button" onClick={sendMessage} disabled={loading || !input.trim()} className="rounded-xl bg-gray-900 px-4 text-white disabled:opacity-50">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
