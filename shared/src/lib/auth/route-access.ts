/**
 * Helper genérico de matching de rutas por prefijo. Cada app define sus
 * propias listas (públicas, permitidas) y las aplica con este helper.
 */
export function pathMatchesAny(pathname: string, paths: readonly string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
