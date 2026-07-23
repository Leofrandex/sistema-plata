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
