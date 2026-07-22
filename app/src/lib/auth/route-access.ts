import { pathMatchesAny } from '@hospiwaste/shared/lib/auth/route-access'

/** Rutas públicas de la app de campo (no requieren sesión). */
export const PUBLIC_PATHS = ['/login', '/auth', '/offline'] as const

export function isPublicPath(pathname: string): boolean {
  return pathMatchesAny(pathname, PUBLIC_PATHS)
}
