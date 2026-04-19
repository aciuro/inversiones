import { PrismaClient } from "../app/generated/prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const hashed = await bcrypt.hash("admin123", 12)

  const users = [
    { name: "Augusto Ciuro", email: "augustociuro@gmail.com" },
    { name: "Maria Emilia Santaliz", email: "santaliz.me@gmail.com" },
    { name: "Fernando Mendez", email: "efe.mendez@hotmail.com" },
  ]

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { password: hashed, mustChangePassword: true },
      create: { ...u, password: hashed, mustChangePassword: true },
    })
    console.log(`✓ ${u.name}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
