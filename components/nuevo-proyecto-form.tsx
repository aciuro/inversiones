"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"

interface Usuario {
  id: string
  name: string
  email: string
}

interface Cuota {
  number: number
  amount: string
  dueDate: string
}

interface Refuerzo {
  amount: string
  dueDate: string
  label: string
}

export function NuevoProyectoForm({ usuarios }: { usuarios: Usuario[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [entryPrice, setEntryPrice] = useState("")
  const [currentValue, setCurrentValue] = useState("")
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])

  const [numCuotas, setNumCuotas] = useState("")
  const [montoCuota, setMontoCuota] = useState("")
  const [fechaInicio, setFechaInicio] = useState("")

  const [refuerzos, setRefuerzos] = useState<Refuerzo[]>([])

  function toggleMember(id: string) {
    setSelectedMembers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function addRefuerzo() {
    setRefuerzos([...refuerzos, { amount: "", dueDate: "", label: "" }])
  }

  function updateRefuerzo(i: number, field: keyof Refuerzo, value: string) {
    setRefuerzos(refuerzos.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  function removeRefuerzo(i: number) {
    setRefuerzos(refuerzos.filter((_, idx) => idx !== i))
  }

  function buildCuotas(): Cuota[] {
    const n = parseInt(numCuotas)
    if (!n || !montoCuota || !fechaInicio) return []
    const cuotas: Cuota[] = []
    const start = new Date(fechaInicio)
    for (let i = 0; i < n; i++) {
      const d = new Date(start)
      d.setMonth(d.getMonth() + i)
      cuotas.push({ number: i + 1, amount: montoCuota, dueDate: d.toISOString() })
    }
    return cuotas
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          entryPrice: parseFloat(entryPrice),
          currentValue: parseFloat(currentValue),
          memberIds: selectedMembers,
        }),
      })

      if (!res.ok) throw new Error("Error al crear el proyecto")
      const proyecto = await res.json()

      const cuotas = buildCuotas()
      if (cuotas.length > 0) {
        await fetch(`/api/proyectos/${proyecto.id}/cuotas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cuotas }),
        })
      }

      for (const r of refuerzos) {
        if (r.amount && r.dueDate) {
          await fetch(`/api/proyectos/${proyecto.id}/refuerzos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: parseFloat(r.amount), dueDate: r.dueDate, label: r.label }),
          })
        }
      }

      router.push(`/proyectos/${proyecto.id}`)
    } catch {
      setError("Ocurrió un error. Intentá de nuevo.")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold">Datos del proyecto</h2>
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Descripción (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Precio de entrada (USD)</Label>
              <Input type="number" step="0.01" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Valor actual (USD)</Label>
              <Input type="number" step="0.01" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} required />
            </div>
          </div>
        </CardContent>
      </Card>

      {usuarios.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h2 className="font-semibold">Socios del proyecto</h2>
            {usuarios.map((u) => (
              <div key={u.id} className="flex items-center gap-2">
                <Checkbox
                  id={u.id}
                  checked={selectedMembers.includes(u.id)}
                  onCheckedChange={() => toggleMember(u.id)}
                />
                <label htmlFor={u.id} className="text-sm cursor-pointer">
                  {u.name} <span className="text-gray-400">({u.email})</span>
                </label>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold">Cuotas mensuales</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Cantidad de cuotas</Label>
              <Input type="number" value={numCuotas} onChange={(e) => setNumCuotas(e.target.value)} placeholder="24" />
            </div>
            <div className="space-y-1">
              <Label>Monto por cuota (USD)</Label>
              <Input type="number" step="0.01" value={montoCuota} onChange={(e) => setMontoCuota(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Primera cuota</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Refuerzos (opcional)</h2>
            <Button type="button" variant="outline" size="sm" onClick={addRefuerzo}>
              + Agregar refuerzo
            </Button>
          </div>
          {refuerzos.map((r, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 items-end">
              <div className="space-y-1">
                <Label>Monto (USD)</Label>
                <Input type="number" step="0.01" value={r.amount} onChange={(e) => updateRefuerzo(i, "amount", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fecha</Label>
                <Input type="date" value={r.dueDate} onChange={(e) => updateRefuerzo(i, "dueDate", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Descripción</Label>
                <div className="flex gap-1">
                  <Input value={r.label} onChange={(e) => updateRefuerzo(i, "label", e.target.value)} placeholder="Ej: 1° semestre" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeRefuerzo(i)}>✕</Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Creando..." : "Crear proyecto"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
