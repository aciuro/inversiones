"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"

interface User { id: string; name: string; email: string; createdAt: string }

export default function ConfiguracionPage() {
  const [current, setCurrent] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [loading, setLoading] = useState(false)

  const [usuarios, setUsuarios] = useState<User[]>([])
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [creating, setCreating] = useState(false)
  const searchParams = useSearchParams()
  const mustChange = searchParams.get("mustChange") === "1"

  useEffect(() => {
    fetch("/api/usuarios").then(r => r.json()).then(setUsuarios)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPass !== confirmPass) { toast.error("Las contraseñas no coinciden"); return }
    if (newPass.length < 6) { toast.error("La nueva contraseña debe tener al menos 6 caracteres"); return }
    setLoading(true)

    const res = await fetch("/api/usuario/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
    })

    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? "Error al cambiar contraseña")
    } else {
      toast.success("Contraseña actualizada")
      setCurrent(""); setNewPass(""); setConfirmPass("")
    }
    setLoading(false)
  }

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault()
    if (!newName || !newEmail || !newPassword) return
    setCreating(true)
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, email: newEmail, password: newPassword }),
    })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? "Error al crear usuario")
    } else {
      const u = await res.json()
      setUsuarios(prev => [...prev, u])
      setNewName(""); setNewEmail(""); setNewPassword("")
      toast.success("Usuario creado")
    }
    setCreating(false)
  }

  async function eliminarUsuario(id: string, name: string) {
    if (!confirm(`¿Eliminar a ${name}?`)) return
    const res = await fetch("/api/usuarios", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? "Error al eliminar")
    } else {
      setUsuarios(prev => prev.filter(u => u.id !== id))
      toast.success("Usuario eliminado")
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <Toaster />
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Configuración</h1>
      {mustChange && (
        <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#78350f", fontWeight: 600 }}>
          ⚠️ Estás usando una contraseña temporal. Por favor cambiala antes de continuar.
        </div>
      )}

      {/* ── Usuarios ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios</CardTitle>
        </CardHeader>
        <CardContent style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {usuarios.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8" }}>No hay usuarios.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {usuarios.map(u => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", borderRadius: 10, padding: "10px 14px" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{u.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{u.email}</p>
                  </div>
                  <button
                    onClick={() => eliminarUsuario(u.id, u.name)}
                    style={{ background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={crearUsuario} style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#0f172a" }}>Crear nuevo usuario</p>
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Contraseña</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Creando..." : "Crear usuario"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Cambiar contraseña ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cambiar mi contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Contraseña actual</Label>
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Confirmar nueva contraseña</Label>
              <Input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Cambiar contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
