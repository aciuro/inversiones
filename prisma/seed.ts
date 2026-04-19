import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new (PrismaClient as any)({ adapter })

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

async function main() {
  // ── Usuarios ──────────────────────────────────────────────
  const usersData = [
    { name: "Augusto Ciuro",        email: "augustociuro@gmail.com",  password: "cambiar123" },
    { name: "María Emilia Santaliz", email: "socio2@email.com",        password: "cambiar123" },
    { name: "Fernando Méndez",       email: "socio3@email.com",        password: "cambiar123" },
  ]

  const users: Record<string, string> = {}
  for (const u of usersData) {
    const hashed = await bcrypt.hash(u.password, 12)
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { name: u.name, email: u.email, password: hashed },
    })
    users[u.name.split(" ")[0]] = user.id
    console.log(`✓ Usuario: ${u.name}`)
  }

  const augustoId  = users["Augusto"]
  const mariaId    = users["María"]
  const fernandoId = users["Fernando"]

  // ── Limpiar proyectos existentes de seed ──────────────────
  await prisma.project.deleteMany({
    where: { name: { in: ["Cardinal", "Bari", "Tiwa Brasil", "Bio Pilar"] } },
  })

  // ── CARDINAL ──────────────────────────────────────────────
  // L&B | Pilar del Este | Oficina 208
  // Total: USD 67.200 | Entrada: 20.200 | 14 cuotas de 3.336
  // Socios: Augusto 50% + María Emilia 50%
  {
    const entradaDate = new Date("2026-01-15")
    const primeraCuota = new Date("2026-02-01")
    const cardinal = await prisma.project.create({
      data: {
        name:         "Cardinal",
        developer:    "L&B",
        location:     "Pilar del Este",
        unitNumber:   "Oficina 208",
        totalPrice:   67200,
        entryPrice:   20200,
        currentValue: 20200,
        currency:     "USD",
        status:       "active",
        members: {
          create: [
            { userId: augustoId, role: "owner", sharePercent: 50 },
            { userId: mariaId,   role: "member", sharePercent: 50 },
          ],
        },
      },
    })

    const cuotas = Array.from({ length: 14 }, (_, i) => ({
      projectId: cardinal.id,
      number:    i + 1,
      amount:    3336,
      dueDate:   addMonths(primeraCuota, i),
      paidAt:    i < 3 ? addMonths(primeraCuota, i) : null,
    }))
    await prisma.installment.createMany({ data: cuotas })
    console.log(`✓ Cardinal — 14 cuotas (3 pagadas)`)
  }

  // ── BARI ──────────────────────────────────────────────────
  // L&B | Manzanares | Local 7
  // Total: USD 70.200 | Entrada: 21.100 | 12 cuotas de 4.100
  // Socio: Solo Augusto
  {
    const primeraCuota = new Date("2026-03-01") // fecha aproximada — actualizar cuando tengamos las fechas reales
    const bari = await prisma.project.create({
      data: {
        name:         "Bari",
        developer:    "L&B",
        location:     "Manzanares",
        unitNumber:   "Local 7",
        totalPrice:   70200,
        entryPrice:   21100,
        currentValue: 21100,
        currency:     "USD",
        status:       "active",
        members: {
          create: [
            { userId: augustoId, role: "owner", sharePercent: 100 },
          ],
        },
      },
    })

    const cuotas = Array.from({ length: 12 }, (_, i) => ({
      projectId: bari.id,
      number:    i + 1,
      amount:    4100,
      dueDate:   addMonths(primeraCuota, i),
      paidAt:    i < 2 ? addMonths(primeraCuota, i) : null,
    }))
    await prisma.installment.createMany({ data: cuotas })
    console.log(`✓ Bari — 12 cuotas (2 pagadas)`)
  }

  // ── TIWA BRASIL ───────────────────────────────────────────
  // HF Ory | São Miguel dos Milagres, Brasil | Unidad 212
  // Total: BRL 291.795 | Entrada: 2 × USD 4.545 = USD 9.090 (18%)
  // 36 cuotas de BRL 1.433 (16%) — se pagan en USD
  // 5 refuerzos de BRL 9.337 c/u (16%) — en enero y julio
  // 50% llave en mano
  // Socios: Augusto 33.3% | María Emilia 33.3% | Fernando 33.3%
  {
    const primeraCuota  = new Date("2026-04-01") // fecha aproximada
    const tiwa = await prisma.project.create({
      data: {
        name:         "Tiwa Brasil",
        developer:    "HF Ory",
        location:     "São Miguel dos Milagres, Brasil",
        unitNumber:   "Unidad 212",
        totalPrice:   291795,
        entryPrice:   9090,      // USD pagado (2 × 4.545)
        entryPriceBRL: 52523,   // 18% de BRL 291.795
        currentValue: 9090,
        currency:     "BRL",
        status:       "active",
        description:  "50% llave en mano al entregar. Cuotas y refuerzos en BRL, pagados en USD al tipo de cambio del día.",
        members: {
          create: [
            { userId: augustoId,  role: "owner",  sharePercent: 33.33 },
            { userId: mariaId,    role: "member", sharePercent: 33.33 },
            { userId: fernandoId, role: "member", sharePercent: 33.33 },
          ],
        },
      },
    })

    // Cuotas — primeras 2 pagadas (cuota 1 por Augusto, cuota 2 por Fernando)
    const cuotas = Array.from({ length: 36 }, (_, i) => ({
      projectId:    tiwa.id,
      number:       i + 1,
      amount:       1433,
      amountUSD:    i === 0 ? 289 : i === 1 ? 304 : null,
      dueDate:      addMonths(primeraCuota, i),
      paidAt:       i < 2 ? addMonths(primeraCuota, i) : null,
      paidByUserId: i === 0 ? augustoId : i === 1 ? fernandoId : null,
    }))
    await prisma.installment.createMany({ data: cuotas })

    // Refuerzos — 5 en total, en enero y julio
    // BRL 9.337 c/u — primer refuerzo: julio 2026
    const refuerzoFechas = [
      new Date("2026-07-01"),
      new Date("2027-01-01"),
      new Date("2027-07-01"),
      new Date("2028-01-01"),
      new Date("2028-07-01"),
    ]
    const refuerzos = refuerzoFechas.map((fecha, i) => ({
      projectId: tiwa.id,
      amount:    9337,
      dueDate:   fecha,
      paidAt:    null,
      label:     `Refuerzo ${i + 1}`,
    }))
    await prisma.reinforcement.createMany({ data: refuerzos })
    console.log(`✓ Tiwa Brasil — 36 cuotas (2 pagadas) + 5 refuerzos`)
  }

  // ── BIO PILAR — VENDIDO ───────────────────────────────────
  // Bio | Pilar, Barrio Freixas
  // Entrada oct 2025, vendido dic 2025
  // Invertido: USD 14.200 | Vendido: USD 18.000 | Ganancia: USD 3.800
  // Socios: Augusto 50% + María Emilia 50%
  {
    const bioPilar = await prisma.project.create({
      data: {
        name:         "Bio Pilar",
        developer:    "Bio",
        location:     "Pilar, Barrio Freixas",
        unitNumber:   null,
        totalPrice:   70358,
        entryPrice:   14200,  // reserva 3.400 + anticipo 10.800
        currentValue: 18000,
        currency:     "USD",
        status:       "sold",
        soldPrice:    18000,
        soldAt:       new Date("2025-12-01"),
        description:  "Reserva USD 3.400 + Anticipo USD 10.800. Vendido en diciembre 2025.",
        members: {
          create: [
            { userId: augustoId, role: "owner",  sharePercent: 50 },
            { userId: mariaId,   role: "member", sharePercent: 50 },
          ],
        },
      },
    })
    console.log(`✓ Bio Pilar — VENDIDO (ganancia USD 3.800)`)
    void bioPilar
  }

  console.log("\n✅ Seed completo")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
