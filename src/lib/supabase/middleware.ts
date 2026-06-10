import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'
import { sessionCookieOptions } from './cookie-session'

/**
 * Rutas públicas (no requieren sesión). El resto se protege con redirect
 * a /login?next=<ruta-original>.
 */
const PUBLIC_PATHS = ['/login', '/auth']

/**
 * Rutas a las que puede entrar un operador. Todo lo demás (Reportes, Tachos,
 * Traslado externo, Admin…) es exclusivo de coordinadores. Mantener en sync con
 * la navegación (sidebar / mobile-bottom-nav).
 */
const OPERATOR_PATHS = [
  '/dashboard',
  '/register/route',
  '/register/weighing',
  '/register/treatment',
]

function isOperatorAllowed(pathname: string): boolean {
  return OPERATOR_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

/**
 * Refresca la sesión Supabase en cada request (cookies de auth) y aplica el
 * auth gate: usuarios sin sesión van a /login. Llamar desde src/middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, sessionCookieOptions(value, options))
          )
        },
      },
    }
  )

  // IMPORTANTE: getUser() valida el token contra el servidor de Auth.
  // No usar getSession() en server — devuelve datos sin validar.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )

  // Sin sesión y ruta protegida → redirect a login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Con sesión y en /login → al dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Gate por rol: un operador no puede entrar a rutas de coordinador.
  // Solo consultamos el rol cuando la ruta NO es operador-permitida (las rutas
  // del operador no pagan ninguna query extra).
  if (user && !isPublic && !isOperatorAllowed(pathname)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'operator') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return response
}
