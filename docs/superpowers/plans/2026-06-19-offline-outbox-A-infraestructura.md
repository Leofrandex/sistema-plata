# Offline Outbox — Plan A: Infraestructura (motor de sync) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la infraestructura local-first del offline: una cola (outbox) en IndexedDB y un motor de sincronización idempotente que drena las operaciones en orden de dependencias, sin tocar todavía la UI.

**Architecture:** Un módulo IndexedDB compartido (`idb.ts`) unifica la apertura de la base `hospiwaste-offline` (hoy abierta con versiones en conflicto por dos módulos). Sobre él, `offline-queue.ts` expone un store `outbox` de operaciones y un store `photo_blobs`. Un módulo puro `outbox-sync.ts` mapea cada operación a un upsert idempotente de Supabase (por `id` de cliente) y drena la cola respetando dependencias, sin que una operación atascada bloquee a las independientes. El hook `use-offline-sync.ts` dispara el drenado y expone el conteo de pendientes.

**Tech Stack:** TypeScript estricto · `idb` (ya instalado) · `@supabase/supabase-js` · Jest + `fake-indexeddb` (ya instalados).

## Global Constraints

- TypeScript estricto; sin `any` salvo casts puntuales justificados.
- Base IndexedDB única: `hospiwaste-offline`. Todos los stores se crean en un único `upgrade` centralizado en `src/lib/idb.ts`. Stores: `queue` (legacy, se conserva), `active_sessions` (ya existe, de `active-session.ts`), `outbox` (nuevo), `photo_blobs` (nuevo).
- **Idempotencia obligatoria:** toda escritura de sync usa `upsert(payload, { onConflict: '<pk>' })`. Las fotos se suben a una ruta de Storage **determinística por `photo_id`** con `upsert: true`.
- **Reintento indefinido** ante rechazo no-red; una operación atascada **no bloquea** a las independientes (solo a las que dependen de ella).
- Clasificación de error: **red** (sin conexión / fetch falla) → reintentar luego sin contar intento; **no-red** (rechazo del servidor) → `attempts++` y reintentar igual.
- Tests con `fake-indexeddb/auto` y un cliente Supabase **simulado** (objeto mock), no la red real.
- Verificación de cada tarea: `npm run test:jest -- <filtro>` en verde.

---

### Task 1: Módulo IndexedDB compartido + stores del outbox

**Files:**
- Create: `src/lib/idb.ts`
- Modify: `src/lib/offline-queue.ts`
- Modify: `src/lib/active-session.ts`
- Test: `src/__tests__/lib/offline-queue.test.ts` (extender)

**Interfaces:**
- Produces (`src/lib/idb.ts`):
  - `const DB_NAME = 'hospiwaste-offline'`, `const DB_VERSION = 3`
  - `getDB(): Promise<IDBPDatabase>` — abre la base creando, si faltan, los stores `queue` (keyPath `id`, autoIncrement), `active_sessions` (keyPath `key`), `outbox` (keyPath `op_id`), `photo_blobs` (keyPath `photo_id`).
- Produces (`src/lib/offline-queue.ts`):
  - `type OutboxOpType = 'create_route_event' | 'add_route_containers' | 'create_weighing_session' | 'create_reception' | 'create_treatment_run' | 'create_container_location' | 'create_storage_event' | 'upload_photo'`
  - `interface OutboxOp { op_id: string; type: OutboxOpType; payload: Record<string, unknown>; deps: string[]; created_at: string; attempts: number }`
  - `interface PhotoBlobEntry { photo_id: string; blob: Blob; content_type: string }`
  - `enqueueOp(op: Omit<OutboxOp,'created_at'|'attempts'>): Promise<void>` (setea `created_at=now`, `attempts=0`)
  - `listOps(): Promise<OutboxOp[]>` (orden FIFO ascendente por `created_at`)
  - `removeOp(op_id: string): Promise<void>`
  - `bumpAttempts(op_id: string): Promise<void>`
  - `countPendingOps(): Promise<number>`
  - `putPhotoBlob(e: PhotoBlobEntry): Promise<void>`, `getPhotoBlob(photo_id: string): Promise<PhotoBlobEntry | undefined>`, `removePhotoBlob(photo_id: string): Promise<void>`
  - Se conservan `enqueue/dequeueAll/clearAll/getQueueCount` (store `queue` legacy) reexportados desde el nuevo `getDB`.

- [ ] **Step 1: Escribir el test (falla)**

Agregar al final de `src/__tests__/lib/offline-queue.test.ts` (mantener los tests existentes):

```ts
import {
  enqueueOp, listOps, removeOp, bumpAttempts, countPendingOps,
  putPhotoBlob, getPhotoBlob, removePhotoBlob,
} from '@/lib/offline-queue'

describe('outbox ops', () => {
  beforeEach(async () => {
    const ops = await listOps()
    await Promise.all(ops.map((o) => removeOp(o.op_id)))
  })

  it('encola, lista en orden FIFO y cuenta', async () => {
    await enqueueOp({ op_id: 'a', type: 'create_weighing_session', payload: { id: 's1' }, deps: [] })
    await enqueueOp({ op_id: 'b', type: 'create_reception', payload: { id: 'r1' }, deps: ['a'] })
    const ops = await listOps()
    expect(ops.map((o) => o.op_id)).toEqual(['a', 'b'])
    expect(ops[0].attempts).toBe(0)
    expect(ops[0].created_at).toBeTruthy()
    expect(await countPendingOps()).toBe(2)
  })

  it('removeOp y bumpAttempts', async () => {
    await enqueueOp({ op_id: 'a', type: 'create_weighing_session', payload: {}, deps: [] })
    await bumpAttempts('a')
    await bumpAttempts('a')
    const [op] = await listOps()
    expect(op.attempts).toBe(2)
    await removeOp('a')
    expect(await countPendingOps()).toBe(0)
  })

  it('guarda y recupera blobs de foto', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' })
    await putPhotoBlob({ photo_id: 'p1', blob, content_type: 'image/jpeg' })
    const got = await getPhotoBlob('p1')
    expect(got?.content_type).toBe('image/jpeg')
    await removePhotoBlob('p1')
    expect(await getPhotoBlob('p1')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test:jest -- offline-queue`
Expected: FAIL (export no existe).

- [ ] **Step 3: Crear `src/lib/idb.ts`**

```ts
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
```

- [ ] **Step 4: Reescribir `src/lib/offline-queue.ts`**

```ts
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
```

- [ ] **Step 5: Apuntar `active-session.ts` al `getDB` compartido**

En `src/lib/active-session.ts`, eliminar su `openDB`/`getDB` local y el bloque `DB_NAME/DB_VERSION/STORE_NAME` de apertura; importar `{ getDB }` de `./idb`. Reemplazar el cuerpo de su `getDB()` local: borrar la función local y sustituir todas sus llamadas `getDB()` por el import compartido. Conservar `STORE_NAME = 'active_sessions'` como constante local para las llamadas (`db.put(STORE_NAME, ...)`, etc.). El resto del archivo (tipos, `startSession`, `getActiveSession`, `endSession`, `listActiveSessions`, helpers de key, `todayLocal`) no cambia.

- [ ] **Step 6: Correr y ver pasar**

Run: `npm run test:jest -- offline-queue active-session`
Expected: PASS (tests viejos de queue + nuevos de outbox + los de active-session si existen).

- [ ] **Step 7: Commit**

```bash
git add src/lib/idb.ts src/lib/offline-queue.ts src/lib/active-session.ts src/__tests__/lib/offline-queue.test.ts
git commit -m "feat(offline): base IndexedDB compartida + store outbox y photo_blobs"
```

---

### Task 2: Aplicación idempotente de una operación + clasificación de error

**Files:**
- Create: `src/lib/outbox-sync.ts`
- Test: `src/__tests__/lib/outbox-sync-apply.test.ts`

**Interfaces:**
- Consumes: `OutboxOp`, `getPhotoBlob` de `@/lib/offline-queue`; `DB` de `@/lib/supabase/queries/_helpers`.
- Produces:
  - `isNetworkError(err: unknown): boolean`
  - `applyOp(db: DB, op: OutboxOp): Promise<void>` — ejecuta el upsert idempotente correspondiente. Lanza si Supabase devuelve error (el llamador clasifica).
  - `const TABLE_FOR_TYPE: Partial<Record<OutboxOpType, string>>` (solo ops de tabla simple).

- [ ] **Step 1: Escribir el test (falla)**

```ts
// src/__tests__/lib/outbox-sync-apply.test.ts
/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto'
import { applyOp, isNetworkError } from '@/lib/outbox-sync'
import { putPhotoBlob } from '@/lib/offline-queue'
import type { OutboxOp } from '@/lib/offline-queue'

// Mock mínimo del cliente Supabase: registra los upserts y simula Storage.
function makeDb() {
  const calls: { table: string; payload: unknown; onConflict?: string }[] = []
  const storage: { path: string; upsert?: boolean }[] = []
  const db = {
    from(table: string) {
      return {
        upsert(payload: unknown, opts?: { onConflict?: string }) {
          calls.push({ table, payload, onConflict: opts?.onConflict })
          return Promise.resolve({ error: null })
        },
      }
    },
    storage: {
      from() {
        return {
          upload(path: string, _blob: Blob, opts?: { upsert?: boolean }) {
            storage.push({ path, upsert: opts?.upsert })
            return Promise.resolve({ error: null })
          },
        }
      },
    },
  }
  return { db: db as unknown as Parameters<typeof applyOp>[0], calls, storage }
}

describe('applyOp', () => {
  it('upsert idempotente de una reception por id', async () => {
    const { db, calls } = makeDb()
    const op: OutboxOp = {
      op_id: 'o1', type: 'create_reception',
      payload: { id: 'r1', container_id: 'c1' }, deps: [], created_at: '', attempts: 0,
    }
    await applyOp(db, op)
    expect(calls).toHaveLength(1)
    expect(calls[0].table).toBe('container_receptions')
    expect(calls[0].onConflict).toBe('id')
  })

  it('add_route_containers hace upsert en la join table con onConflict compuesto', async () => {
    const { db, calls } = makeDb()
    const op: OutboxOp = {
      op_id: 'o2', type: 'add_route_containers',
      payload: { table: 'route_event_containers_dirty', rows: [{ route_event_id: 're1', container_id: 'c1' }] },
      deps: ['ev'], created_at: '', attempts: 0,
    }
    await applyOp(db, op)
    expect(calls[0].table).toBe('route_event_containers_dirty')
    expect(calls[0].onConflict).toBe('route_event_id,container_id')
  })

  it('upload_photo sube el blob a ruta determinística (upsert) y upserta la fila', async () => {
    const { db, calls, storage } = makeDb()
    await putPhotoBlob({ photo_id: 'p1', blob: new Blob(['x'], { type: 'image/jpeg' }), content_type: 'image/jpeg' })
    const op: OutboxOp = {
      op_id: 'o3', type: 'upload_photo',
      payload: { photo_id: 'p1', event_type: 'weighing', event_id: 'r1', label: 'L', uploaded_by: 'u1', taken_at: 't', role: null, ext: 'jpg' },
      deps: ['rec'], created_at: '', attempts: 0,
    }
    await applyOp(db, op)
    expect(storage[0].path).toBe('weighing/r1/p1.jpg')
    expect(storage[0].upsert).toBe(true)
    expect(calls[0].table).toBe('photos')
    expect(calls[0].onConflict).toBe('id')
  })
})

describe('isNetworkError', () => {
  it('detecta fallos de red por TypeError fetch', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('duplicate key value'))).toBe(false)
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test:jest -- outbox-sync-apply`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/lib/outbox-sync.ts`**

```ts
import type { DB } from './supabase/queries/_helpers'
import { getPhotoBlob, type OutboxOp, type OutboxOpType } from './offline-queue'

/** Mapa de ops de tabla simple → nombre de tabla. Su payload es la fila completa
 *  (con id de cliente). Se upserta con onConflict 'id'. */
export const TABLE_FOR_TYPE: Partial<Record<OutboxOpType, string>> = {
  create_route_event: 'route_events',
  create_weighing_session: 'weighing_sessions',
  create_reception: 'container_receptions',
  create_treatment_run: 'treatment_runs',
  create_container_location: 'container_locations',
  create_storage_event: 'storage_events',
}

const BUCKET = 'photos'

/** ¿El error proviene de falta de conexión (no de un rechazo del servidor)? */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true // fetch lanza TypeError sin red
  const msg = err instanceof Error ? err.message : String(err)
  return /failed to fetch|network|fetch failed|load failed/i.test(msg)
}

/**
 * Aplica una operación contra Supabase de forma idempotente. Lanza si Supabase
 * devuelve error; el llamador (drainOutbox) clasifica red vs no-red.
 */
export async function applyOp(db: DB, op: OutboxOp): Promise<void> {
  if (op.type === 'upload_photo') return applyUploadPhoto(db, op)
  if (op.type === 'add_route_containers') return applyRouteContainers(db, op)

  const table = TABLE_FOR_TYPE[op.type]
  if (!table) throw new Error(`applyOp: tipo no soportado ${op.type}`)
  const { error } = await db.from(table).upsert(op.payload, { onConflict: 'id' })
  if (error) throw new Error(`${table} upsert: ${error.message}`)
}

async function applyRouteContainers(db: DB, op: OutboxOp): Promise<void> {
  const table = op.payload.table as string
  const rows = op.payload.rows as Record<string, unknown>[]
  if (rows.length === 0) return
  const { error } = await db.from(table).upsert(rows, { onConflict: 'route_event_id,container_id' })
  if (error) throw new Error(`${table} upsert: ${error.message}`)
}

async function applyUploadPhoto(db: DB, op: OutboxOp): Promise<void> {
  const p = op.payload as {
    photo_id: string; event_type: string; event_id: string; label: string
    uploaded_by: string | null; taken_at: string; role: string | null; ext: string
  }
  const entry = await getPhotoBlob(p.photo_id)
  if (!entry) throw new Error(`upload_photo: blob ausente para ${p.photo_id}`)

  // Ruta determinística por photo_id → reintentos sobreescriben, no duplican.
  const path = `${p.event_type}/${p.event_id}/${p.photo_id}.${p.ext}`
  const up = await db.storage.from(BUCKET).upload(path, entry.blob, {
    contentType: entry.content_type,
    upsert: true,
  })
  if (up.error) throw new Error(`storage upload: ${up.error.message}`)

  const row = {
    id: p.photo_id, storage_path: path, event_type: p.event_type, event_id: p.event_id,
    label: p.label, uploaded_by: p.uploaded_by, taken_at: p.taken_at, role: p.role,
  }
  const { error } = await db.from('photos').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(`photos upsert: ${error.message}`)
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test:jest -- outbox-sync-apply`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/outbox-sync.ts src/__tests__/lib/outbox-sync-apply.test.ts
git commit -m "feat(offline): applyOp idempotente + clasificación de error de red"
```

---

### Task 3: Drenado por dependencias

**Files:**
- Modify: `src/lib/outbox-sync.ts`
- Test: `src/__tests__/lib/outbox-sync-drain.test.ts`

**Interfaces:**
- Consumes: `listOps`, `removeOp`, `bumpAttempts`, `removePhotoBlob` de `@/lib/offline-queue`; `applyOp`, `isNetworkError` (Task 2).
- Produces:
  - `interface DrainResult { synced: number; remaining: number; stuck: number }`
  - `drainOutbox(db: DB): Promise<DrainResult>` — aplica las ops cuyas `deps` ya no están en la cola; remueve en éxito (y el blob si es `upload_photo`); ante error de red detiene el ciclo (deja todo para reintentar); ante error no-red incrementa intentos y **continúa** con las demás (no bloquea). Devuelve el resumen.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// src/__tests__/lib/outbox-sync-drain.test.ts
/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto'
import { drainOutbox } from '@/lib/outbox-sync'
import { enqueueOp, listOps, removeOp } from '@/lib/offline-queue'

async function clearOutbox() {
  for (const o of await listOps()) await removeOp(o.op_id)
}

// db que falla de forma controlada según la tabla/registro.
function makeDb(opts: { failTable?: string; network?: boolean } = {}) {
  const applied: string[] = []
  const db = {
    from(table: string) {
      return {
        upsert(payload: { id?: string }) {
          if (opts.failTable === table) {
            return opts.network
              ? Promise.reject(new TypeError('Failed to fetch'))
              : Promise.resolve({ error: { message: 'duplicate key' } })
          }
          applied.push(`${table}:${(payload as { id?: string }).id ?? '?'}`)
          return Promise.resolve({ error: null })
        },
      }
    },
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
  }
  return { db: db as unknown as Parameters<typeof drainOutbox>[0], applied }
}

beforeEach(clearOutbox)

it('drena en orden de dependencias y limpia la cola', async () => {
  await enqueueOp({ op_id: 'sess', type: 'create_weighing_session', payload: { id: 's1' }, deps: [] })
  await enqueueOp({ op_id: 'rec', type: 'create_reception', payload: { id: 'r1' }, deps: ['sess'] })
  const { db, applied } = makeDb()
  const res = await drainOutbox(db)
  expect(res.synced).toBe(2)
  expect(applied).toEqual(['weighing_sessions:s1', 'container_receptions:r1'])
  expect(await listOps()).toHaveLength(0)
})

it('una op no-red atascada no bloquea a las independientes', async () => {
  await enqueueOp({ op_id: 'bad', type: 'create_weighing_session', payload: { id: 'bad' }, deps: [] })
  await enqueueOp({ op_id: 'good', type: 'create_storage_event', payload: { id: 'g1' }, deps: [] })
  const { db, applied } = makeDb({ failTable: 'weighing_sessions' })
  const res = await drainOutbox(db)
  expect(applied).toEqual(['storage_events:g1'])
  expect(res.synced).toBe(1)
  const remaining = await listOps()
  expect(remaining.map((o) => o.op_id)).toEqual(['bad'])
  expect(remaining[0].attempts).toBe(1) // intento contado
})

it('un dependiente de una op atascada no se aplica', async () => {
  await enqueueOp({ op_id: 'sess', type: 'create_weighing_session', payload: { id: 'bad' }, deps: [] })
  await enqueueOp({ op_id: 'rec', type: 'create_reception', payload: { id: 'r1' }, deps: ['sess'] })
  const { db, applied } = makeDb({ failTable: 'weighing_sessions' })
  await drainOutbox(db)
  expect(applied).toEqual([]) // rec espera a sess
  expect((await listOps()).map((o) => o.op_id).sort()).toEqual(['rec', 'sess'])
})

it('error de red detiene el ciclo sin contar intento', async () => {
  await enqueueOp({ op_id: 'a', type: 'create_storage_event', payload: { id: 'a' }, deps: [] })
  const { db } = makeDb({ failTable: 'storage_events', network: true })
  const res = await drainOutbox(db)
  expect(res.synced).toBe(0)
  const [op] = await listOps()
  expect(op.attempts).toBe(0)
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test:jest -- outbox-sync-drain`
Expected: FAIL (`drainOutbox` no existe).

- [ ] **Step 3: Implementar `drainOutbox` en `src/lib/outbox-sync.ts`**

Agregar imports y la función:

```ts
import {
  listOps, removeOp, bumpAttempts, removePhotoBlob,
} from './offline-queue'

export interface DrainResult { synced: number; remaining: number; stuck: number }

/**
 * Drena el outbox respetando dependencias. Una op solo corre cuando todas sus
 * deps ya salieron de la cola. Error de red → detiene (reintentar luego, sin
 * contar intento). Error no-red → cuenta intento y sigue con las demás (no
 * bloquea independientes). Reintento indefinido: las atascadas quedan en cola.
 */
export async function drainOutbox(db: DB): Promise<DrainResult> {
  let synced = 0
  let stuck = 0

  // Iteramos por rondas: en cada ronda aplicamos las ops "listas" (deps fuera de
  // la cola) que no estén marcadas como atascadas en esta pasada. Paramos cuando
  // una ronda no logra progreso o cae la red.
  for (;;) {
    const ops = await listOps()
    const pendingIds = new Set(ops.map((o) => o.op_id))
    const ready = ops.filter((o) => o.deps.every((d) => !pendingIds.has(d)))
    if (ready.length === 0) break

    let progressed = false
    let networkDown = false

    for (const op of ready) {
      try {
        await applyOp(db, op)
        await removeOp(op.op_id)
        if (op.type === 'upload_photo') {
          await removePhotoBlob((op.payload as { photo_id: string }).photo_id)
        }
        synced++
        progressed = true
      } catch (err) {
        if (isNetworkError(err)) { networkDown = true; break }
        await bumpAttempts(op.op_id) // no-red: reintento indefinido, no bloquea
        stuck++
      }
    }

    if (networkDown || !progressed) break
  }

  const remaining = (await listOps()).length
  return { synced, remaining, stuck }
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test:jest -- outbox-sync-drain`
Expected: PASS (los 4 casos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/outbox-sync.ts src/__tests__/lib/outbox-sync-drain.test.ts
git commit -m "feat(offline): drenado del outbox por dependencias (no bloquea independientes)"
```

---

### Task 4: Hook de sync real + indicador honesto

**Files:**
- Modify: `src/hooks/use-offline-sync.ts`
- Modify: `src/components/layout/sync-indicator.tsx`

**Interfaces:**
- Consumes: `countPendingOps` de `@/lib/offline-queue`; `drainOutbox` (Task 3); `createClient` de `@/lib/supabase/client`.
- Produces: `useOfflineSync(): { isOnline: boolean; pendingCount: number; refreshCount: () => Promise<void> }` — drena el outbox al volver `online`, al enfocar la pestaña, por intervalo (30 s) y al recibir el evento `hospiwaste:outbox-changed`; mantiene `pendingCount` desde `countPendingOps`.

- [ ] **Step 1: Reescribir `src/hooks/use-offline-sync.ts`**

```ts
'use client'

import { useEffect, useState, useCallback } from 'react'
import { countPendingOps } from '@/lib/offline-queue'
import { drainOutbox } from '@/lib/outbox-sync'
import { createClient } from '@/lib/supabase/client'

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)

  const refreshCount = useCallback(async () => {
    setPendingCount(await countPendingOps())
  }, [])

  const sync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    try {
      await drainOutbox(createClient())
    } catch (err) {
      // El drenado individual ya maneja sus errores; esto cubre fallos al abrir
      // el cliente. No es fatal: se reintenta en el próximo disparo.
      console.error('[offline-sync] drain falló:', err)
    }
    await refreshCount()
  }, [refreshCount])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshCount()
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
  }, [sync, refreshCount])

  return { isOnline, pendingCount, refreshCount }
}
```

- [ ] **Step 2: Ajustar el texto del indicador**

En `src/components/layout/sync-indicator.tsx`, reemplazar el texto del estado online-con-pendientes para reflejar la cola del outbox (sin cambiar la lógica de `useOfflineSync`):

```tsx
      {isOnline ? (
        <><RefreshCw className="h-4 w-4 animate-spin" />{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''} · sincronizando…</>
      ) : (
        <><WifiOff className="h-4 w-4" />Sin conexión · {pendingCount} en cola</>
      )}
```

- [ ] **Step 3: Verificar build y typecheck**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-offline-sync.ts src/components/layout/sync-indicator.tsx
git commit -m "feat(offline): hook de sync drena el outbox + indicador honesto"
```

---

## Verificación final (Plan A)

- [ ] `npm run test:jest` — toda la suite verde (incluye `offline-queue`, `outbox-sync-apply`, `outbox-sync-drain`).
- [ ] `npm run build` — compila sin errores.
- [ ] El motor queda listo y testeado, **sin** que ningún flujo de campo lo use todavía (eso es Plan B). El indicador mostrará 0 pendientes porque aún nadie encola.

## Notas de cobertura (self-review)

- Outbox + blobs (T1) · applyOp idempotente con upsert por id y rutas de Storage determinísticas (T2) · drenado por dependencias sin bloqueo de independientes + clasificación red/no-red + reintento indefinido (T3) · disparadores de sync y conteo de pendientes (T4).
- Pendiente para **Plan B:** ids de cliente en los handlers, encolar las ops con sus `deps`, `merge` al hidratar, emitir `hospiwaste:outbox-changed` al encolar, mostrar object URLs locales mientras la foto no sube.
- El `onConflict: 'route_event_id,container_id'` asume PK compuesta en las join tables (es así en el schema). El `onConflict: 'id'` asume PK `id` (todas las tablas operativas la tienen).
