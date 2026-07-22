import { pathMatchesAny } from '@hospiwaste/shared/lib/auth/route-access'

/** Rutas públicas del hub (no requieren sesión). */
export const PUBLIC_PATHS = ['/login', '/auth'] as const

export function isPublicPath(pathname: string): boolean {
  return pathMatchesAny(pathname, PUBLIC_PATHS)
}
