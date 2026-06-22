import { getDB } from './idb'

const STORE_NAME = 'queue'

export interface QueuedEvent {
  id?: number
  type: string
  payload: Record<string, unknown>
  queued_at: string
}

export async function enqueue(event: Omit<QueuedEvent, 'id' | 'queued_at'>): Promise<void> {
  const db = await getDB()
  await db.add(STORE_NAME, { ...event, queued_at: new Date().toISOString() })
}

export async function dequeueAll(): Promise<QueuedEvent[]> {
  const db = await getDB()
  return db.getAll(STORE_NAME) as Promise<QueuedEvent[]>
}

export async function clearAll(): Promise<void> {
  const db = await getDB()
  await db.clear(STORE_NAME)
}

export async function getQueueCount(): Promise<number> {
  const db = await getDB()
  return db.count(STORE_NAME)
}

// ─── Outbox (operaciones local-first) ────────────────────────────────────────

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

export async function bumpAttempts(op_id: string): Promise<void> {
  const db = await getDB()
  const op = (await db.get(OUTBOX, op_id)) as OutboxOp | undefined
  if (!op) return
  await db.put(OUTBOX, { ...op, attempts: op.attempts + 1 })
}

export async function countPendingOps(): Promise<number> {
  const db = await getDB()
  return db.count(OUTBOX)
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
