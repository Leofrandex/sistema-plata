import { openDB, type IDBPDatabase } from 'idb'
import type { DomainTable, LocalPhoto, LocalRow, LocalStore, NewLocalPhoto, PendingCounts } from './types'

const DB_NAME = 'hospiwaste-local'
const DB_VERSION = 1

interface PhotoRecord extends Omit<LocalPhoto, 'file_uri'> { blob: Blob }

function toBool(row: { synced: number | boolean }): boolean {
  return row.synced === true || row.synced === 1
}

/** Backend web/dev del LocalStore sobre IndexedDB. Misma semántica que el nativo. */
export function createIdbStore(dbName = DB_NAME): LocalStore {
  let dbPromise: Promise<IDBPDatabase> | null = null
  const db = () => {
    if (!dbPromise) {
      dbPromise = openDB(dbName, DB_VERSION, {
        upgrade(d) {
          if (!d.objectStoreNames.contains('local_rows')) {
            d.createObjectStore('local_rows', { keyPath: ['tbl', 'id'] })
          }
          if (!d.objectStoreNames.contains('local_photos')) {
            d.createObjectStore('local_photos', { keyPath: 'photo_id' })
          }
          if (!d.objectStoreNames.contains('meta')) {
            d.createObjectStore('meta', { keyPath: 'key' })
          }
        },
      })
    }
    return dbPromise
  }

  async function getRow(tbl: DomainTable, id: string): Promise<LocalRow | undefined> {
    const r = await (await db()).get('local_rows', [tbl, id])
    return r ? ({ ...r, synced: toBool(r) } as LocalRow) : undefined
  }

  return {
    async init() { await db() },

    async putRow(tbl, id, payload) {
      const prev = await getRow(tbl, id)
      await (await db()).put('local_rows', {
        tbl, id, payload,
        synced: 0, attempts: 0, sync_error: null,
        created_at: prev?.created_at ?? new Date().toISOString(),
      })
    },

    async getRows(tbl) {
      const all = (await (await db()).getAll('local_rows')) as Array<LocalRow & { synced: number | boolean }>
      return all.filter((r) => r.tbl === tbl).map((r) => ({ ...r, synced: toBool(r) }))
    },

    async getUnsyncedRows() {
      const all = (await (await db()).getAll('local_rows')) as Array<LocalRow & { synced: number | boolean }>
      return all.filter((r) => !toBool(r)).map((r) => ({ ...r, synced: false }))
    },

    async isRowSynced(tbl, id) {
      const r = await getRow(tbl, id)
      return r?.synced === true
    },

    async markRowSynced(tbl, id) {
      const r = await getRow(tbl, id)
      if (!r) return
      await (await db()).put('local_rows', { ...r, synced: 1, sync_error: null })
    },

    async markRowFailed(tbl, id, error) {
      const r = await getRow(tbl, id)
      if (!r) return
      await (await db()).put('local_rows', { ...r, synced: 0, attempts: r.attempts + 1, sync_error: error })
    },

    async putPhoto(photo, blob) {
      const rec: PhotoRecord = { ...photo, blob, synced: false, attempts: 0, sync_error: null }
      await (await db()).put('local_photos', rec)
    },

    async getPhotos() {
      const all = (await (await db()).getAll('local_photos')) as PhotoRecord[]
      return all.map(({ blob: _b, ...p }) => ({ ...p, file_uri: `idb:${p.photo_id}`, synced: toBool(p) }))
    },

    async getUnsyncedPhotos() {
      return (await this.getPhotos()).filter((p) => !p.synced)
    },

    async getPhotoBlob(photo_id) {
      const rec = (await (await db()).get('local_photos', photo_id)) as PhotoRecord | undefined
      if (!rec) return null
      if (toBool(rec)) return null
      return rec.blob
    },

    async markPhotoSynced(photo_id) {
      const rec = (await (await db()).get('local_photos', photo_id)) as PhotoRecord | undefined
      if (!rec) return
      // Blob fuera, metadatos quedan como constancia de subida.
      await (await db()).put('local_photos', { ...rec, blob: new Blob([]), synced: 1, sync_error: null })
    },

    async markPhotoFailed(photo_id, error) {
      const rec = (await (await db()).get('local_photos', photo_id)) as PhotoRecord | undefined
      if (!rec) return
      await (await db()).put('local_photos', { ...rec, synced: 0, attempts: rec.attempts + 1, sync_error: error })
    },

    async pendingCounts(): Promise<PendingCounts> {
      const rows = await this.getUnsyncedRows()
      const photos = await this.getUnsyncedPhotos()
      const allRows = (await (await db()).getAll('local_rows')) as LocalRow[]
      const allPhotos = await this.getPhotos()
      const rejected =
        allRows.filter((r) => r.sync_error != null).length +
        allPhotos.filter((p) => p.sync_error != null).length
      return { records: rows.length, photos: photos.length, rejected }
    },

    async getMeta(key) {
      const r = (await (await db()).get('meta', key)) as { value: string } | undefined
      return r?.value ?? null
    },

    async setMeta(key, value) {
      await (await db()).put('meta', { key, value })
    },
  }
}
