import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type DolarBlueResponse = {
  compra: number
  venta: number
  casa?: string
  nombre?: string
  moneda?: string
  fechaActualizacion?: string
}

export async function GET() {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/blue", {
      cache: "no-store",
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: "No se pudo obtener el dólar blue" }, { status: 502 })
    }

    const data = await res.json() as DolarBlueResponse
    return NextResponse.json({
      compra: data.compra,
      venta: data.venta,
      valorParaCalculo: data.compra,
      fuente: "DolarApi",
      fechaActualizacion: data.fechaActualizacion ?? null,
    })
  } catch {
    return NextResponse.json({ error: "No se pudo obtener el dólar blue" }, { status: 502 })
  }
}
