/** Une server + locales pendientes por id, sin duplicar ni pisar lo del server. */
export function mergeById<T extends { id: string }>(
  serverRows: T[],
  localRows: T[],
  pendingIds: Set<string>,
): T[] {
  const serverIds = new Set(serverRows.map((r) => r.id))
  const extras = localRows.filter((r) => pendingIds.has(r.id) && !serverIds.has(r.id))
  return [...serverRows, ...extras]
}

/**
 * Une `primary` (gana en caso de id repetido) con `secondary` por id, sin
 * duplicar ni descartar filas de `secondary` ausentes en `primary`. A
 * diferencia de `mergeById`, no filtra por `pendingIds`: es una unión total,
 * pensada para no pisar estado existente con un snapshot parcial.
 */
export function unionById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const primaryIds = new Set(primary.map((r) => r.id))
  const extras = secondary.filter((r) => !primaryIds.has(r.id))
  return [...primary, ...extras]
}
