import { getDB } from './idb'

// ─── Outbox (operaciones local-first, legacy) ────────────────────────────────
// Solo sobrevive lo que consume la migración a LocalStore (`migrate-outbox.ts`)
// y sus tests: leer/borrar ops pendientes y blobs de fotos encoladas antes del
// motor SQLite/IDB nuevo.

const OUTBOX = 'outbox'
const PHOTO_BLOBS = 'photo_blobs'

export type OutboxOpType =
  | 'create_route_event'
  | 'add_route_containers'
  | 'create_weighing_session'
  | 'create_reception'
  | 'create_treatment_run'
  | 'create_container_location'
  | 'create_storage_event'
  | 'upload_photo'

export interface OutboxOp {
  op_id: string
  type: OutboxOpType
  payload: Record<string, unknown>
  deps: string[]
  created_at: string
  attempts: number
}

export interface PhotoBlobEntry {
  photo_id: string
  blob: Blob
  content_type: string
}

export async function enqueueOp(
  op: Omit<OutboxOp, 'created_at' | 'attempts'>
): Promise<void> {
  const db = await getDB()
  await db.put(OUTBOX, { ...op, created_at: new Date().toISOString(), attempts: 0 })
}

export async function listOps(): Promise<OutboxOp[]> {
  const db = await getDB()
  const all = (await db.getAll(OUTBOX)) as OutboxOp[]
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function removeOp(op_id: string): Promise<void> {
  const db = await getDB()
  await db.delete(OUTBOX, op_id)
}

export async function putPhotoBlob(e: PhotoBlobEntry): Promise<void> {
  const db = await getDB()
  await db.put(PHOTO_BLOBS, e)
}

export async function getPhotoBlob(photo_id: string): Promise<PhotoBlobEntry | undefined> {
  const db = await getDB()
  return (await db.get(PHOTO_BLOBS, photo_id)) as PhotoBlobEntry | undefined
}

export async function removePhotoBlob(photo_id: string): Promise<void> {
  const db = await getDB()
  await db.delete(PHOTO_BLOBS, photo_id)
}
