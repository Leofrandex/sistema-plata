# Offline SQLite local-first — Plan A: motor TypeScript

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La UI de campo lee y escribe una base local durable (`LocalStore`: SQLite en APK, IndexedDB en web) que es la fuente de verdad, con motor de sync por fases (registros→fotos), timeout, mutex y contadores — elimina el bug del doble llenado tras matar la app sin señal.

**Architecture:** Interfaz `LocalStore` con dos backends detrás de una factory por plataforma. Las escrituras de campo insertan filas de dominio (`local_rows` con payload JSON = fila Supabase) con `synced=0`; el store Zustand se hidrata primero desde local y Supabase solo enriquece. `sync-engine.ts` reemplaza a `drainOutbox`: sube filas por `SYNC_ORDER` (padre antes que hijo), luego fotos de padres ya subidos, con timeout 15 s por request y mutex.

**Tech Stack:** TypeScript, `@capacitor-community/sqlite` 8.x, `@capacitor/filesystem` 8.x, `@capacitor/preferences` 8.x, `idb` 8, `@supabase/supabase-js` 2.x, jest (ts-jest en shared, next/jest en app) + `fake-indexeddb`.

**Spec:** `docs/superpowers/specs/2026-07-22-offline-sqlite-local-first-design.md`

## Global Constraints

- Monorepo npm workspaces: código compartido vive en `shared/src/` y se importa como `@hospiwaste/shared/...` (nunca `@/` dentro de shared); `@/*` es local de cada app.
- Builds y dev con `--webpack`. `app/` es export estático (`output: 'export'`): nada de SSR, server actions ni route handlers.
- Los imports de plugins Capacitor en shared son **dinámicos con try/catch** (patrón de `shared/src/lib/capture-photo.ts`) para no romper web/jest.
- Ids **UUID generados en cliente**; todo push a Supabase es upsert idempotente (`onConflict`).
- Ruta de Storage determinística: `{event_type}/{event_id}/{photo_id}.{ext}`, `upsert: true`, bucket `photos`.
- Timeout duro por request: **15_000 ms**. Intervalo de flush: **30_000 ms**. Auto-logout por inactividad: **1 h** (3_600_000 ms).
- El hub (`hub/`) no se toca en este plan.
- Tests: `npm test -w shared` y `npm test -w app` deben quedar verdes al cerrar cada tarea; `npm run build:app` verde al cerrar el plan.
- `hub/` también monta `supabase-hydrator.tsx`: todo cambio en shared debe dejar `npm test -w hub` y `npm run build:hub` verdes (el hydrator recibe el `LocalStore` web, que en hub actúa vacío/inerte).

---

### Task 1: Dependencias + contrato `LocalStore` + `SYNC_ORDER`

**Files:**
- Modify: `shared/package.json` (dependencias)
- Modify: `app/package.json` (dependencias)
- Create: `shared/src/lib/local-store/types.ts`
- Test: `shared/src/__tests__/lib/local-store-order.test.ts`

**Interfaces:**
- Produces: `DomainTable`, `LocalRow`, `LocalPhoto`, `NewLocalPhoto`, `PendingCounts`, `LocalStore` (interfaz), `SYNC_ORDER`, `sortBySyncOrder(rows)`, `PARENT_OF` — todo el plan depende de estos nombres.

- [ ] **Step 1: Instalar dependencias**

```bash
npm install @capacitor-community/sqlite@^8.1.0 @capacitor/filesystem@^8.1.2 @capacitor/preferences@^8.0.1 -w shared
npm install @capacitor-community/sqlite@^8.1.0 @capacitor/filesystem@^8.1.2 @capacitor/preferences@^8.0.1 -w app
```

(En ambos workspaces por la misma razón que `@capacitor/camera`: shared los usa con import dinámico, app los necesita para que `cap sync` registre los plugins nativos.)

- [ ] **Step 2: Write the failing test**

`shared/src/__tests__/lib/local-store-order.test.ts`:

```ts
import { SYNC_ORDER, sortBySyncOrder, PARENT_OF } from '@hospiwaste/shared/lib/local-store/types'
import type { LocalRow } from '@hospiwaste/shared/lib/local-store/types'

function row(tbl: LocalRow['tbl'], id: string, created_at: string): LocalRow {
  return { tbl, id, payload: {}, synced: false, attempts: 0, sync_error: null, created_at }
}

describe('SYNC_ORDER', () => {
  it('ordena padres antes que hijos y respeta created_at dentro de la misma tabla', () => {
    const rows = [
      row('container_receptions', 'r1', '2026-07-22T10:00:00Z'),
      row('route_event_containers_dirty', 're1:c1', '2026-07-22T09:00:00Z'),
      row('weighing_sessions', 'ws1', '2026-07-22T10:05:00Z'),
      row('route_events', 're1', '2026-07-22T09:00:00Z'),
      row('route_events', 're0', '2026-07-22T08:00:00Z'),
    ]
    const sorted = sortBySyncOrder(rows)
    expect(sorted.map((r) => r.id)).toEqual(['re0', 're1', 're1:c1', 'ws1', 'r1'])
  })

  it('PARENT_OF apunta cada hija a su tabla padre', () => {
    expect(PARENT_OF['route_event_containers_dirty']).toBe('route_events')
    expect(PARENT_OF['route_event_containers_clean']).toBe('route_events')
    expect(PARENT_OF['container_receptions']).toBe('weighing_sessions')
    expect(PARENT_OF['route_events']).toBeUndefined()
  })

  it('SYNC_ORDER cubre todas las tablas de dominio', () => {
    expect(SYNC_ORDER).toEqual([
      'route_events',
      'route_event_containers_dirty',
      'route_event_containers_clean',
      'weighing_sessions',
      'container_receptions',
      'treatment_runs',
      'container_locations',
      'storage_events',
    ])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -w shared -- local-store-order`
Expected: FAIL — módulo `local-store/types` no existe.

- [ ] **Step 4: Implementar `shared/src/lib/local-store/types.ts`**

```ts
/** Tablas Supabase que la app de campo escribe local-first. Orden = FK (padre antes que hijo). */
export const SYNC_ORDER = [
  'route_events',
  'route_event_containers_dirty',
  'route_event_containers_clean',
  'weighing_sessions',
  'container_receptions',
  'treatment_runs',
  'container_locations',
  'storage_events',
] as const

export type DomainTable = (typeof SYNC_ORDER)[number]

/** Tabla padre de cada hija: una fila hija solo sube cuando su padre está synced. */
export const PARENT_OF: Partial<Record<DomainTable, DomainTable>> = {
  route_event_containers_dirty: 'route_events',
  route_event_containers_clean: 'route_events',
  container_receptions: 'weighing_sessions',
}

/** Columna(s) de conflicto del upsert por tabla (todas 'id' salvo las join tables). */
export const ON_CONFLICT: Record<DomainTable, string> = {
  route_events: 'id',
  route_event_containers_dirty: 'route_event_id,container_id',
  route_event_containers_clean: 'route_event_id,container_id',
  weighing_sessions: 'id',
  container_receptions: 'id',
  treatment_runs: 'id',
  container_locations: 'id',
  storage_events: 'id',
}

export interface LocalRow {
  tbl: DomainTable
  id: string
  payload: Record<string, unknown>
  synced: boolean
  attempts: number
  sync_error: string | null
  created_at: string
}

export interface NewLocalPhoto {
  photo_id: string
  event_type: string
  event_id: string
  label: string
  uploaded_by: string | null
  taken_at: string
  role: string | null
  ext: string
  content_type: string
}

export interface LocalPhoto extends NewLocalPhoto {
  file_uri: string
  synced: boolean
  attempts: number
  sync_error: string | null
}

export interface PendingCounts {
  records: number   // local_rows con synced=0
  photos: number    // local_photos con synced=0
  rejected: number  // filas o fotos con sync_error != null
}

/** Contrato único: el motor de sync y la UI solo hablan con esto. */
export interface LocalStore {
  init(): Promise<void>
  putRow(tbl: DomainTable, id: string, payload: Record<string, unknown>): Promise<void>
  getRows(tbl: DomainTable): Promise<LocalRow[]>
  getUnsyncedRows(): Promise<LocalRow[]>
  isRowSynced(tbl: DomainTable, id: string): Promise<boolean>
  markRowSynced(tbl: DomainTable, id: string): Promise<void>
  markRowFailed(tbl: DomainTable, id: string, error: string): Promise<void>
  putPhoto(photo: NewLocalPhoto, blob: Blob): Promise<void>
  getPhotos(): Promise<LocalPhoto[]>
  getUnsyncedPhotos(): Promise<LocalPhoto[]>
  getPhotoBlob(photo_id: string): Promise<Blob | null>
  markPhotoSynced(photo_id: string): Promise<void>  // además borra el binario local
  markPhotoFailed(photo_id: string, error: string): Promise<void>
  pendingCounts(): Promise<PendingCounts>
  getMeta(key: string): Promise<string | null>
  setMeta(key: string, value: string): Promise<void>
}

const ORDER_INDEX = new Map<string, number>(SYNC_ORDER.map((t, i) => [t, i]))

/** Padres antes que hijos; dentro de la misma tabla, cronológico. */
export function sortBySyncOrder(rows: LocalRow[]): LocalRow[] {
  return [...rows].sort((a, b) => {
    const d = (ORDER_INDEX.get(a.tbl) ?? 99) - (ORDER_INDEX.get(b.tbl) ?? 99)
    return d !== 0 ? d : a.created_at.localeCompare(b.created_at)
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w shared -- local-store-order`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add shared/package.json app/package.json package-lock.json shared/src/lib/local-store/types.ts shared/src/__tests__/lib/local-store-order.test.ts
git commit -m "feat(offline): contrato LocalStore + SYNC_ORDER + deps sqlite/filesystem/preferences"
```

---

### Task 2: Backend web `idb-store.ts` (IndexedDB)

**Files:**
- Create: `shared/src/lib/local-store/idb-store.ts`
- Test: `shared/src/__tests__/lib/idb-store.test.ts`

**Interfaces:**
- Consumes: todo `local-store/types.ts` (Task 1).
- Produces: `createIdbStore(): LocalStore`. Base IndexedDB nueva `hospiwaste-local` v1 con stores `local_rows` (keyPath `['tbl','id']`), `local_photos` (keyPath `photo_id`, blob inline en `file_uri` no aplica: el blob va en el registro), `meta` (keyPath `key`).

- [ ] **Step 1: Write the failing test**

`shared/src/__tests__/lib/idb-store.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { createIdbStore } from '@hospiwaste/shared/lib/local-store/idb-store'
import type { NewLocalPhoto } from '@hospiwaste/shared/lib/local-store/types'

const photo = (id: string): NewLocalPhoto => ({
  photo_id: id, event_type: 'route_event', event_id: 're1', label: 'Andén',
  uploaded_by: 'op1', taken_at: '2026-07-22T10:00:00Z', role: 'dirty',
  ext: 'jpg', content_type: 'image/jpeg',
})

describe('idb-store', () => {
  it('putRow deja la fila con synced=0 y getRows la devuelve', async () => {
    const s = createIdbStore()
    await s.init()
    await s.putRow('route_events', 're1', { id: 're1', slot: 1 })
    const rows = await s.getRows('route_events')
    expect(rows).toHaveLength(1)
    expect(rows[0].payload).toEqual({ id: 're1', slot: 1 })
    expect(rows[0].synced).toBe(false)
  })

  it('markRowSynced saca la fila de getUnsyncedRows pero no de getRows', async () => {
    const s = createIdbStore()
    await s.init()
    await s.putRow('weighing_sessions', 'ws1', { id: 'ws1' })
    await s.markRowSynced('weighing_sessions', 'ws1')
    expect(await s.isRowSynced('weighing_sessions', 'ws1')).toBe(true)
    expect(await s.getUnsyncedRows()).toHaveLength(0)
    expect(await s.getRows('weighing_sessions')).toHaveLength(1)
  })

  it('putRow sobre una fila existente la re-marca como pendiente y limpia el error', async () => {
    const s = createIdbStore()
    await s.init()
    await s.putRow('route_events', 're2', { v: 1 })
    await s.markRowFailed('route_events', 're2', 'rechazo 400')
    await s.putRow('route_events', 're2', { v: 2 })
    const [r] = await s.getRows('route_events')
    expect(r.payload).toEqual({ v: 2 })
    expect(r.synced).toBe(false)
    expect(r.sync_error).toBeNull()
    expect(r.attempts).toBe(0)
  })

  it('fotos: put/get blob, markPhotoSynced borra el binario', async () => {
    const s = createIdbStore()
    await s.init()
    await s.putPhoto(photo('p1'), new Blob(['x'], { type: 'image/jpeg' }))
    expect(await s.getPhotoBlob('p1')).not.toBeNull()
    expect(await s.getUnsyncedPhotos()).toHaveLength(1)
    await s.markPhotoSynced('p1')
    expect(await s.getUnsyncedPhotos()).toHaveLength(0)
    expect(await s.getPhotoBlob('p1')).toBeNull()
  })

  it('pendingCounts separa records, photos y rejected', async () => {
    const s = createIdbStore()
    await s.init()
    await s.putRow('route_events', 're3', {})
    await s.putRow('route_events', 're4', {})
    await s.markRowFailed('route_events', 're4', 'boom')
    await s.putPhoto(photo('p2'), new Blob(['y']))
    expect(await s.pendingCounts()).toEqual({ records: 2, photos: 1, rejected: 1 })
  })

  it('meta get/set', async () => {
    const s = createIdbStore()
    await s.init()
    expect(await s.getMeta('migrated_outbox')).toBeNull()
    await s.setMeta('migrated_outbox', '1')
    expect(await s.getMeta('migrated_outbox')).toBe('1')
  })
})
```

Nota: cada test crea su store pero comparten la misma base fake — usar ids distintos por test (como arriba) para no interferir.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w shared -- idb-store`
Expected: FAIL — `idb-store` no existe.

- [ ] **Step 3: Implementar `shared/src/lib/local-store/idb-store.ts`**

```ts
import { openDB, type IDBPDatabase } from 'idb'
import type { DomainTable, LocalPhoto, LocalRow, LocalStore, NewLocalPhoto, PendingCounts } from './types'

const DB_NAME = 'hospiwaste-local'
const DB_VERSION = 1

interface PhotoRecord extends Omit<LocalPhoto, 'file_uri'> { blob: Blob }

function toBool(row: { synced: number | boolean }): boolean {
  return row.synced === true || row.synced === 1
}

/** Backend web/dev del LocalStore sobre IndexedDB. Misma semántica que el nativo. */
export function createIdbStore(): LocalStore {
  let dbPromise: Promise<IDBPDatabase> | null = null
  const db = () => {
    if (!dbPromise) {
      dbPromise = openDB(DB_NAME, DB_VERSION, {
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
      return rec?.blob ?? null
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
```

Detalle de `markPhotoSynced`: en IDB "borrar el binario" = reemplazarlo por blob vacío (getPhotoBlob debe devolver `null` si `synced` — ajustar: `if (rec.synced) return null` o comprobar `rec.blob.size === 0 ? null : rec.blob`). Implementar `getPhotoBlob` devolviendo `null` cuando `toBool(rec) === true`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w shared -- idb-store`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/src/lib/local-store/idb-store.ts shared/src/__tests__/lib/idb-store.test.ts
git commit -m "feat(offline): backend IndexedDB del LocalStore (web/dev)"
```

---

### Task 3: Backend nativo `sqlite-store.ts` + factory

**Files:**
- Create: `shared/src/lib/local-store/sqlite-store.ts`
- Create: `shared/src/lib/local-store/index.ts` (factory)
- Test: `shared/src/__tests__/lib/sqlite-store-sql.test.ts` (solo la capa pura de SQL)

**Interfaces:**
- Consumes: `local-store/types.ts`.
- Produces: `createSqliteStore(): LocalStore`; `getLocalStore(): Promise<LocalStore>` (factory memoizada: nativa si `Capacitor.isNativePlatform()`, idb si no); helpers puros exportados para test: `SCHEMA_SQL: string[]`, `photoFileName(photo: NewLocalPhoto): string`.

- [ ] **Step 1: Write the failing test (capa pura)**

El runtime SQLite no corre en jest; se testea lo puro (DDL y nombres de archivo). La lógica de queries queda cubierta por la simetría con idb-store (mismo contrato, mismos tests de comportamiento en Task 2) y por el E2E en dispositivo (Plan B).

`shared/src/__tests__/lib/sqlite-store-sql.test.ts`:

```ts
import { SCHEMA_SQL, photoFileName } from '@hospiwaste/shared/lib/local-store/sqlite-store'

describe('sqlite-store (capa pura)', () => {
  it('el esquema crea local_rows, local_photos y meta con WAL', () => {
    const all = SCHEMA_SQL.join('\n')
    expect(all).toContain('CREATE TABLE IF NOT EXISTS local_rows')
    expect(all).toContain('PRIMARY KEY (tbl, id)')
    expect(all).toContain('CREATE TABLE IF NOT EXISTS local_photos')
    expect(all).toContain('CREATE TABLE IF NOT EXISTS meta')
    expect(all).toContain('CREATE INDEX IF NOT EXISTS idx_local_rows_unsynced')
  })

  it('photoFileName es determinístico: photos/{photo_id}.{ext}', () => {
    expect(photoFileName({
      photo_id: 'p1', ext: 'jpg', event_type: 'route_event', event_id: 're1',
      label: '', uploaded_by: null, taken_at: '', role: null, content_type: 'image/jpeg',
    })).toBe('photos/p1.jpg')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w shared -- sqlite-store-sql`
Expected: FAIL.

- [ ] **Step 3: Implementar `shared/src/lib/local-store/sqlite-store.ts`**

```ts
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
```

- [ ] **Step 4: Implementar la factory `shared/src/lib/local-store/index.ts`**

```ts
import type { LocalStore } from './types'

export * from './types'

let instance: Promise<LocalStore> | null = null

/** LocalStore de la plataforma: SQLite+Filesystem en APK, IndexedDB en web/dev. */
export function getLocalStore(): Promise<LocalStore> {
  if (!instance) {
    instance = (async () => {
      let native = false
      try {
        const { Capacitor } = await import('@capacitor/core')
        native = Capacitor.isNativePlatform()
      } catch { /* jest/web sin capacitor */ }
      const store = native
        ? (await import('./sqlite-store')).createSqliteStore()
        : (await import('./idb-store')).createIdbStore()
      await store.init()
      return store
    })()
  }
  return instance
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -w shared -- sqlite-store-sql` → PASS. Luego `npm test -w shared` completo → verde.

- [ ] **Step 6: Commit**

```bash
git add shared/src/lib/local-store/
git commit -m "feat(offline): backend SQLite+Filesystem del LocalStore + factory por plataforma"
```

---

### Task 4: Migración del outbox IndexedDB → LocalStore

**Files:**
- Create: `shared/src/lib/local-store/migrate-outbox.ts`
- Test: `shared/src/__tests__/lib/migrate-outbox.test.ts`

**Interfaces:**
- Consumes: `LocalStore` (Task 1); `listOps`, `getPhotoBlob` (viejo), `removeOp`, `removePhotoBlob` de `@hospiwaste/shared/lib/offline-queue`; `TABLE_FOR_TYPE` de `@hospiwaste/shared/lib/outbox-sync`.
- Produces: `migrateOutboxToLocalStore(store: LocalStore): Promise<{migrated: number}>` — idempotente vía `meta.migrated_outbox`.

- [ ] **Step 1: Write the failing test**

`shared/src/__tests__/lib/migrate-outbox.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { enqueueOp, putPhotoBlob, listOps } from '@hospiwaste/shared/lib/offline-queue'
import { createIdbStore } from '@hospiwaste/shared/lib/local-store/idb-store'
import { migrateOutboxToLocalStore } from '@hospiwaste/shared/lib/local-store/migrate-outbox'

describe('migrateOutboxToLocalStore', () => {
  it('convierte ops de tabla, join tables y fotos; limpia el outbox; es idempotente', async () => {
    await enqueueOp({ op_id: 're:re1', type: 'create_route_event', payload: { id: 're1', slot: 1 }, deps: [] })
    await enqueueOp({
      op_id: 'rc:re1:dirty', type: 'add_route_containers',
      payload: { table: 'route_event_containers_dirty', rows: [{ route_event_id: 're1', container_id: 'c1' }] },
      deps: ['re:re1'],
    })
    await putPhotoBlob({ photo_id: 'p1', blob: new Blob(['x']), content_type: 'image/jpeg' })
    await enqueueOp({
      op_id: 'ph:p1', type: 'upload_photo',
      payload: { photo_id: 'p1', event_type: 'route_event', event_id: 're1', label: 'Andén',
                 uploaded_by: 'op1', taken_at: '2026-07-22T10:00:00Z', role: 'dirty', ext: 'jpg' },
      deps: ['re:re1'],
    })

    const store = createIdbStore()
    await store.init()
    const r1 = await migrateOutboxToLocalStore(store)
    expect(r1.migrated).toBe(3)

    expect((await store.getRows('route_events'))[0].payload).toEqual({ id: 're1', slot: 1 })
    const join = await store.getRows('route_event_containers_dirty')
    expect(join[0].id).toBe('re1:c1')
    expect(join[0].payload).toEqual({ route_event_id: 're1', container_id: 'c1' })
    expect(await store.getUnsyncedPhotos()).toHaveLength(1)
    expect(await store.getPhotoBlob('p1')).not.toBeNull()
    expect(await listOps()).toHaveLength(0)

    const r2 = await migrateOutboxToLocalStore(store) // idempotente
    expect(r2.migrated).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w shared -- migrate-outbox`
Expected: FAIL.

- [ ] **Step 3: Implementar `shared/src/lib/local-store/migrate-outbox.ts`**

```ts
import { listOps, getPhotoBlob, removeOp, removePhotoBlob, type OutboxOp } from '../offline-queue'
import { TABLE_FOR_TYPE } from '../outbox-sync'
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
    await migrateOne(store, op)
    await removeOp(op.op_id)
    migrated++
  }

  await store.setMeta(MIGRATED_KEY, '1')
  return { migrated }
}

async function migrateOne(store: LocalStore, op: OutboxOp): Promise<void> {
  if (op.type === 'upload_photo') {
    const p = op.payload as { photo_id: string; event_type: string; event_id: string; label: string
      uploaded_by: string | null; taken_at: string; role: string | null; ext: string }
    const entry = await getPhotoBlob(p.photo_id)
    if (entry) {
      await store.putPhoto({ ...p, content_type: entry.content_type }, entry.blob)
      await removePhotoBlob(p.photo_id)
    }
    return
  }
  if (op.type === 'add_route_containers') {
    const { table, rows } = op.payload as { table: DomainTable; rows: Array<Record<string, unknown>> }
    for (const row of rows) {
      await store.putRow(table, `${row.route_event_id}:${row.container_id}`, row)
    }
    return
  }
  const table = TABLE_FOR_TYPE[op.type] as DomainTable | undefined
  if (!table) return // tipo desconocido: se descarta con log en consola
  await store.putRow(table, (op.payload as { id: string }).id, op.payload)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w shared -- migrate-outbox`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/src/lib/local-store/migrate-outbox.ts shared/src/__tests__/lib/migrate-outbox.test.ts
git commit -m "feat(offline): migración idempotente outbox IndexedDB → LocalStore"
```

---

### Task 5: Motor de sync (`sync-engine.ts`): fases, timeout, mutex

**Files:**
- Create: `shared/src/lib/local-store/sync-engine.ts`
- Test: `shared/src/__tests__/lib/sync-engine.test.ts`

**Interfaces:**
- Consumes: `LocalStore`, `sortBySyncOrder`, `PARENT_OF`, `ON_CONFLICT` (Task 1); `isNetworkError` de `@hospiwaste/shared/lib/outbox-sync`; tipo `DB` de `@hospiwaste/shared/lib/supabase/queries/_helpers`.
- Produces: `flush(db: DB, store: LocalStore, opts?: {timeoutMs?: number}): Promise<FlushResult>` con `FlushResult = { pushedRecords: number; pushedPhotos: number; failed: number; skipped: boolean }` (`skipped: true` si el mutex estaba tomado); `REQUEST_TIMEOUT_MS = 15_000`; `withTimeout<T>(p: Promise<T>, ms: number): Promise<T>`.

- [ ] **Step 1: Write the failing test**

`shared/src/__tests__/lib/sync-engine.test.ts` (LocalStore real en memoria vía `createIdbStore` + `DB` falso):

```ts
import 'fake-indexeddb/auto'
import { createIdbStore } from '@hospiwaste/shared/lib/local-store/idb-store'
import { flush, withTimeout, REQUEST_TIMEOUT_MS } from '@hospiwaste/shared/lib/local-store/sync-engine'
import type { LocalStore } from '@hospiwaste/shared/lib/local-store/types'

/** DB falso: registra upserts y permite fallar por tabla. */
function fakeDb(failOn: Record<string, string> = {}) {
  const upserts: Array<{ table: string; row: unknown }> = []
  const uploads: string[] = []
  return {
    upserts, uploads,
    from(table: string) {
      return {
        upsert: async (row: unknown) => {
          if (failOn[table] === 'network') return Promise.reject(new TypeError('Failed to fetch'))
          if (failOn[table]) return { error: { message: failOn[table] } }
          upserts.push({ table, row })
          return { error: null }
        },
      }
    },
    storage: {
      from: () => ({
        upload: async (path: string) => { uploads.push(path); return { error: null } },
      }),
    },
  } as never
}

async function freshStore(prefix: string): Promise<LocalStore> {
  const s = createIdbStore()
  await s.init()
  return s
}

describe('flush', () => {
  it('sube en SYNC_ORDER, marca synced=1 y cuenta pushed', async () => {
    const s = await freshStore('a')
    await s.putRow('container_receptions', 'rec1', { id: 'rec1', weighing_session_id: 'wsA' })
    await s.putRow('weighing_sessions', 'wsA', { id: 'wsA' })
    const db = fakeDb()
    const r = await flush(db, s)
    expect(r.pushedRecords).toBe(2)
    expect((db as never as { upserts: Array<{ table: string }> }).upserts.map((u) => u.table))
      .toEqual(['weighing_sessions', 'container_receptions'])
    expect(await s.isRowSynced('weighing_sessions', 'wsA')).toBe(true)
  })

  it('una hija cuyo padre falló NO se sube en esta pasada', async () => {
    const s = await freshStore('b')
    await s.putRow('weighing_sessions', 'wsB', { id: 'wsB' })
    await s.putRow('container_receptions', 'recB', { id: 'recB', weighing_session_id: 'wsB' })
    const db = fakeDb({ weighing_sessions: 'RLS: rechazado' })
    const r = await flush(db, s)
    expect(r.failed).toBe(1)
    expect(await s.isRowSynced('container_receptions', 'recB')).toBe(false)
    const [ws] = await s.getRows('weighing_sessions')
    expect(ws.sync_error).toContain('rechazado')
  })

  it('las fotos solo suben cuando su registro padre está synced', async () => {
    const s = await freshStore('c')
    await s.putRow('route_events', 'reC', { id: 'reC' })
    await s.putPhoto({ photo_id: 'pC', event_type: 'route_event', event_id: 'reC', label: 'x',
      uploaded_by: null, taken_at: 't', role: null, ext: 'jpg', content_type: 'image/jpeg' },
      new Blob(['img']))
    const db = fakeDb()
    const r = await flush(db, s)
    expect(r.pushedRecords).toBe(1)
    expect(r.pushedPhotos).toBe(1)
    expect((db as never as { uploads: string[] }).uploads).toEqual(['route_event/reC/pC.jpg'])
    expect((await s.getUnsyncedPhotos())).toHaveLength(0)
  })

  it('error de red aborta la pasada sin contar intento; rechazo cuenta y sigue', async () => {
    const s = await freshStore('d')
    await s.putRow('route_events', 'reD', { id: 'reD' })
    const db = fakeDb({ route_events: 'network' })
    const r = await flush(db, s)
    expect(r.pushedRecords).toBe(0)
    const [row] = await s.getRows('route_events')
    expect(row.attempts).toBe(0) // red no cuenta intento
    expect(row.sync_error).toBeNull()
  })

  it('mutex: un flush concurrente retorna skipped', async () => {
    const s = await freshStore('e')
    await s.putRow('route_events', 'reE', { id: 'reE' })
    const slowDb = {
      from: () => ({ upsert: () => new Promise((res) => setTimeout(() => res({ error: null }), 50)) }),
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    } as never
    const [a, b] = await Promise.all([flush(slowDb, s), flush(slowDb, s)])
    expect([a.skipped, b.skipped].filter(Boolean)).toHaveLength(1)
  })
})

describe('withTimeout', () => {
  it('rechaza como error de red al expirar', async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow(/timeout/i)
  })
  it('REQUEST_TIMEOUT_MS = 15000', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(15_000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w shared -- sync-engine`
Expected: FAIL.

- [ ] **Step 3: Implementar `shared/src/lib/local-store/sync-engine.ts`**

```ts
import type { DB } from '../supabase/queries/_helpers'
import { isNetworkError } from '../outbox-sync'
import { ON_CONFLICT, PARENT_OF, sortBySyncOrder, type DomainTable, type LocalPhoto, type LocalRow, type LocalStore } from './types'

export const REQUEST_TIMEOUT_MS = 15_000
const BUCKET = 'photos'

export interface FlushResult {
  pushedRecords: number
  pushedPhotos: number
  failed: number
  skipped: boolean
}

/** Con señal débil un fetch puede colgar minutos; expirar = fallo de red del ítem. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TypeError(`request timeout tras ${ms}ms`)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

let isFlushing = false

/**
 * Fase 1: filas de dominio en SYNC_ORDER (una hija solo sube si su padre quedó
 * synced en esta pasada o antes). Fase 2: fotos de registros ya sincronizados.
 * Mutex simple; error de red aborta la pasada, rechazo marca la fila y sigue.
 */
export async function flush(
  db: DB,
  store: LocalStore,
  opts: { timeoutMs?: number } = {},
): Promise<FlushResult> {
  if (isFlushing) return { pushedRecords: 0, pushedPhotos: 0, failed: 0, skipped: true }
  isFlushing = true
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS
  const result: FlushResult = { pushedRecords: 0, pushedPhotos: 0, failed: 0, skipped: false }

  try {
    const rows = sortBySyncOrder(await store.getUnsyncedRows())
    const failedParents = new Set<string>() // `${tbl}:${id}` que fallaron en esta pasada

    for (const row of rows) {
      if (await parentBlocked(store, row, failedParents)) { continue }
      try {
        await pushRow(db, row, timeoutMs)
        await store.markRowSynced(row.tbl, row.id)
        result.pushedRecords++
      } catch (err) {
        if (isNetworkError(err)) return result // red caída: reintentar en el próximo trigger
        await store.markRowFailed(row.tbl, row.id, err instanceof Error ? err.message : String(err))
        failedParents.add(`${row.tbl}:${row.id}`)
        result.failed++
      }
    }

    for (const photo of await store.getUnsyncedPhotos()) {
      const parentTable = photo.event_type === 'route_event' ? 'route_events'
        : photo.event_type === 'reception' ? 'container_receptions'
        : null
      if (parentTable && !(await store.isRowSynced(parentTable, photo.event_id))) continue
      try {
        await pushPhoto(db, store, photo, timeoutMs)
        await store.markPhotoSynced(photo.photo_id)
        result.pushedPhotos++
      } catch (err) {
        if (isNetworkError(err)) return result
        await store.markPhotoFailed(photo.photo_id, err instanceof Error ? err.message : String(err))
        result.failed++
      }
    }
    return result
  } finally {
    isFlushing = false
  }
}

async function parentBlocked(store: LocalStore, row: LocalRow, failedNow: Set<string>): Promise<boolean> {
  const parent = PARENT_OF[row.tbl]
  if (!parent) return false
  const parentId = (row.payload[parentFk(row.tbl)] as string) ?? ''
  if (failedNow.has(`${parent}:${parentId}`)) return true
  // Si el padre no existe local (histórico ya en server), no bloquea.
  const parentRows = await store.getRows(parent)
  const local = parentRows.find((r) => r.id === parentId)
  return local ? !local.synced : false
}

function parentFk(tbl: DomainTable): string {
  return tbl === 'container_receptions' ? 'weighing_session_id' : 'route_event_id'
}

async function pushRow(db: DB, row: LocalRow, timeoutMs: number): Promise<void> {
  const { error } = await withTimeout(
    Promise.resolve(db.from(row.tbl as never).upsert(row.payload as never, { onConflict: ON_CONFLICT[row.tbl] })),
    timeoutMs,
  )
  if (error) throw new Error(`${row.tbl} upsert: ${error.message}`)
}

async function pushPhoto(db: DB, store: LocalStore, p: LocalPhoto, timeoutMs: number): Promise<void> {
  const blob = await store.getPhotoBlob(p.photo_id)
  if (!blob) throw new Error(`foto ${p.photo_id}: binario ausente`)
  const path = `${p.event_type}/${p.event_id}/${p.photo_id}.${p.ext}`
  const up = await withTimeout(
    Promise.resolve(db.storage.from(BUCKET).upload(path, blob, { contentType: p.content_type, upsert: true })),
    timeoutMs,
  )
  if (up.error) throw new Error(`storage upload: ${up.error.message}`)
  const row = {
    id: p.photo_id, storage_path: path, event_type: p.event_type, event_id: p.event_id,
    label: p.label, uploaded_by: p.uploaded_by, taken_at: p.taken_at, role: p.role,
  }
  const { error } = await withTimeout(
    Promise.resolve(db.from('photos').upsert(row as never, { onConflict: 'id' })),
    timeoutMs,
  )
  if (error) throw new Error(`photos upsert: ${error.message}`)
}
```

Nota: los builders de supabase-js son thenables — `Promise.resolve(...)` los materializa para `withTimeout`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w shared -- sync-engine`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/src/lib/local-store/sync-engine.ts shared/src/__tests__/lib/sync-engine.test.ts
git commit -m "feat(offline): sync-engine con fases registro/fotos, timeout 15s y mutex"
```

---

### Task 6: Escrituras de campo → LocalStore (`field-writes` + fotos)

**Files:**
- Modify: `app/src/lib/data/field-writes.ts` (reescritura completa)
- Modify: `shared/src/lib/data/photos.ts` (nueva `saveEventPhotosLocal`, `enqueueEventPhotos` queda para borrar en Task 9)
- Test: `app/src/__tests__/lib/field-writes.test.ts` (reescribir), `shared/src/__tests__/lib/save-photos-local.test.ts`

**Interfaces:**
- Consumes: `getLocalStore()` (Task 3).
- Produces: mismas firmas públicas actuales — `submitWeighingSession`, `submitReception`, `submitRouteEvent`, `submitTreatmentRun`, `submitStorageEvent`, `submitContainerLocation`, `notifyOutboxChanged` — pero escribiendo `local_rows` en vez de ops. Nueva `saveEventPhotosLocal(eventType, eventId, photos, uploadedBy)` en `shared/src/lib/data/photos.ts` con la misma firma y retorno que `enqueueEventPhotos` (devuelve `Photo[]` con object URLs locales). **Las páginas que hoy llaman `enqueueEventPhotos` no cambian de forma de uso.**

- [ ] **Step 1: Reescribir el test de field-writes**

`app/src/__tests__/lib/field-writes.test.ts` — reemplazar el contenido actual por assertions contra el LocalStore (el idb en jest):

```ts
import 'fake-indexeddb/auto'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { submitRouteEvent, submitWeighingSession, submitReception } from '@/lib/data/field-writes'

describe('field-writes → LocalStore', () => {
  it('submitRouteEvent inserta el evento y sus join rows con synced=0', async () => {
    await submitRouteEvent({ id: 're1', date: '2026-07-22', slot: 1, operator_id: 'op1' } as never, ['c1'], ['c2'])
    const s = await getLocalStore()
    expect((await s.getRows('route_events')).map((r) => r.id)).toContain('re1')
    expect((await s.getRows('route_event_containers_dirty'))[0].payload)
      .toEqual({ route_event_id: 're1', container_id: 'c1' })
    expect((await s.getRows('route_event_containers_clean'))[0].payload)
      .toEqual({ route_event_id: 're1', container_id: 'c2' })
  })

  it('submitReception referencia a su sesión por payload (el orden lo da SYNC_ORDER)', async () => {
    await submitWeighingSession({ id: 'ws1', client_id: 'cl', date: '2026-07-22',
      started_at: 't', operator_id: 'op1' })
    await submitReception({ id: 'rec1', weighing_session_id: 'ws1' } as never)
    const s = await getLocalStore()
    expect((await s.getRows('container_receptions'))[0].payload)
      .toMatchObject({ weighing_session_id: 'ws1' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w app -- field-writes`
Expected: FAIL (sigue encolando ops).

- [ ] **Step 3: Reescribir `app/src/lib/data/field-writes.ts`**

```ts
import type { TablesInsert } from '@hospiwaste/shared/lib/supabase/database.types'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'

/** Notifica que hay filas locales nuevas (dispara flush si hay conexión). */
export function notifyOutboxChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('hospiwaste:outbox-changed'))
  }
}

export async function submitWeighingSession(input: {
  id: string; client_id: string; date: string; started_at: string; operator_id: string
  status?: 'in_progress' | 'completed'; ended_at?: string | null
}): Promise<void> {
  const { status = 'in_progress', ended_at = null, ...rest } = input
  const store = await getLocalStore()
  await store.putRow('weighing_sessions', input.id,
    { ...rest, status, ended_at } satisfies TablesInsert<'weighing_sessions'>)
  notifyOutboxChanged()
}

export async function submitReception(
  input: TablesInsert<'container_receptions'> & { id: string; weighing_session_id: string },
): Promise<void> {
  const store = await getLocalStore()
  await store.putRow('container_receptions', input.id, input)
  notifyOutboxChanged()
}

export async function submitRouteEvent(
  input: TablesInsert<'route_events'> & { id: string },
  dirty: string[],
  clean: string[],
): Promise<void> {
  const store = await getLocalStore()
  await store.putRow('route_events', input.id, input)
  for (const cid of dirty) {
    await store.putRow('route_event_containers_dirty', `${input.id}:${cid}`,
      { route_event_id: input.id, container_id: cid })
  }
  for (const cid of clean) {
    await store.putRow('route_event_containers_clean', `${input.id}:${cid}`,
      { route_event_id: input.id, container_id: cid })
  }
  notifyOutboxChanged()
}

export async function submitTreatmentRun(input: {
  id: string; container_id: string; started_at: string; completed_at: string; operator_id: string
}): Promise<void> {
  const store = await getLocalStore()
  await store.putRow('treatment_runs', input.id, input satisfies TablesInsert<'treatment_runs'>)
  notifyOutboxChanged()
}

export async function submitStorageEvent(input: {
  id: string; container_id: string; entry_at: string; operator_id: string
}): Promise<void> {
  const store = await getLocalStore()
  await store.putRow('storage_events', input.id,
    { ...input, exit_at: null } satisfies TablesInsert<'storage_events'>)
  notifyOutboxChanged()
}

export async function submitContainerLocation(
  input: TablesInsert<'container_locations'> & { id: string },
): Promise<void> {
  const store = await getLocalStore()
  await store.putRow('container_locations', input.id, input)
  notifyOutboxChanged()
}
```

(Los helpers `weighingSessionOpId`/`receptionOpId`/`routeEventOpId` desaparecen; si alguna página los importa, quitar esos imports — verificar con `grep -rn "OpId" app/src hub/src shared/src`.)

- [ ] **Step 4: Nueva `saveEventPhotosLocal` en `shared/src/lib/data/photos.ts`**

Leer primero la implementación actual de `enqueueEventPhotos` en ese archivo y replicar su contrato exacto (conversión data URL → Blob, generación de `photo_id` uuid, object URL de retorno), cambiando el destino: `store.putPhoto(...)` en vez de `putPhotoBlob` + `enqueueOp`. Estructura:

```ts
export async function saveEventPhotosLocal(
  eventType: 'route_event' | 'reception' | 'treatment_run',
  eventId: string,
  photos: Array<{ dataUrl: string; label: string; role?: string | null }>,
  uploadedBy: string | null,
): Promise<Photo[]> {
  const store = await getLocalStore()
  const out: Photo[] = []
  for (const p of photos) {
    const photo_id = crypto.randomUUID()
    const blob = dataUrlToBlob(p.dataUrl)            // helper existente o extraer del actual
    const ext = blob.type === 'image/png' ? 'png' : 'jpg'
    await store.putPhoto({
      photo_id, event_type: eventType, event_id: eventId, label: p.label,
      uploaded_by: uploadedBy, taken_at: new Date().toISOString(),
      role: p.role ?? null, ext, content_type: blob.type,
    }, blob)
    out.push(buildLocalPhoto(photo_id, blob, p))     // mismo shape que devuelve enqueueEventPhotos
  }
  return out
}
```

Cambiar los call sites de `enqueueEventPhotos` → `saveEventPhotosLocal` (buscar con `grep -rn "enqueueEventPhotos" app/src shared/src` — son las páginas de pesaje, andén y morgue). `enqueueEventPhotos` queda sin call sites (se borra en Task 9).

- [ ] **Step 5: Test de fotos**

`shared/src/__tests__/lib/save-photos-local.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { saveEventPhotosLocal } from '@hospiwaste/shared/lib/data/photos'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

it('guarda el blob local y devuelve Photo con id de cliente', async () => {
  const [photo] = await saveEventPhotosLocal('route_event', 're9', [{ dataUrl: PNG_1PX, label: 'Andén' }], 'op1')
  const store = await getLocalStore()
  expect(await store.getPhotoBlob(photo.id)).not.toBeNull()
  const [meta] = await store.getUnsyncedPhotos()
  expect(meta.event_id).toBe('re9')
  expect(meta.ext).toBe('png')
})
```

- [ ] **Step 6: Run tests**

Run: `npm test -w app -- field-writes` y `npm test -w shared -- save-photos-local`
Expected: PASS. Después `npm test -w app` y `npm test -w shared` completos (habrá suites viejas de enqueue-photos/field-writes que ajustar o marcar para Task 9 — solo tocar las que rompan por los call sites cambiados).

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/data/field-writes.ts app/src/__tests__/lib/field-writes.test.ts shared/src/lib/data/photos.ts shared/src/__tests__/lib/save-photos-local.test.ts
git commit -m "feat(offline): escrituras de campo directas al LocalStore (filas de dominio + fotos)"
```

---

### Task 7: Hidratación local-first + merge (elimina el bug del duplicado)

**Files:**
- Create: `shared/src/lib/local-store/hydrate-local.ts`
- Modify: `shared/src/components/supabase-hydrator.tsx`
- Modify: `shared/src/lib/data/hydrate-merge.ts` (evolución de `pendingRecordIds`)
- Test: `shared/src/__tests__/lib/hydrate-local.test.ts`, ajustar `shared/src/__tests__/lib/hydrate-merge.test.ts`

**Interfaces:**
- Consumes: `getLocalStore()`, `getRows` por tabla; el shape de estado del store Zustand (`shared/src/lib/store.ts`) y el mapeo servidor→store que ya hace `supabase-hydrator.tsx`.
- Produces: `hydrateFromLocal(store: LocalStore): Promise<LocalSnapshot>` donde `LocalSnapshot = { routeEvents, receptions, weighingSessions, treatmentRuns, containerLocations, storageEvents, dirtyByEvent, cleanByEvent, photosByEvent }` (payloads crudos agrupados, listos para el mismo mapeo que usa el hydrator con filas de Supabase); `localPendingIds(store): Promise<Set<string>>` reemplaza a `pendingRecordIds()`.

- [ ] **Step 1: Write the failing test**

`shared/src/__tests__/lib/hydrate-local.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { createIdbStore } from '@hospiwaste/shared/lib/local-store/idb-store'
import { hydrateFromLocal, localPendingIds } from '@hospiwaste/shared/lib/local-store/hydrate-local'

it('agrupa filas locales por entidad y expone joins por evento', async () => {
  const s = createIdbStore()
  await s.init()
  await s.putRow('route_events', 'reH', { id: 'reH', slot: 2 })
  await s.putRow('route_event_containers_dirty', 'reH:c1', { route_event_id: 'reH', container_id: 'c1' })
  await s.putRow('weighing_sessions', 'wsH', { id: 'wsH' })
  await s.markRowSynced('weighing_sessions', 'wsH')

  const snap = await hydrateFromLocal(s)
  expect(snap.routeEvents).toEqual([{ id: 'reH', slot: 2 }])
  expect(snap.dirtyByEvent.get('reH')).toEqual(['c1'])
  expect(snap.weighingSessions).toEqual([{ id: 'wsH' }]) // synced también se hidrata: es el estado del día

  const pending = await localPendingIds(s)
  expect(pending.has('reH')).toBe(true)
  expect(pending.has('wsH')).toBe(false) // ya sincronizada: el server la trae
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w shared -- hydrate-local` → FAIL.

- [ ] **Step 3: Implementar `shared/src/lib/local-store/hydrate-local.ts`**

```ts
import type { LocalStore } from './types'

export interface LocalSnapshot {
  routeEvents: Array<Record<string, unknown>>
  weighingSessions: Array<Record<string, unknown>>
  receptions: Array<Record<string, unknown>>
  treatmentRuns: Array<Record<string, unknown>>
  containerLocations: Array<Record<string, unknown>>
  storageEvents: Array<Record<string, unknown>>
  dirtyByEvent: Map<string, string[]>
  cleanByEvent: Map<string, string[]>
}

/** Todo lo local (synced o no): es el estado del día del dispositivo. */
export async function hydrateFromLocal(store: LocalStore): Promise<LocalSnapshot> {
  const payloadsOf = async (tbl: Parameters<LocalStore['getRows']>[0]) =>
    (await store.getRows(tbl)).map((r) => r.payload)

  const joinMap = async (tbl: 'route_event_containers_dirty' | 'route_event_containers_clean') => {
    const m = new Map<string, string[]>()
    for (const r of await store.getRows(tbl)) {
      const ev = r.payload.route_event_id as string
      m.set(ev, [...(m.get(ev) ?? []), r.payload.container_id as string])
    }
    return m
  }

  return {
    routeEvents: await payloadsOf('route_events'),
    weighingSessions: await payloadsOf('weighing_sessions'),
    receptions: await payloadsOf('container_receptions'),
    treatmentRuns: await payloadsOf('treatment_runs'),
    containerLocations: await payloadsOf('container_locations'),
    storageEvents: await payloadsOf('storage_events'),
    dirtyByEvent: await joinMap('route_event_containers_dirty'),
    cleanByEvent: await joinMap('route_event_containers_clean'),
  }
}

/** Ids de registros aún no subidos — lo que el merge del hydrator debe preservar. */
export async function localPendingIds(store: LocalStore): Promise<Set<string>> {
  const rows = await store.getUnsyncedRows()
  return new Set(rows.map((r) => r.id))
}
```

- [ ] **Step 4: Cablear en `supabase-hydrator.tsx`**

Leer el hydrator actual y aplicar este orden (patrón, adaptar a su estructura real):

1. **Antes** de cualquier fetch a Supabase: `const local = await hydrateFromLocal(await getLocalStore())` y poblar el store Zustand con el snapshot usando **el mismo mapeo fila→estado** que ya se aplica a las filas del server (extraer ese mapeo a función si hoy está inline). Además, en el arranque de `app/` llamar `migrateOutboxToLocalStore` (Task 4) **antes** de `hydrateFromLocal`.
2. El fetch a Supabase sigue igual; al mergear, `pendingIds` viene de `localPendingIds(store)` en vez de `pendingRecordIds()`. `mergeById` no cambia de semántica (server + locales pendientes, sin pisar).
3. Si el fetch falla (offline), el estado local ya está en el store — no vaciar nada en el catch.

En `hydrate-merge.ts`: `pendingRecordIds` (basada en prefijos de op) se elimina y sus usos pasan a `localPendingIds`. Ajustar `hydrate-merge.test.ts` (los tests de `mergeById` quedan; los de prefijos se borran).

- [ ] **Step 5: Run tests**

Run: `npm test -w shared -- hydrate-local hydrate-merge` → PASS. Luego `npm test -w shared`, `npm test -w app`, `npm test -w hub` y `npm run build:hub` — el hydrator es compartido: en hub el LocalStore web devuelve vacío y el flujo queda igual que hoy.

- [ ] **Step 6: Commit**

```bash
git add shared/src/lib/local-store/hydrate-local.ts shared/src/components/supabase-hydrator.tsx shared/src/lib/data/hydrate-merge.ts shared/src/__tests__/
git commit -m "feat(offline): hidratación local-first + merge por id — la UI lee del dispositivo"
```

---

### Task 8: Hook de sync + indicador con contadores y errores visibles

**Files:**
- Modify: `app/src/hooks/use-offline-sync.ts` (reescritura)
- Modify: `app/src/components/layout/sync-indicator.tsx`
- Test: `app/src/__tests__/hooks/use-offline-sync.test.tsx` (crear si no existe)

**Interfaces:**
- Consumes: `flush`, `FlushResult` (Task 5); `getLocalStore`, `PendingCounts` (Tasks 1/3).
- Produces: `useOfflineSync(): { isOnline: boolean; counts: PendingCounts; refreshCounts(): Promise<void> }`. El indicador muestra: todo en 0 → "Todo sincronizado"; pendientes → "N registros y M fotos por sincronizar"; `rejected > 0` → variante de error "K elementos rechazados — revisar" (estilo `text-destructive`, no se oculta).

- [ ] **Step 1: Reescribir `use-offline-sync.ts`**

```ts
'use client'

import { useEffect, useState, useCallback } from 'react'
import { getLocalStore, type PendingCounts } from '@hospiwaste/shared/lib/local-store'
import { flush } from '@hospiwaste/shared/lib/local-store/sync-engine'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'

const ZERO: PendingCounts = { records: 0, photos: 0, rejected: 0 }

export function useOfflineSync() {
  const [counts, setCounts] = useState<PendingCounts>(ZERO)
  const [isOnline, setIsOnline] = useState(true)

  const refreshCounts = useCallback(async () => {
    setCounts(await (await getLocalStore()).pendingCounts())
  }, [])

  const sync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    try {
      await flush(createClient(), await getLocalStore())
    } catch (err) {
      console.error('[offline-sync] flush falló:', err)
    }
    await refreshCounts()
  }, [refreshCounts])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshCounts()
    if (navigator.onLine) sync()

    function handleOnline() { setIsOnline(true); sync() }
    function handleOffline() { setIsOnline(false) }
    function onVisible() { if (document.visibilityState === 'visible') sync() }
    function onChanged() { sync() }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('hospiwaste:outbox-changed', onChanged)
    const interval = setInterval(sync, 30_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('hospiwaste:outbox-changed', onChanged)
      clearInterval(interval)
    }
  }, [sync, refreshCounts])

  return { isOnline, counts, refreshCounts }
}
```

(El trigger de foreground nativo ya existe en `app-lifecycle.tsx` vía `appStateChange` → revisar que dispare `hospiwaste:outbox-changed` o llame el sync; si no, agregarlo ahí.)

- [ ] **Step 2: Actualizar `sync-indicator.tsx`**

Leer el componente actual y cambiar `pendingCount: number` por `counts: PendingCounts` con los tres estados de copy descritos en Interfaces. Mantener el estilo existente; el estado de error usa el token destructivo del design system.

- [ ] **Step 3: Test del hook**

`app/src/__tests__/hooks/use-offline-sync.test.tsx` con `@testing-library/react` (ya usado en suites de app/hub):

```tsx
import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { useOfflineSync } from '@/hooks/use-offline-sync'

jest.mock('@hospiwaste/shared/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({ upsert: async () => ({ error: null }) }),
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
  }),
}))

it('expone los contadores de pendientes del LocalStore', async () => {
  const store = await getLocalStore()
  await store.putRow('route_events', 'reX', { id: 'reX' })
  const { result } = renderHook(() => useOfflineSync())
  await waitFor(() => expect(result.current.counts.records + result.current.counts.photos).toBeGreaterThanOrEqual(0))
  // tras el sync automático con red "ok", converge a 0
  await waitFor(() => expect(result.current.counts.records).toBe(0))
})
```

- [ ] **Step 4: Run tests**

Run: `npm test -w app` → verde.

- [ ] **Step 5: Commit**

```bash
git add app/src/hooks/use-offline-sync.ts app/src/components/layout/sync-indicator.tsx app/src/__tests__/hooks/use-offline-sync.test.tsx
git commit -m "feat(offline): hook de sync sobre el motor nuevo + indicador con registros/fotos/rechazos"
```

---

### Task 9: Reglas de edición + retiro del outbox viejo

**Files:**
- Modify: páginas de edición de campo en `app/src/app/register/` (`weighing/page.tsx` `handleSaveEdit`, `route/anden/[slot]/register-route-slot-client.tsx` `handleUpdateAnden`, `route/morgue/page.tsx` según su handler de edición)
- Modify: `shared/src/lib/data/photos.ts` (borrar `enqueueEventPhotos`), `shared/src/lib/offline-queue.ts` (borrar helpers de outbox salvo los que usa la migración), `shared/src/lib/outbox-sync.ts` (queda solo `isNetworkError` y `TABLE_FOR_TYPE` — mover ambos a `local-store/` y borrar el archivo)
- Test: ajustar/borrar `outbox-sync-drain.test.ts`, `enqueue-photos.test.ts`, `offline-queue.test.ts` (conservar lo que cubre la migración)

**Interfaces:**
- Consumes: `getLocalStore().isRowSynced` (Task 3), `putRow` (Task 1).
- Produces: helper `applyFieldEdit` en `app/src/lib/data/field-edits.ts`:
  `applyFieldEdit(tbl: DomainTable, id: string, payload: Record<string, unknown>, onlineUpdate: () => Promise<void>): Promise<'local' | 'online'>` — si `isRowSynced === false` reescribe la fila local (el flush sube la versión final) y devuelve `'local'`; si `true`, ejecuta `onlineUpdate()` y **propaga el error** (la página lo muestra — prohibido el fallo silencioso).

- [ ] **Step 1: Write the failing test**

`app/src/__tests__/lib/field-edits.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { applyFieldEdit } from '@/lib/data/field-edits'

it('registro no sincronizado: reescribe local sin llamar online', async () => {
  const s = await getLocalStore()
  await s.putRow('route_events', 'reE1', { id: 'reE1', v: 1 })
  const online = jest.fn()
  const mode = await applyFieldEdit('route_events', 'reE1', { id: 'reE1', v: 2 }, online)
  expect(mode).toBe('local')
  expect(online).not.toHaveBeenCalled()
  expect((await s.getRows('route_events')).find((r) => r.id === 'reE1')?.payload).toEqual({ id: 'reE1', v: 2 })
})

it('registro sincronizado: va online y propaga el error', async () => {
  const s = await getLocalStore()
  await s.putRow('route_events', 'reE2', { id: 'reE2' })
  await s.markRowSynced('route_events', 'reE2')
  await expect(
    applyFieldEdit('route_events', 'reE2', { id: 'reE2' }, async () => { throw new Error('sin red') }),
  ).rejects.toThrow('sin red')
})
```

- [ ] **Step 2: Run test to verify it fails** → `npm test -w app -- field-edits` FAIL.

- [ ] **Step 3: Implementar `app/src/lib/data/field-edits.ts`**

```ts
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
```

- [ ] **Step 4: Cablear las páginas de edición**

En cada handler de edición de campo (leer cada archivo primero): envolver la actualización actual a Supabase en `applyFieldEdit(...)`, construyendo el `payload` con la fila editada completa (mismo shape que el submit original). En el `catch` de la página: mostrar el error con el mecanismo de feedback que ya use esa pantalla (toast/banner existente) — verificar que ninguna rama trague el error.

- [ ] **Step 5: Retirar el outbox viejo**

- `shared/src/lib/outbox-sync.ts`: mover `isNetworkError` y `TABLE_FOR_TYPE` a `shared/src/lib/local-store/` (ajustar imports de `sync-engine.ts` y `migrate-outbox.ts`), borrar el resto (`applyOp`, `drainOutbox`, `applyUploadPhoto`) y el archivo.
- `shared/src/lib/offline-queue.ts`: conservar solo lo que consume la migración (`listOps`, `getPhotoBlob`, `removeOp`, `removePhotoBlob`, `enqueueOp`+`putPhotoBlob` para tests, tipos); borrar `bumpAttempts`, `countPendingOps` y el store legacy `queue` si ya no tiene usos (`grep -rn "countPendingOps\|bumpAttempts\|dequeueAll\|clearAll\|getQueueCount" app/src hub/src shared/src`).
- Tests: borrar `outbox-sync-drain.test.ts` y `enqueue-photos.test.ts`; reducir `offline-queue.test.ts` a los helpers que sobreviven.

- [ ] **Step 6: Run full suites**

Run: `npm test` (root, los 3 workspaces) y `npm run build:app && npm run build:hub`
Expected: todo verde.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(offline): edición local/online con error visible + retiro del outbox IndexedDB"
```

---

### Task 10: Sesión en Preferences con expiración por inactividad de 1 h

**Files:**
- Create: `shared/src/lib/supabase/preferences-storage.ts`
- Modify: `shared/src/lib/supabase/client.ts` (elegir storage por plataforma)
- Modify: donde viva el timer de auto-logout de operador (buscar con `grep -rn "session-timeout" app/src shared/src` — `shared/src/lib/session-timeout.ts` y su montaje en `app-lifecycle.tsx` o layout)
- Test: `shared/src/__tests__/lib/preferences-storage.test.ts`

**Interfaces:**
- Consumes: `@capacitor/preferences` (dinámico), `sessionStorageAdapter` existente como fallback web.
- Produces: `preferencesStorageAdapter` (misma interfaz `getItem/setItem/removeItem` async que acepta supabase-js) + `touchActivity(): Promise<void>` y `isSessionExpired(): Promise<boolean>` (clave `last_activity_at` en Preferences, umbral `INACTIVITY_LIMIT_MS = 3_600_000`).
- **Decisión aplicada (usuario, 2026-07-22):** en el APK la sesión ya NO muere al cerrar la app; persiste en Preferences y expira **solo** por inactividad de 1 h (chequeada al arrancar y al volver a foreground: expirada → `signOut()` + `/login`). En web (hub y dev) se mantiene `sessionStorageAdapter` tal cual.

- [ ] **Step 1: Write the failing test**

`shared/src/__tests__/lib/preferences-storage.test.ts` (mock del plugin):

```ts
const kv = new Map<string, string>()
jest.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: kv.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { kv.set(key, value) },
    remove: async ({ key }: { key: string }) => { kv.delete(key) },
  },
}), { virtual: true })

import { preferencesStorageAdapter, touchActivity, isSessionExpired, INACTIVITY_LIMIT_MS } from '@hospiwaste/shared/lib/supabase/preferences-storage'

it('get/set/remove van a Preferences', async () => {
  await preferencesStorageAdapter.setItem('k', 'v')
  expect(await preferencesStorageAdapter.getItem('k')).toBe('v')
  await preferencesStorageAdapter.removeItem('k')
  expect(await preferencesStorageAdapter.getItem('k')).toBeNull()
})

it('sesión expira tras 1h de inactividad', async () => {
  await touchActivity()
  expect(await isSessionExpired()).toBe(false)
  kv.set('hospiwaste_last_activity_at', String(Date.now() - INACTIVITY_LIMIT_MS - 1000))
  expect(await isSessionExpired()).toBe(true)
})

it('sin actividad registrada no se considera expirada (primer login)', async () => {
  kv.delete('hospiwaste_last_activity_at')
  expect(await isSessionExpired()).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.

- [ ] **Step 3: Implementar `shared/src/lib/supabase/preferences-storage.ts`**

```ts
export const INACTIVITY_LIMIT_MS = 3_600_000 // 1 h — política de teléfonos compartidos
const ACTIVITY_KEY = 'hospiwaste_last_activity_at'

async function prefs() {
  const { Preferences } = await import('@capacitor/preferences')
  return Preferences
}

/** Storage de sesión Supabase sobre Preferences: sobrevive al cierre del WebView. */
export const preferencesStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    return (await (await prefs()).get({ key })).value
  },
  async setItem(key: string, value: string): Promise<void> {
    await (await prefs()).set({ key, value })
  },
  async removeItem(key: string): Promise<void> {
    await (await prefs()).remove({ key })
  },
}

export async function touchActivity(): Promise<void> {
  await (await prefs()).set({ key: ACTIVITY_KEY, value: String(Date.now()) })
}

/** true solo si hubo actividad registrada y pasó más de 1 h. */
export async function isSessionExpired(): Promise<boolean> {
  const { value } = await (await prefs()).get({ key: ACTIVITY_KEY })
  if (!value) return false
  return Date.now() - Number(value) > INACTIVITY_LIMIT_MS
}
```

- [ ] **Step 4: Cablear**

- `client.ts`: leer el archivo; donde hoy pasa `sessionStorageAdapter` al `createClient` de supabase-js, elegir por plataforma: `Capacitor.isNativePlatform()` (import dinámico con try/catch) → `preferencesStorageAdapter`, si no → `sessionStorageAdapter`. Como la detección es sync-imposible en módulo, exponer el adapter híbrido: métodos que deciden en su primera llamada y memoizan.
- Timer de inactividad existente (`session-timeout.ts`): además de su lógica actual, llamar `touchActivity()` en cada interacción registrada (throttle 30 s para no castigar Preferences).
- En el arranque de `app/` y en el evento de foreground (`app-lifecycle.tsx`): `if (await isSessionExpired()) { await supabase.auth.signOut(); router.replace('/login') }` — solo en plataforma nativa.

- [ ] **Step 5: Run tests** → `npm test -w shared` y `npm test -w app` verdes; `npm run build:app` verde.

- [ ] **Step 6: Commit**

```bash
git add shared/src/lib/supabase/ app/src/
git commit -m "feat(session): sesión APK en Preferences con expiración por inactividad de 1h"
```

---

### Task 11: Cierre — suites completas, builds, vault

**Files:**
- Modify: `vault/_index.md` (fila nueva en la tabla de estado + nota de procesamiento)
- Create: `vault/logs/2026-07-22-offline-sqlite-local-first.md`
- Modify: `vault/logs/2026-06-19-offline-outbox-campo.md` (nota de reemplazo al tope apuntando al log nuevo)

- [ ] **Step 1: Verificación total**

```bash
npm test && npm run build:app && npm run build:hub && npm run test:ui
```

Expected: jest de los 3 workspaces + vitest verdes, ambos builds OK. (Skill: superpowers:verification-before-completion — pegar la salida real en el log.)

- [ ] **Step 2: `npx cap sync android` desde `app/`**

Registra los plugins nuevos (sqlite/filesystem/preferences) en el proyecto Android. No compila (eso es Plan B), pero deja los gradle regenerados y commiteables.

- [ ] **Step 3: Log del vault**

`vault/logs/2026-07-22-offline-sqlite-local-first.md` con: qué se hizo (por tarea), decisiones (tabla `local_rows` genérica, fotos con `synced` propio en vez de `photos_synced`, sesión 1h en Preferences), verificación (números reales de tests), pendiente (Plan B nativo + E2E en dispositivo). Actualizar `_index.md` (fila + nota). Nota de reemplazo en el log del outbox del 2026-06-19.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs(vault): log del motor offline SQLite local-first (Plan A completo)"
```

---

## Self-review (hecho al redactar)

- **Cobertura del spec:** §4.1 → Tasks 1–3; §4.2 → Tasks 2–3; §4.3 → Tasks 5 y 8; §4.4 → Tasks 6, 7 y 9; §4.6 → Task 4; §6 (sesión) → Task 10; §4.5 y criterios E2E → Plan B (`2026-07-22-offline-sqlite-B-nativo.md`).
- **Riesgo señalado:** Tasks 7 y 9 tocan archivos cuyo contenido exacto el implementador debe leer primero (hydrator, páginas de edición); los pasos indican el patrón y cómo localizar los puntos con grep.
- **Cutover:** desde Task 6 la app escribe al LocalStore y ya no al outbox; la migración (Task 4, cableada en Task 7) cubre dispositivos con cola vieja. Entre Tasks 6 y 7 no hay release intermedio — el plan se mergea completo.
