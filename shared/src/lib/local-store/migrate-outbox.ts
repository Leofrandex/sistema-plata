import { listOps, getPhotoBlob, removeOp, removePhotoBlob, type OutboxOp } from '../offline-queue'
import { TABLE_FOR_TYPE } from './net'
import type { DomainTable, LocalStore } from './types'

const MIGRATED_KEY = 'migrated_outbox'

/**
 * Primer arranque de la versión SQLite: pasa las ops pendientes del outbox
 * IndexedDB a filas de dominio (synced=0) y blobs a fotos locales. Solo borra
 * del outbox lo que quedó persistido en el LocalStore. Idempotente vía meta.
 */
export async function migrateOutboxToLocalStore(store: LocalStore): Promise<{ migrated: number }> {
  if ((await store.getMeta(MIGRATED_KEY)) === '1') return { migrated: 0 }

  let migrated = 0
  const ops = await listOps()
  for (const op of ops) {
    const persisted = await migrateOne(store, op)
    if (persisted) {
      await removeOp(op.op_id)
      migrated++
    }
  }

  await store.setMeta(MIGRATED_KEY, '1')
  return { migrated }
}

async function migrateOne(store: LocalStore, op: OutboxOp): Promise<boolean> {
  if (op.type === 'upload_photo') {
    const p = op.payload as { photo_id: string; event_type: string; event_id: string; label: string
      uploaded_by: string | null; taken_at: string; role: string | null; ext: string }
    const entry = await getPhotoBlob(p.photo_id)
    if (!entry) {
      console.warn('[migrate-outbox] blob faltante, se deja la op en el outbox', op.op_id, 'missing_blob')
      return false
    }
    await store.putPhoto({ ...p, content_type: entry.content_type }, entry.blob)
    await removePhotoBlob(p.photo_id)
    return true
  }
  if (op.type === 'add_route_containers') {
    const { table, rows } = op.payload as { table: DomainTable; rows: Array<Record<string, unknown>> }
    for (const row of rows) {
      await store.putRow(table, `${row.route_event_id}:${row.container_id}`, row)
    }
    return true
  }
  const table = TABLE_FOR_TYPE[op.type] as DomainTable | undefined
  if (!table) {
    console.warn('[migrate-outbox] tipo de op desconocido, se deja la op en el outbox', op.op_id, 'unknown_type')
    return false
  }
  await store.putRow(table, (op.payload as { id: string }).id, op.payload)
  return true
}
