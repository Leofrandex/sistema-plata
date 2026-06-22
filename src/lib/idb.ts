import { openDB, type IDBPDatabase } from 'idb'

/**
 * Apertura centralizada de la base IndexedDB `hospiwaste-offline`. Antes había un
 * conflicto: offline-queue abría v1 (store `queue`) y active-session abría v2
 * (store `active_sessions`) por separado. Aquí se unifica: un único `upgrade`
 * crea todos los stores que falten, idempotente.
 */
export const DB_NAME = 'hospiwaste-offline'
export const DB_VERSION = 3

let dbPromise: Promise<IDBPDatabase> | null = null

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
        }
        if (!db.objectStoreNames.contains('active_sessions')) {
          db.createObjectStore('active_sessions', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'op_id' })
        }
        if (!db.objectStoreNames.contains('photo_blobs')) {
          db.createObjectStore('photo_blobs', { keyPath: 'photo_id' })
        }
      },
    })
  }
  return dbPromise
}
