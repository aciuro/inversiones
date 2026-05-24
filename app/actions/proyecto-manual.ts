"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

async function assertProjectAccess(projectId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autorizado")

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  })
  if (!member) throw new Error("Sin permisos")

  return session.user.id
}

export async function editarCuotaProyecto(input: {
  projectId: string
  cuotaId: string
  amount: string | number
  amountUSD?: string | number | null
  paid: boolean
  paidByUserId?: string | null
}) {
  await assertProjectAccess(input.projectId)

  const amount = toNumber(input.amount)
  if (amount === null) throw new Error("Monto inválido")

  const amountUSD = toNumber(input.amountUSD)

  await prisma.installment.update({
    where: { id: input.cuotaId },
    data: {
      amount,
      amountUSD: input.paid ? amountUSD : null,
      paidAt: input.paid ? new Date() : null,
      paidByUserId: input.paid ? (input.paidByUserId || null) : null,
    },
  })

  revalidatePath(`/proyectos/${input.projectId}`)
  return { ok: true }
}

export async function editarRefuerzoProyecto(input: {
  projectId: string
  refuerzoId: string
  amount: string | number
  amountUSD?: string | number | null
  paid: boolean
}) {
  await assertProjectAccess(input.projectId)

  const amount = toNumber(input.amount)
  if (amount === null) throw new Error("Monto inválido")

  const amountUSD = toNumber(input.amountUSD)

  await prisma.reinforcement.update({
    where: { id: input.refuerzoId },
    data: {
      amount,
      amountUSD: input.paid ? amountUSD : null,
      paidAt: input.paid ? new Date() : null,
    },
  })

  revalidatePath(`/proyectos/${input.projectId}`)
  return { ok: true }
}
