import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new (PrismaClient as any)({ adapter })

type Entry = { compra: number; venta: number; fecha: string }

async function main() {
  console.log("Obteniendo historial de dólar blue desde argentinadatos.com...")
  const res = await fetch("https://api.argentinadatos.com/v1/cotizaciones/dolares/blue")
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const data: Entry[] = await res.json()
  const desde2023 = data.filter(d => d.fecha >= "2023-01-01")
  console.log(`Registros desde 2023: ${desde2023.length}`)

  const result = await prisma.dolarBlue.createMany({
    data: desde2023.map(d => ({
      fecha: new Date(d.fecha + "T00:00:00.000Z"),
      compra: d.compra,
      venta: d.venta,
    })),
    skipDuplicates: true,
  })

  console.log(`✅ Insertados: ${result.count} registros`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
