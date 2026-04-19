"use client"

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from "recharts"

const COLORS = {
  pagado:   "#10b981",
  pendiente:"#e2e8f0",
  entrada:  "#6366f1",
  cuotas:   "#06b6d4",
  refuerzos:"#f59e0b",
  llaveEnMano: "#8b5cf6",
  vendido:  "#10b981",
}

interface Installment {
  number: number; amount: number; amountUSD: number | null
  dueDate: string; paidAt: string | null; paidByUserId: string | null
}
interface Reinforcement {
  amount: number; amountUSD: number | null; dueDate: string; paidAt: string | null; label: string | null
}
interface Member {
  userId: string; sharePercent: number; user: { id: string; name: string }
}

interface Props {
  proyecto: {
    name: string; currency: string; status: string
    totalPrice: number | null; entryPrice: number; entryPriceBRL: number | null; currentValue: number
    soldPrice: number | null
    installments: Installment[]
    reinforcements: Reinforcement[]
    members: Member[]
  }
}

function fmt(n: number, currency = "USD") {
  if (currency === "BRL") return `R$ ${n.toLocaleString("es-AR")}`
  return `USD ${n.toLocaleString("es-AR")}`
}

function fmtUSD(n: number) { return `USD ${n.toLocaleString("es-AR")}` }

export function GraficosProyecto({ proyecto }: Props) {
  const { currency, installments, reinforcements, members } = proyecto
  const isBRL = currency === "BRL"

  const cuotasPagadas   = installments.filter(c => c.paidAt)
  const cuotasPendientes = installments.filter(c => !c.paidAt)
  const refPagados      = reinforcements.filter(r => r.paidAt)
  const refPendientes   = reinforcements.filter(r => !r.paidAt)

  const cuotasPagadasBRL    = cuotasPagadas.reduce((s, c) => s + c.amount, 0)
  const cuotasPendientesBRL = cuotasPendientes.reduce((s, c) => s + c.amount, 0)
  const refPagadosBRL       = refPagados.reduce((s, r) => s + r.amount, 0)
  const refPendientesBRL    = refPendientes.reduce((s, r) => s + r.amount, 0)
  const cuotasPagadasUSD    = cuotasPagadas.reduce((s, c) => s + (c.amountUSD ?? 0), 0)
  const refPagadosUSD       = refPagados.reduce((s, r) => s + (r.amountUSD ?? 0), 0)

  // ── Dona de progreso ───────────────────────────────────────
  // BRL: todo en BRL (entrada usa entryPriceBRL si está disponible)
  // USD: todo en USD
  const entradaBRL = proyecto.entryPriceBRL ?? 0

  const donaPagado = isBRL
    ? entradaBRL + cuotasPagadasBRL + refPagadosBRL
    : proyecto.entryPrice + cuotasPagadasUSD + refPagadosUSD

  const donaPendiente = isBRL
    ? cuotasPendientesBRL + refPendientesBRL
    : cuotasPendientes.reduce((s, c) => s + c.amount, 0) + refPendientes.reduce((s, r) => s + r.amount, 0)

  const donaTotal = isBRL
    ? (proyecto.totalPrice ?? (donaPagado + donaPendiente))
    : (proyecto.totalPrice ?? (donaPagado + donaPendiente))

  const donaData = [
    { name: "Pagado",    value: Math.round(donaPagado) },
    { name: "Pendiente", value: Math.round(donaTotal - donaPagado) },
  ]

  const pct = donaTotal > 0
    ? Math.min(100, Math.round((donaPagado / donaTotal) * 100))
    : 0

  // ── Barras por concepto ────────────────────────────────────
  const barData = isBRL
    ? [
        { concepto: "Entrada",   pagado: Math.round(entradaBRL),         pendiente: 0 },
        { concepto: "Cuotas",    pagado: Math.round(cuotasPagadasBRL),   pendiente: Math.round(cuotasPendientesBRL) },
        ...(reinforcements.length > 0
          ? [{ concepto: "Refuerzos", pagado: Math.round(refPagadosBRL), pendiente: Math.round(refPendientesBRL) }]
          : []),
      ]
    : [
        { concepto: "Entrada",   pagado: Math.round(proyecto.entryPrice), pendiente: 0 },
        { concepto: "Cuotas",    pagado: Math.round(cuotasPagadasUSD),    pendiente: Math.round(donaPendiente) },
        ...(reinforcements.length > 0
          ? [{ concepto: "Refuerzos", pagado: Math.round(refPagadosUSD), pendiente: Math.round(refPendientesBRL) }]
          : []),
      ]

  // ── Acumulado en el tiempo (siempre en USD) ────────────────
  const pagosOrdenados: { fecha: string; monto: number; concepto: string }[] = []
  pagosOrdenados.push({ fecha: "Entrada", monto: proyecto.entryPrice, concepto: "Entrada" })

  cuotasPagadas.forEach(c => {
    if (isBRL && !c.amountUSD) return // omitir si no tiene USD registrado
    const d = new Date(c.paidAt!)
    const label = `${d.toLocaleString("es-AR", { month: "short" })} ${d.getFullYear()}`
    pagosOrdenados.push({ fecha: label, monto: isBRL ? c.amountUSD! : c.amount, concepto: "Cuota" })
  })

  refPagados.forEach(r => {
    if (isBRL && !r.amountUSD) return
    const d = new Date(r.paidAt!)
    const label = `${d.toLocaleString("es-AR", { month: "short" })} ${d.getFullYear()}`
    pagosOrdenados.push({ fecha: label, monto: isBRL ? r.amountUSD! : r.amount, concepto: "Refuerzo" })
  })

  let acumulado = 0
  const areaData = pagosOrdenados.map(p => {
    acumulado += p.monto
    return { ...p, acumulado: Math.round(acumulado) }
  })

  // ── Por socio (en USD) ─────────────────────────────────────
  const socioPagos: Record<string, number> = {}
  for (const m of members) socioPagos[m.user.name] = 0

  for (const m of members) {
    socioPagos[m.user.name] += proyecto.entryPrice * (m.sharePercent / 100)
  }

  for (const c of cuotasPagadas) {
    const monto = isBRL ? (c.amountUSD ?? 0) : c.amount
    if (monto === 0) continue
    if (c.paidByUserId) {
      const m = members.find(x => x.userId === c.paidByUserId)
      if (m) socioPagos[m.user.name] = (socioPagos[m.user.name] ?? 0) + monto
    } else {
      for (const m of members) socioPagos[m.user.name] += monto * (m.sharePercent / 100)
    }
  }

  const socioData = Object.entries(socioPagos).map(([name, value]) => ({
    name: name.split(" ")[0],
    value: Math.round(value),
  }))

  const SOCIO_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981"]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, padding: "8px 0" }}>

      {/* ── Fila superior: dona + barras ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* Dona */}
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", padding: 24 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", margin: "0 0 4px" }}>Progreso de pago</p>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>Entrada + cuotas + refuerzos sobre el total del proyecto</p>
          <div style={{ position: "relative", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donaData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={2}>
                  <Cell fill={COLORS.pagado} />
                  <Cell fill={COLORS.pendiente} />
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v), currency)} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>pagado</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 12 }}>
            {donaData.map((d, i) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: i === 0 ? COLORS.pagado : COLORS.pendiente }} />
                <span style={{ fontSize: 12, color: "#64748b" }}>{d.name}: {fmt(d.value, currency)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Barras por concepto */}
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", padding: 24 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", margin: "0 0 4px" }}>Desglose por concepto</p>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>Pagado vs pendiente</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="concepto" tick={{ fontSize: 12, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `${Math.round(v/1000)}k`} />
              <Tooltip formatter={(v) => fmtUSD(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pagado" name="Pagado" fill={COLORS.pagado} radius={[6,6,0,0]} />
              <Bar dataKey="pendiente" name="Pendiente" fill="#cbd5e1" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Acumulado en el tiempo ── */}
      {areaData.length > 1 && (
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", padding: 24 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", margin: "0 0 4px" }}>Inversión acumulada</p>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>Cómo fue creciendo lo invertido en el tiempo</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="gradAcum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.cuotas} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={COLORS.cuotas} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `${Math.round(v/1000)}k`} />
              <Tooltip formatter={(v) => fmtUSD(Number(v))} />
              <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke={COLORS.cuotas} fill="url(#gradAcum)" strokeWidth={2} dot={{ fill: COLORS.cuotas, r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Por socio ── */}
      {members.length > 1 && (
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", padding: 24 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", margin: "0 0 4px" }}>Aporte por socio</p>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>Lo pagado hasta hoy por cada uno</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={socioData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {socioData.map((_, i) => <Cell key={i} fill={SOCIO_COLORS[i % SOCIO_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtUSD(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
              {socioData.map((s, i) => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: SOCIO_COLORS[i % SOCIO_COLORS.length], flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{fmtUSD(s.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Proyecto vendido ── */}
      {proyecto.status === "sold" && proyecto.soldPrice && (
        <div style={{ background: "linear-gradient(135deg,#ecfdf5,#d1fae5)", borderRadius: 20, border: "1px solid #6ee7b7", padding: 24 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "#065f46", margin: "0 0 16px" }}>✓ Proyecto vendido</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[
              ["Invertido", fmtUSD(donaPagado)],
              ["Vendido por", fmtUSD(proyecto.soldPrice)],
              ["Balance", fmtUSD(proyecto.soldPrice - donaPagado)],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.7)", borderRadius: 14, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#065f46" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
