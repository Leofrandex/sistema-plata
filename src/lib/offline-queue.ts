import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'hospiwaste-offline'
const DB_VERSION = 1
const STORE_NAME = 'queue'

export interface QueuedEvent {
  id?: number
  type: string
  payload: Record<string, unknown>
  queued_at: string
}

let dbPromise: ReturnType<typeof openDB> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        }
      },
    })
  }
  return dbPromise
}

export async function enqueue(event: Omit<QueuedEvent, 'id' | 'queued_at'>): Promise<void> {
  const db = await getDB()
  await db.add(STORE_NAME, { ...event, queued_at: new Date().toISOString() })
}

export async function dequeueAll(): Promise<QueuedEvent[]> {
  const db = await getDB()
  return db.getAll(STORE_NAME)
}

export async function clearAll(): Promise<void> {
  const db = await getDB()
  await db.clear(STORE_NAME)
}

export async function getQueueCount(): Promise<number> {
  const db = await getDB()
  return db.count(STORE_NAME)
}
