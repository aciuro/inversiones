export { auth as middleware } from "@/auth"

export const config = {
  matcher: [
    "/proyectos/:path*",
    "/configuracion/:path*",
    "/api/proyectos/:path*",
    "/api/usuarios/:path*",
    "/api/usuario/:path*",
  ],
}
