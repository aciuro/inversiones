import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new (PrismaClient as any)({ adapter })

async function main() {
  const users = [
    { name: "Augusto", email: "augustociuro@gmail.com", password: "cambiar123" },
    { name: "Socio 2", email: "socio2@email.com", password: "cambiar123" },
    { name: "Socio 3", email: "socio3@email.com", password: "cambiar123" },
  ]

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 12)
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, password: hashed },
    })
    console.log(`✓ Usuario: ${u.email} (contraseña: ${u.password})`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
