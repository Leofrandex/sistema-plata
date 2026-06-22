import { listOps } from '@/lib/offline-queue'

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

const RECORD_PREFIXES = ['ws:', 'rec:', 're:', 'tr:', 'se:', 'cl:']

/** Ids de registro (no fotos) que siguen pendientes de subir, derivados del outbox. */
export async function pendingRecordIds(): Promise<Set<string>> {
  const ops = await listOps()
  const ids = new Set<string>()
  for (const op of ops) {
    const prefix = RECORD_PREFIXES.find((p) => op.op_id.startsWith(p))
    if (prefix) ids.add(op.op_id.slice(prefix.length).split(':')[0])
  }
  return ids
}
