import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const protectedPaths = ["/proyectos", "/configuracion", "/api/proyectos", "/api/usuarios", "/api/usuario"]

export function middleware(request: NextRequest) {
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const sessionToken =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token")

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/proyectos/:path*",
    "/configuracion/:path*",
    "/api/proyectos/:path*",
    "/api/usuarios/:path*",
    "/api/usuario/:path*",
  ],
}
