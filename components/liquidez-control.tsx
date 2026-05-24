"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

type LiquidezMovement = {
  id: string
  type: "income" | "expense" | "reinvestment" | "adjustment"
  amountUSD: number
  date: string
  note: string | null
  createdAt: string
}

function usd(n: number, decimals = 0) {
  return `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`
}

function movementSign(type: LiquidezMovement["type"]) {
  if (type === "income" || type === "adjustment") return 1
  return -1
}

function movementLabel(type: LiquidezMovement["type"]) {
  if (type === "income") return "Ingreso / ganancia"
  if (type === "expense") return "Gasto / retiro"
  if (type === "reinvestment") return "Reinversión"
  return "Ajuste manual"
}

function movementColor(type: LiquidezMovement["type"]) {
  if (type === "income" || type === "adjustment") return "#10b981"
  if (type === "reinvestment") return "#6366f1"
  return "#ef4444"
}

export function LiquidezControl({ liquidezBase }: { liquidezBase: number }) {
  const [movements, setMovements] = useState<LiquidezMovement[]>([])
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<LiquidezMovement["type"]>("expense")
  const [amountUSD, setAmountUSD] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/liquidez")
      .then(r => r.json())
      .then(data => setMovements(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const movimientoNeto = useMemo(() => {
    return movements.reduce((sum, m) => sum + movementSign(m.type) * m.amountUSD, 0)
  }, [movements])

  const liquidezFinal = liquidezBase + movimientoNeto

  async function saveMovement() {
    const amount = Number(amountUSD.replace(/,/g, "."))
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Monto inválido")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/liquidez", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amountUSD: amount, date, note: note.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar")
      setMovements(prev => [data, ...prev])
      setAmountUSD("")
      setNote("")
      setOpen(false)
      toast.success("Movimiento de liquidez guardado")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #dbeafe", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cuenta de liquidez</p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: liquidezFinal >= 0 ? "#10b981" : "#ef4444" }}>{usd(liquidezFinal)}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
            Base por ventas: {usd(liquidezBase)} · Movimientos manuales: {movimientoNeto >= 0 ? "+" : ""}{usd(movimientoNeto)}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Editar liquidez</Button>
      </div>

      {movements.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {movements.slice(0, 4).map(m => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: movementColor(m.type) }}>{movementLabel(m.type)}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>{m.date}{m.note ? ` · ${m.note}` : ""}</p>
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: movementColor(m.type) }}>{movementSign(m.type) > 0 ? "+" : "-"}{usd(m.amountUSD)}</p>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setOpen(false)}>
          <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 24px 70px rgba(15,23,42,0.22)" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Editar liquidez</h3>
            <p style={{ margin: "4px 0 18px", fontSize: 13, color: "#64748b" }}>Registrá ingresos, gastos, reinversiones o ajustes. No borra historial.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: "#334155" }}>Tipo de movimiento</label>
                <select value={type} onChange={e => setType(e.target.value as LiquidezMovement["type"])} style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}>
                  <option value="income">Agregar liquidez / ganancia</option>
                  <option value="expense">Sacar liquidez / gasto</option>
                  <option value="reinvestment">Reinvertir liquidez</option>
                  <option value="adjustment">Ajuste manual positivo</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: "#334155" }}>Monto USD</label>
                <Input value={amountUSD} onChange={e => setAmountUSD(e.target.value)} inputMode="decimal" placeholder="Ej: 2000" />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: "#334155" }}>Fecha</label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: "#334155" }}>Nota</label>
                <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Ej: reinversión Bari, gasto personal, ganancia dejada en caja" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <Button variant="outline" style={{ flex: 1 }} onClick={() => setOpen(false)}>Cancelar</Button>
              <Button style={{ flex: 1 }} disabled={saving} onClick={saveMovement}>{saving ? "Guardando..." : "Guardar"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
