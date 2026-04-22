import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type ArgentinaDatosEntry = { compra: number; venta: number; fecha: string }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const fechaStr = searchParams.get("fecha")
  if (!fechaStr) return NextResponse.json({ error: "Falta fecha" }, { status: 400 })

  const targetDate = new Date(fechaStr + "T00:00:00.000Z")
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const daysDiff = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24))
  if (daysDiff <= 7) {
    try {
      const res = await fetch("https://api.argentinadatos.com/v1/cotizaciones/dolares/blue", { next: { revalidate: 3600 } })
      if (res.ok) {
        const data: ArgentinaDatosEntry[] = await res.json()
        const cutoff = new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000)
        const recent = data.filter(d => new Date(d.fecha + "T00:00:00.000Z") >= cutoff)
        if (recent.length > 0) {
          await prisma.dolarBlue.createMany({
            data: recent.map(d => ({ fecha: new Date(d.fecha + "T00:00:00.000Z"), compra: d.compra, venta: d.venta })),
            skipDuplicates: true,
          })
        }
      }
    } catch {}
  }

  const registro = await prisma.dolarBlue.findFirst({
    where: { fecha: { lte: targetDate } },
    orderBy: { fecha: "desc" },
  })

  if (!registro) return NextResponse.json({ error: "Sin datos para esa fecha" }, { status: 404 })
  return NextResponse.json({ compra: registro.compra, venta: registro.venta, fecha: registro.fecha })
}
