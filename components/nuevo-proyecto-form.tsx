"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

interface Usuario { id: string; name: string; email: string }

interface Socio { id: string; name: string; email: string; incluido: boolean; share: string }

export function NuevoProyectoForm({ usuarios, currentUserId, currentUserName }: {
  usuarios: Usuario[]
  currentUserId: string
  currentUserName: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Datos básicos
  const [name, setName] = useState("")
  const [developer, setDeveloper] = useState("")
  const [location, setLocation] = useState("")
  const [unitNumber, setUnitNumber] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [description, setDescription] = useState("")

  // Precios
  const [totalPrice, setTotalPrice] = useState("")
  const [entryPrice, setEntryPrice] = useState("")
  const [entryPriceBRL, setEntryPriceBRL] = useState("")

  // Socios — yo siempre incluido
  const [socios, setSocios] = useState<Socio[]>(
    usuarios.map(u => ({ ...u, incluido: false, share: "" }))
  )

  // Cuotas
  const [hasCuotas, setHasCuotas] = useState(true)
  const [numCuotas, setNumCuotas] = useState("")
  const [montoCuota, setMontoCuota] = useState("")
  const [fechaInicio, setFechaInicio] = useState("")

  // Refuerzos
  const [hasRefuerzos, setHasRefuerzos] = useState(false)
  const [numRefuerzos, setNumRefuerzos] = useState("5")
  const [refuerzoPct, setRefuerzoPct] = useState("16")
  const [primeraFechaRef, setPrimeraFechaRef] = useState("")
  const [refuerzoCada, setRefuerzoCada] = useState("6") // cada N meses

  // Llave en mano
  const [hasLlave, setHasLlave] = useState(false)
  const [llavePct, setLlavePct] = useState("50")

  const isBRL = currency === "BRL"
  const sociosIncluidos = socios.filter(s => s.incluido)
  const totalSocios = sociosIncluidos.length + 1 // +1 = yo

  function toggleSocio(id: string) {
    setSocios(prev => prev.map(s => s.id === id
      ? { ...s, incluido: !s.incluido, share: !s.incluido ? String(Math.floor(100 / (sociosIncluidos.length + 2))) : s.share }
      : s
    ))
  }

  function updateShare(id: string, val: string) {
    setSocios(prev => prev.map(s => s.id === id ? { ...s, share: val } : s))
  }

  // Mi parte = 100 - suma de los demás
  const sumOtros = sociosIncluidos.reduce((s, x) => s + (parseFloat(x.share) || 0), 0)
  const miShare = Math.max(0, 100 - sumOtros)

  function buildRefuerzos() {
    if (!hasRefuerzos || !totalPrice || !primeraFechaRef) return []
    const total = parseFloat(totalPrice)
    const pct = parseFloat(refuerzoPct) / 100
    const n = parseInt(numRefuerzos)
    const monto = (total * pct) / n
    const cada = parseInt(refuerzoCada)
    const start = new Date(primeraFechaRef)
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(start)
      d.setMonth(d.getMonth() + i * cada)
      return { amount: Math.round(monto), dueDate: d.toISOString(), label: `Refuerzo ${i + 1}` }
    })
  }

  function buildCuotas() {
    const n = parseInt(numCuotas)
    if (!hasCuotas || !n || !montoCuota || !fechaInicio) return []
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(fechaInicio)
      d.setMonth(d.getMonth() + i)
      return { number: i + 1, amount: parseFloat(montoCuota), dueDate: d.toISOString() }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !entryPrice) { setError("Completá nombre y precio de entrada"); return }
    setLoading(true)
    setError("")

    try {
      const memberIds = sociosIncluidos.map(s => s.id)
      const memberShares: Record<string, number> = {}
      sociosIncluidos.forEach(s => { memberShares[s.id] = parseFloat(s.share) || 0 })
      memberShares[currentUserId] = miShare

      const res = await fetch("/api/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, developer, location, unitNumber, description,
          currency,
          totalPrice: totalPrice ? parseFloat(totalPrice) : null,
          entryPrice: parseFloat(entryPrice),
          entryPriceBRL: isBRL && entryPriceBRL ? parseFloat(entryPriceBRL) : null,
          currentValue: parseFloat(entryPrice),
          memberIds,
          memberShares,
          status: memberIds.length > 0 ? "pending_approval" : "active",
        }),
      })

      if (!res.ok) throw new Error("Error al crear")
      const proyecto = await res.json()

      const cuotas = buildCuotas()
      if (cuotas.length > 0) {
        await fetch(`/api/proyectos/${proyecto.id}/cuotas`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cuotas }),
        })
      }

      const refuerzos = buildRefuerzos()
      for (const r of refuerzos) {
        await fetch(`/api/proyectos/${proyecto.id}/refuerzos`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(r),
        })
      }

      // Crear invites para socios
      for (const id of memberIds) {
        await fetch("/api/invites", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: proyecto.id, userId: id }),
        })
      }

      router.push(`/proyectos/${proyecto.id}`)
    } catch {
      setError("Ocurrió un error. Intentá de nuevo.")
      setLoading(false)
    }
  }

  const sectionStyle = { background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px 24px", display: "flex", flexDirection: "column" as const, gap: 16 }
  const toggleStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
    background: active ? "#6366f1" : "#f1f5f9", color: active ? "#fff" : "#64748b",
    border: "none", borderRadius: 100, padding: "5px 14px", fontSize: 12, fontWeight: 600,
    fontFamily: "inherit",
  })

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>

      {/* Datos básicos */}
      <div style={sectionStyle}>
        <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "#0f172a" }}>Datos del proyecto</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <Label style={{ fontSize: 12 }}>Nombre *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Cardinal" required style={{ marginTop: 4 }} />
          </div>
          <div>
            <Label style={{ fontSize: 12 }}>Desarrolladora</Label>
            <Input value={developer} onChange={e => setDeveloper(e.target.value)} placeholder="Ej: L&B" style={{ marginTop: 4 }} />
          </div>
          <div>
            <Label style={{ fontSize: 12 }}>Ubicación</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Pilar del Este" style={{ marginTop: 4 }} />
          </div>
          <div>
            <Label style={{ fontSize: 12 }}>Unidad / Número</Label>
            <Input value={unitNumber} onChange={e => setUnitNumber(e.target.value)} placeholder="Ej: Oficina 208" style={{ marginTop: 4 }} />
          </div>
          <div>
            <Label style={{ fontSize: 12 }}>Moneda</Label>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {["USD", "BRL"].map(c => (
                <button key={c} type="button" onClick={() => setCurrency(c)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${currency === c ? "#6366f1" : "#e2e8f0"}`,
                  background: currency === c ? "#ede9fe" : "#fff", color: currency === c ? "#6366f1" : "#64748b",
                  fontWeight: currency === c ? 700 : 400, cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                }}>{c}</button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <Label style={{ fontSize: 12 }}>Descripción (opcional)</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Notas del proyecto" style={{ marginTop: 4 }} />
        </div>
      </div>

      {/* Precios */}
      <div style={sectionStyle}>
        <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "#0f172a" }}>Precios</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <Label style={{ fontSize: 12 }}>Precio total ({isBRL ? "R$" : "USD"})</Label>
            <Input type="number" value={totalPrice} onChange={e => setTotalPrice(e.target.value)} placeholder="Ej: 291795" style={{ marginTop: 4 }} />
          </div>
          <div>
            <Label style={{ fontSize: 12 }}>Precio de entrada (USD)</Label>
            <Input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} required style={{ marginTop: 4 }} />
          </div>
          {isBRL && (
            <div>
              <Label style={{ fontSize: 12 }}>Entrada en R$ (equivalente)</Label>
              <Input type="number" value={entryPriceBRL} onChange={e => setEntryPriceBRL(e.target.value)}
                placeholder={totalPrice ? `~${Math.round(parseFloat(totalPrice) * 0.18)}` : ""}
                style={{ marginTop: 4 }} />
              <p style={{ fontSize: 10, color: "#94a3b8", margin: "3px 0 0" }}>Opcional — para el gráfico de progreso</p>
            </div>
          )}
        </div>
      </div>

      {/* Socios */}
      <div style={sectionStyle}>
        <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "#0f172a" }}>Socios</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Yo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #86efac" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                {currentUserName[0]}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{currentUserName} (vos)</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#6366f1" }}>{miShare.toFixed(1)}%</span>
          </div>
          {usuarios.map(u => {
            const socio = socios.find(s => s.id === u.id)!
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: `1px solid ${socio.incluido ? "#bfdbfe" : "#e2e8f0"}`, background: socio.incluido ? "#eff6ff" : "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Checkbox checked={socio.incluido} onCheckedChange={() => toggleSocio(u.id)} />
                  <span style={{ fontSize: 13, fontWeight: socio.incluido ? 600 : 400, color: "#0f172a" }}>{u.name}</span>
                </div>
                {socio.incluido && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Input type="number" value={socio.share} onChange={e => updateShare(u.id, e.target.value)}
                      style={{ width: 64, height: 28, fontSize: 13, textAlign: "right" }} />
                    <span style={{ fontSize: 12, color: "#64748b" }}>%</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {totalSocios > 1 && Math.abs(sumOtros + miShare - 100) > 0.5 && (
          <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>⚠ Los porcentajes no suman 100%</p>
        )}
        {totalSocios > 1 && (
          <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>Los socios recibirán una invitación para aprobar el proyecto.</p>
        )}
      </div>

      {/* Cuotas */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "#0f172a" }}>Cuotas mensuales</p>
          <button type="button" style={toggleStyle(hasCuotas)} onClick={() => setHasCuotas(!hasCuotas)}>
            {hasCuotas ? "✓ Aplica" : "No aplica"}
          </button>
        </div>
        {hasCuotas && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <Label style={{ fontSize: 12 }}>Cantidad</Label>
              <Input type="number" value={numCuotas} onChange={e => setNumCuotas(e.target.value)} placeholder="36" style={{ marginTop: 4 }} />
            </div>
            <div>
              <Label style={{ fontSize: 12 }}>Monto por cuota ({isBRL ? "R$" : "USD"})</Label>
              <Input type="number" value={montoCuota} onChange={e => setMontoCuota(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <Label style={{ fontSize: 12 }}>Primera cuota</Label>
              <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={{ marginTop: 4 }} />
            </div>
          </div>
        )}
      </div>

      {/* Refuerzos */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "#0f172a" }}>Refuerzos</p>
          <button type="button" style={toggleStyle(hasRefuerzos)} onClick={() => setHasRefuerzos(!hasRefuerzos)}>
            {hasRefuerzos ? "✓ Aplica" : "No aplica"}
          </button>
        </div>
        {hasRefuerzos && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <Label style={{ fontSize: 12 }}>Cantidad</Label>
              <Input type="number" value={numRefuerzos} onChange={e => setNumRefuerzos(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <Label style={{ fontSize: 12 }}>% del total del proyecto</Label>
              <Input type="number" value={refuerzoPct} onChange={e => setRefuerzoPct(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <Label style={{ fontSize: 12 }}>Cada (meses)</Label>
              <Input type="number" value={refuerzoCada} onChange={e => setRefuerzoCada(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <Label style={{ fontSize: 12 }}>Primer refuerzo</Label>
              <Input type="date" value={primeraFechaRef} onChange={e => setPrimeraFechaRef(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            {totalPrice && numRefuerzos && refuerzoPct && (
              <div style={{ gridColumn: "1 / -1", background: "#f0fdf4", borderRadius: 8, padding: "8px 12px" }}>
                <p style={{ fontSize: 12, color: "#15803d", margin: 0 }}>
                  {numRefuerzos} refuerzos de {isBRL ? "R$" : "USD"} {Math.round((parseFloat(totalPrice) * parseFloat(refuerzoPct) / 100) / parseInt(numRefuerzos)).toLocaleString("es-AR")} c/u
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Llave en mano */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "#0f172a" }}>Llave en mano</p>
          <button type="button" style={toggleStyle(hasLlave)} onClick={() => setHasLlave(!hasLlave)}>
            {hasLlave ? "✓ Aplica" : "No aplica"}
          </button>
        </div>
        {hasLlave && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div>
              <Label style={{ fontSize: 12 }}>% del total</Label>
              <Input type="number" value={llavePct} onChange={e => setLlavePct(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            {totalPrice && llavePct && (
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                  = {isBRL ? "R$" : "USD"} {Math.round(parseFloat(totalPrice) * parseFloat(llavePct) / 100).toLocaleString("es-AR")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p style={{ fontSize: 13, color: "#ef4444" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <Button type="submit" disabled={loading} style={{ flex: 1 }}>
          {loading ? "Creando..." : totalSocios > 1 ? "Crear y enviar invitaciones" : "Crear proyecto"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </form>
  )
}
