import { getLocalStore, type DomainTable } from '@hospiwaste/shared/lib/local-store'
import { notifyOutboxChanged } from './field-writes'

/**
 * Edición de un registro de campo. Pendiente (synced=0) → se reescribe la fila
 * local y el flush sube la versión final. Ya sincronizado → online-only; el
 * error se propaga para que la página lo muestre (nunca fallo silencioso).
 */
export async function applyFieldEdit(
  tbl: DomainTable,
  id: string,
  payload: Record<string, unknown>,
  onlineUpdate: () => Promise<void>,
): Promise<'local' | 'online'> {
  const store = await getLocalStore()
  if (!(await store.isRowSynced(tbl, id))) {
    await store.putRow(tbl, id, payload)
    notifyOutboxChanged()
    return 'local'
  }
  await onlineUpdate()
  return 'online'
}
