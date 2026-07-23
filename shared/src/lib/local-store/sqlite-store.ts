import type { DomainTable, LocalPhoto, LocalRow, LocalStore, NewLocalPhoto, PendingCounts } from './types'

export const DB_FILE = 'hospiwaste'

export const SCHEMA_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS local_rows (
     tbl TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL,
     synced INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
     sync_error TEXT, created_at TEXT NOT NULL,
     PRIMARY KEY (tbl, id)
   );`,
  `CREATE INDEX IF NOT EXISTS idx_local_rows_unsynced ON local_rows (synced, tbl);`,
  `CREATE TABLE IF NOT EXISTS local_photos (
     photo_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, event_id TEXT NOT NULL,
     label TEXT NOT NULL, uploaded_by TEXT, taken_at TEXT NOT NULL, role TEXT,
     ext TEXT NOT NULL, content_type TEXT NOT NULL, file_uri TEXT NOT NULL,
     synced INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, sync_error TEXT
   );`,
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
]

export function photoFileName(p: Pick<NewLocalPhoto, 'photo_id' | 'ext'>): string {
  return `photos/${p.photo_id}.${p.ext}`
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function base64ToBlob(b64: string, contentType: string): Blob {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: contentType })
}

/** Backend nativo: SQLite (WAL) + fotos como archivos en Directory.Data. */
export function createSqliteStore(): LocalStore {
  // Imports dinámicos: este módulo solo se ejecuta en plataforma nativa.
  let conn: import('@capacitor-community/sqlite').SQLiteDBConnection | null = null

  async function db() {
    if (conn) return conn
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite')
    const sqlite = new SQLiteConnection(CapacitorSQLite)
    const c = await sqlite.createConnection(DB_FILE, false, 'no-encryption', 1, false)
    await c.open()
    await c.execute('PRAGMA journal_mode=WAL;')
    for (const stmt of SCHEMA_SQL) await c.execute(stmt)
    conn = c
    return c
  }

  async function fs() {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    return { Filesystem, Directory }
  }

  function rowFrom(r: Record<string, unknown>): LocalRow {
    return {
      tbl: r.tbl as DomainTable, id: r.id as string,
      payload: JSON.parse(r.payload as string),
      synced: r.synced === 1, attempts: r.attempts as number,
      sync_error: (r.sync_error as string) ?? null, created_at: r.created_at as string,
    }
  }

  function photoFrom(r: Record<string, unknown>): LocalPhoto {
    return {
      photo_id: r.photo_id as string, event_type: r.event_type as string,
      event_id: r.event_id as string, label: r.label as string,
      uploaded_by: (r.uploaded_by as string) ?? null, taken_at: r.taken_at as string,
      role: (r.role as string) ?? null, ext: r.ext as string,
      content_type: r.content_type as string, file_uri: r.file_uri as string,
      synced: r.synced === 1, attempts: r.attempts as number,
      sync_error: (r.sync_error as string) ?? null,
    }
  }

  return {
    async init() { await db() },

    async putRow(tbl, id, payload) {
      await (await db()).run(
        `INSERT INTO local_rows (tbl, id, payload, synced, attempts, sync_error, created_at)
         VALUES (?, ?, ?, 0, 0, NULL, ?)
         ON CONFLICT(tbl, id) DO UPDATE SET payload=excluded.payload, synced=0, attempts=0, sync_error=NULL`,
        [tbl, id, JSON.stringify(payload), new Date().toISOString()],
      )
    },

    async getRows(tbl) {
      const res = await (await db()).query('SELECT * FROM local_rows WHERE tbl = ?', [tbl])
      return (res.values ?? []).map(rowFrom)
    },

    async getUnsyncedRows() {
      const res = await (await db()).query('SELECT * FROM local_rows WHERE synced = 0')
      return (res.values ?? []).map(rowFrom)
    },

    async isRowSynced(tbl, id) {
      const res = await (await db()).query('SELECT synced FROM local_rows WHERE tbl = ? AND id = ?', [tbl, id])
      return res.values?.[0]?.synced === 1
    },

    async markRowSynced(tbl, id) {
      await (await db()).run('UPDATE local_rows SET synced=1, sync_error=NULL WHERE tbl=? AND id=?', [tbl, id])
    },

    async markRowFailed(tbl, id, error) {
      await (await db()).run(
        'UPDATE local_rows SET attempts=attempts+1, sync_error=? WHERE tbl=? AND id=?', [error, tbl, id])
    },

    async putPhoto(photo, blob) {
      const { Filesystem, Directory } = await fs()
      const path = photoFileName(photo)
      await Filesystem.writeFile({
        path, directory: Directory.Data, data: await blobToBase64(blob), recursive: true,
      })
      await (await db()).run(
        `INSERT OR REPLACE INTO local_photos
         (photo_id, event_type, event_id, label, uploaded_by, taken_at, role, ext, content_type, file_uri, synced, attempts, sync_error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL)`,
        [photo.photo_id, photo.event_type, photo.event_id, photo.label, photo.uploaded_by,
         photo.taken_at, photo.role, photo.ext, photo.content_type, path],
      )
    },

    async getPhotos() {
      const res = await (await db()).query('SELECT * FROM local_photos')
      return (res.values ?? []).map(photoFrom)
    },

    async getUnsyncedPhotos() {
      const res = await (await db()).query('SELECT * FROM local_photos WHERE synced = 0')
      return (res.values ?? []).map(photoFrom)
    },

    async getPhotoBlob(photo_id) {
      const res = await (await db()).query('SELECT * FROM local_photos WHERE photo_id = ?', [photo_id])
      const p = res.values?.[0]
      if (!p || p.synced === 1) return null
      const { Filesystem, Directory } = await fs()
      try {
        const file = await Filesystem.readFile({ path: p.file_uri, directory: Directory.Data })
        return base64ToBlob(file.data as string, p.content_type)
      } catch {
        return null
      }
    },

    async markPhotoSynced(photo_id) {
      const res = await (await db()).query('SELECT file_uri FROM local_photos WHERE photo_id = ?', [photo_id])
      await (await db()).run('UPDATE local_photos SET synced=1, sync_error=NULL WHERE photo_id=?', [photo_id])
      const uri = res.values?.[0]?.file_uri
      if (uri) {
        const { Filesystem, Directory } = await fs()
        try { await Filesystem.deleteFile({ path: uri, directory: Directory.Data }) } catch { /* ya no está */ }
      }
    },

    async markPhotoFailed(photo_id, error) {
      await (await db()).run(
        'UPDATE local_photos SET attempts=attempts+1, sync_error=? WHERE photo_id=?', [error, photo_id])
    },

    async pendingCounts(): Promise<PendingCounts> {
      const c = await db()
      const rec = await c.query('SELECT COUNT(*) AS n FROM local_rows WHERE synced=0')
      const ph = await c.query('SELECT COUNT(*) AS n FROM local_photos WHERE synced=0')
      const rej = await c.query(
        `SELECT (SELECT COUNT(*) FROM local_rows WHERE sync_error IS NOT NULL)
              + (SELECT COUNT(*) FROM local_photos WHERE sync_error IS NOT NULL) AS n`)
      return {
        records: rec.values?.[0]?.n ?? 0,
        photos: ph.values?.[0]?.n ?? 0,
        rejected: rej.values?.[0]?.n ?? 0,
      }
    },

    async getMeta(key) {
      const res = await (await db()).query('SELECT value FROM meta WHERE key = ?', [key])
      return res.values?.[0]?.value ?? null
    },

    async setMeta(key, value) {
      await (await db()).run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value])
    },
  }
}
