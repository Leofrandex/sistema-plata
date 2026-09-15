import { pathMatchesAny } from '@hospiwaste/shared/lib/auth/route-access'

/** Rutas públicas de la app de campo (no requieren sesión). */
// /diagnostico es público a propósito: hace falta justo cuando no se puede
// iniciar sesión.
export const PUBLIC_PATHS = ['/login', '/auth', '/offline', '/diagnostico'] as const

export function isPublicPath(pathname: string): boolean {
  return pathMatchesAny(pathname, PUBLIC_PATHS)
}
