import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: [
    "/proyectos/:path*",
    "/configuracion/:path*",
    "/api/proyectos/:path*",
    "/api/usuarios/:path*",
    "/api/usuario/:path*",
  ],
}
