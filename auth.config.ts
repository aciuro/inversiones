import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const mustChange = !!(auth?.user as { mustChangePassword?: boolean } | undefined)?.mustChangePassword
      const isProtected = ["/inicio", "/proyectos", "/configuracion", "/api/proyectos", "/api/usuarios", "/api/usuario", "/api/notas", "/api/invites"].some(
        (p) => nextUrl.pathname.startsWith(p)
      )
      if (!isLoggedIn && isProtected) return false
      if (isLoggedIn && mustChange && !nextUrl.pathname.startsWith("/configuracion") && !nextUrl.pathname.startsWith("/api/usuario/password")) {
        return Response.redirect(new URL("/configuracion?mustChange=1", nextUrl))
      }
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false
      }
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      if (token.mustChangePassword) (session.user as { mustChangePassword?: boolean }).mustChangePassword = true
      return session
    },
  },
  providers: [],
}
