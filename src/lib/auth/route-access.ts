/** Rutas públicas (no requieren sesión). */
const PUBLIC_PATHS = ['/login', '/auth']

/** Rutas a las que puede entrar un operador. El resto es de coordinador. */
const OPERATOR_PATHS = [
  '/dashboard',
  '/register/route',
  '/register/weighing',
  '/register/treatment',
]

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function isOperatorAllowed(pathname: string): boolean {
  return OPERATOR_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
