# Offline Outbox — Plan B: Integración (cableado local-first) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cablear los flujos de campo (pesaje, recorrido andén, recorrido morgue) al motor offline del Plan A, de modo que cada **creación** se guarde local y avance al instante, encole su sincronización, y no desaparezca al recargar.

**Architecture:** Un módulo `src/lib/data/field-writes.ts` concentra la lógica local-first: genera ids de cliente (`crypto.randomUUID()`), encola las operaciones con sus dependencias (`op_id` con prefijos estables), guarda los blobs de foto y emite `hospiwaste:outbox-changed`. Los handlers de las páginas pasan de `await q.createX(...) + uploadEventPhotos(...)` a llamar estas funciones y actualizar el store con el registro local. El hydrator deja de sobrescribir: hace **merge** conservando los registros locales aún en el outbox.

**Tech Stack:** Next.js 16 · React 19 · Zustand · `@supabase/supabase-js` · Jest + `fake-indexeddb`.

## Global Constraints

- TypeScript estricto; sin `any` salvo casts puntuales justificados.
- **Alcance offline = CREACIÓN.** Iniciar sesión de pesaje, crear recepción, crear andén, crear/finalizar morgue, y los derivados del cierre de pesaje (treatment_run / storage_event / container_location) se vuelven local-first. **Edición, cancelación, anulación y borrado siguen online** como hoy (best-effort, sin cambios).
- **Contratos del motor (Plan A) que este plan DEBE respetar:**
  - Encolar **padre antes que hijo** (FIFO por `created_at`); `op_id` único.
  - `event_type` de foto del enum (`'route' | 'weighing' | ...`).
  - Emitir el evento `window` `hospiwaste:outbox-changed` tras encolar (el hook `use-offline-sync` ya lo escucha).
  - Merge al hidratar: conservar registros locales aún en el outbox (no sobrescribir).
- **Esquema de `op_id` (prefijos estables, derivados del id de cliente del registro):**
  `ws:<sessionId>` · `rec:<receptionId>` · `re:<routeEventId>` · `rc:<routeEventId>:dirty` · `rc:<routeEventId>:clean` · `tr:<treatmentRunId>` · `se:<storageEventId>` · `cl:<containerLocationId>` · `photo:<photoId>`.
- Interfaces del Plan A disponibles en `@/lib/offline-queue` (`enqueueOp`, `OutboxOp`, `OutboxOpType`, `putPhotoBlob`, `countPendingOps`, `listOps`) y `@/lib/outbox-sync` (`drainOutbox`).
- Verificación: `npm run test:jest -- <filtro>` verde; `npm run build` cuando se toquen páginas.

---

### Task 1: Helper de fotos local-first (`enqueueEventPhotos`)

**Files:**
- Modify: `src/lib/data/photos.ts`
- Test: `src/__tests__/lib/enqueue-photos.test.ts`

**Interfaces:**
- Consumes: `putPhotoBlob`, `enqueueOp` de `@/lib/offline-queue`; `Photo` de `@/lib/types`.
- Produces:
  - `interface EnqueuePhotoArgs { dataUrls: (string|null|undefined)[]; eventType: 'route'|'weighing'|'storage'|'treatment'|'other'; eventId: string; label: string; uploadedBy?: string|null; takenAt?: string; role?: string|null; parentOpId: string }`
  - `enqueueEventPhotos(args: EnqueuePhotoArgs): Promise<Photo[]>` — por cada dataUrl no vacío: genera `photoId = crypto.randomUUID()`, convierte a Blob, `putPhotoBlob`, `enqueueOp({ op_id: 'photo:'+photoId, type:'upload_photo', payload:{ photo_id, event_type, event_id, label, uploaded_by, taken_at, role, ext }, deps:[parentOpId] })`. Devuelve objetos `Photo` con `url` = object URL local (para mostrar al instante).

- [ ] **Step 1: Escribir el test (falla)**

```ts
// src/__tests__/lib/enqueue-photos.test.ts
/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto'
import { enqueueEventPhotos } from '@/lib/data/photos'
import { listOps, getPhotoBlob } from '@/lib/offline-queue'

// jsdom no está; stub mínimo de URL.createObjectURL para entorno node.
beforeAll(() => {
  // @ts-expect-error: stub de test
  global.URL.createObjectURL = () => 'blob:local/mock'
})

const DATA_URL = 'data:image/jpeg;base64,' + Buffer.from('x').toString('base64')

it('encola una op upload_photo por foto, con blob y dep al padre', async () => {
  const photos = await enqueueEventPhotos({
    dataUrls: [DATA_URL, null, DATA_URL],
    eventType: 'weighing', eventId: 'r1', label: 'L',
    uploadedBy: 'u1', takenAt: 't', role: null, parentOpId: 'rec:r1',
  })
  expect(photos).toHaveLength(2)
  expect(photos[0].url).toBe('blob:local/mock')

  const ops = (await listOps()).filter((o) => o.type === 'upload_photo')
  expect(ops).toHaveLength(2)
  expect(ops[0].deps).toEqual(['rec:r1'])
  expect(ops[0].op_id.startsWith('photo:')).toBe(true)
  const pid = (ops[0].payload as { photo_id: string }).photo_id
  expect(await getPhotoBlob(pid)).toBeTruthy()
  expect((ops[0].payload as { event_type: string }).event_type).toBe('weighing')
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test:jest -- enqueue-photos`
Expected: FAIL (export no existe).

- [ ] **Step 3: Implementar en `src/lib/data/photos.ts`**

Agregar imports y la función (conservar `uploadEventPhotos` existente para flujos no-campo):

```ts
import { putPhotoBlob, enqueueOp } from '@/lib/offline-queue'

export interface EnqueuePhotoArgs {
  dataUrls: (string | null | undefined)[]
  eventType: 'route' | 'weighing' | 'storage' | 'treatment' | 'other'
  eventId: string
  label: string
  uploadedBy?: string | null
  takenAt?: string
  role?: string | null
  parentOpId: string
}

/** Convierte un data URL a Blob (igual que el helper interno de queries/photos). */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function blobExt(type: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  }
  return map[type] ?? 'jpg'
}

/**
 * Versión local-first de uploadEventPhotos: NO sube a la red. Guarda el blob en
 * IndexedDB y encola una op `upload_photo` por foto (dep = parentOpId). Devuelve
 * objetos Photo con object URL local para mostrar al instante.
 */
export async function enqueueEventPhotos(args: EnqueuePhotoArgs): Promise<Photo[]> {
  const out: Photo[] = []
  const takenAt = args.takenAt ?? new Date().toISOString()
  for (const dataUrl of args.dataUrls) {
    if (!dataUrl) continue
    const photoId = crypto.randomUUID()
    const blob = dataUrlToBlob(dataUrl)
    const ext = blobExt(blob.type)
    await putPhotoBlob({ photo_id: photoId, blob, content_type: blob.type || 'image/jpeg' })
    await enqueueOp({
      op_id: `photo:${photoId}`,
      type: 'upload_photo',
      payload: {
        photo_id: photoId, event_type: args.eventType, event_id: args.eventId,
        label: args.label, uploaded_by: args.uploadedBy ?? null, taken_at: takenAt,
        role: args.role ?? null, ext,
      },
      deps: [args.parentOpId],
    })
    out.push({
      id: photoId,
      url: URL.createObjectURL(blob),
      event_type: args.eventType,
      event_id: args.eventId,
      taken_at: takenAt,
      label: args.label,
    })
  }
  return out
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test:jest -- enqueue-photos`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/photos.ts src/__tests__/lib/enqueue-photos.test.ts
git commit -m "feat(offline): enqueueEventPhotos (blob local + op upload_photo)"
```

---

### Task 2: Módulo de escrituras de campo (`field-writes.ts`)

**Files:**
- Create: `src/lib/data/field-writes.ts`
- Test: `src/__tests__/lib/field-writes.test.ts`

**Interfaces:**
- Consumes: `enqueueOp`, `OutboxOpType` de `@/lib/offline-queue`; `enqueueEventPhotos`, `EnqueuePhotoArgs` (Task 1); tipos `TablesInsert` de `@/lib/supabase/database.types`.
- Produces (todas generan ids de cliente, encolan, y al final emiten `hospiwaste:outbox-changed`):
  - `notifyOutboxChanged(): void` — `window.dispatchEvent(new Event('hospiwaste:outbox-changed'))` (no-op en SSR).
  - `submitWeighingSession(input: { id: string; client_id: string; date: string; started_at: string; operator_id: string }): Promise<void>` — encola `ws:<id>` tipo `create_weighing_session`, payload con `status:'in_progress'`.
  - `submitReception(input: TablesInsert<'container_receptions'> & { id: string; weighing_session_id: string }): Promise<void>` — encola `rec:<id>` tipo `create_reception`, deps `['ws:'+weighing_session_id]`.
  - `submitRouteEvent(input: TablesInsert<'route_events'> & { id: string }, dirty: string[], clean: string[]): Promise<void>` — encola `re:<id>` (`create_route_event`); si `dirty.length` encola `rc:<id>:dirty` (`add_route_containers`, payload `{ table:'route_event_containers_dirty', rows:[{route_event_id,container_id}] }`, deps `['re:'+id]`); ídem clean.
  - `submitTreatmentRun(input: { id: string; container_id: string; started_at: string; completed_at: string; operator_id: string }): Promise<void>` — `tr:<id>` (`create_treatment_run`).
  - `submitStorageEvent(input: { id: string; container_id: string; entry_at: string; operator_id: string }): Promise<void>` — `se:<id>` (`create_storage_event`, `exit_at:null`).
  - `submitContainerLocation(input: TablesInsert<'container_locations'> & { id: string }): Promise<void>` — `cl:<id>` (`create_container_location`).
  - `weighingSessionOpId(id)`, `receptionOpId(id)`, `routeEventOpId(id)` helpers (devuelven `'ws:'+id`, etc.) para que los handlers deriven el `parentOpId` de las fotos.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// src/__tests__/lib/field-writes.test.ts
/**
 * @jest-environment jsdom
 */
import 'fake-indexeddb/auto'
import {
  submitWeighingSession, submitReception, submitRouteEvent,
  routeEventOpId,
} from '@/lib/data/field-writes'
import { listOps, removeOp } from '@/lib/offline-queue'

// jsdom provee window + Event para notifyOutboxChanged; no hace falta stub.
beforeEach(async () => {
  for (const o of await listOps()) await removeOp(o.op_id)
})

it('encola sesión y recepción con dep correcta', async () => {
  await submitWeighingSession({ id: 's1', client_id: 'c1', date: 'd', started_at: 't', operator_id: 'u1' })
  await submitReception({
    id: 'r1', container_id: 'c1', weighing_session_id: 's1', arrived_at: 't',
    gross_weight_kg: 10, operator_id: 'u1', observations: '', company_id: null,
    waste_type: 'infectious', treat_immediately: false,
  })
  const ops = await listOps()
  const ws = ops.find((o) => o.op_id === 'ws:s1')!
  const rec = ops.find((o) => o.op_id === 'rec:r1')!
  expect(ws.type).toBe('create_weighing_session')
  expect((ws.payload as { status: string }).status).toBe('in_progress')
  expect(rec.type).toBe('create_reception')
  expect(rec.deps).toEqual(['ws:s1'])
})

it('encola route_event + containers dirty/clean con deps al evento', async () => {
  await submitRouteEvent(
    { id: 're1', client_id: 'c1', company_id: null, kind: 'anden', slot: '06:30', date: 'd', started_at: 't', operator_id: 'u1', status: 'in_progress', area: 'A' },
    ['t1', 't2'], ['t3'],
  )
  const ops = await listOps()
  expect(ops.find((o) => o.op_id === 'rc:re1:dirty')!.deps).toEqual([routeEventOpId('re1')])
  const dirty = ops.find((o) => o.op_id === 'rc:re1:dirty')!
  expect((dirty.payload as { table: string }).table).toBe('route_event_containers_dirty')
  expect((dirty.payload as { rows: unknown[] }).rows).toHaveLength(2)
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test:jest -- field-writes`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/lib/data/field-writes.ts`**

```ts
import type { TablesInsert } from '@/lib/supabase/database.types'
import { enqueueOp } from '@/lib/offline-queue'

export function weighingSessionOpId(id: string): string { return `ws:${id}` }
export function receptionOpId(id: string): string { return `rec:${id}` }
export function routeEventOpId(id: string): string { return `re:${id}` }

/** Notifica al hook de sync que hay ops nuevas (drena si hay conexión). */
export function notifyOutboxChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('hospiwaste:outbox-changed'))
  }
}

export async function submitWeighingSession(input: {
  id: string; client_id: string; date: string; started_at: string; operator_id: string
}): Promise<void> {
  await enqueueOp({
    op_id: weighingSessionOpId(input.id),
    type: 'create_weighing_session',
    payload: { ...input, status: 'in_progress', ended_at: null } satisfies TablesInsert<'weighing_sessions'>,
    deps: [],
  })
  notifyOutboxChanged()
}

export async function submitReception(
  input: TablesInsert<'container_receptions'> & { id: string; weighing_session_id: string }
): Promise<void> {
  await enqueueOp({
    op_id: receptionOpId(input.id),
    type: 'create_reception',
    payload: input,
    deps: [weighingSessionOpId(input.weighing_session_id)],
  })
  notifyOutboxChanged()
}

export async function submitRouteEvent(
  input: TablesInsert<'route_events'> & { id: string },
  dirty: string[],
  clean: string[],
): Promise<void> {
  await enqueueOp({
    op_id: routeEventOpId(input.id),
    type: 'create_route_event',
    payload: input,
    deps: [],
  })
  if (dirty.length > 0) {
    await enqueueOp({
      op_id: `rc:${input.id}:dirty`,
      type: 'add_route_containers',
      payload: { table: 'route_event_containers_dirty', rows: dirty.map((cid) => ({ route_event_id: input.id, container_id: cid })) },
      deps: [routeEventOpId(input.id)],
    })
  }
  if (clean.length > 0) {
    await enqueueOp({
      op_id: `rc:${input.id}:clean`,
      type: 'add_route_containers',
      payload: { table: 'route_event_containers_clean', rows: clean.map((cid) => ({ route_event_id: input.id, container_id: cid })) },
      deps: [routeEventOpId(input.id)],
    })
  }
  notifyOutboxChanged()
}

export async function submitTreatmentRun(input: {
  id: string; container_id: string; started_at: string; completed_at: string; operator_id: string
}): Promise<void> {
  await enqueueOp({
    op_id: `tr:${input.id}`, type: 'create_treatment_run',
    payload: input satisfies TablesInsert<'treatment_runs'>, deps: [],
  })
  notifyOutboxChanged()
}

export async function submitStorageEvent(input: {
  id: string; container_id: string; entry_at: string; operator_id: string
}): Promise<void> {
  await enqueueOp({
    op_id: `se:${input.id}`, type: 'create_storage_event',
    payload: { ...input, exit_at: null } satisfies TablesInsert<'storage_events'>, deps: [],
  })
  notifyOutboxChanged()
}

export async function submitContainerLocation(
  input: TablesInsert<'container_locations'> & { id: string }
): Promise<void> {
  await enqueueOp({
    op_id: `cl:${input.id}`, type: 'create_container_location', payload: input, deps: [],
  })
  notifyOutboxChanged()
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test:jest -- field-writes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/field-writes.ts src/__tests__/lib/field-writes.test.ts
git commit -m "feat(offline): módulo field-writes (encola creaciones con deps)"
```

---

### Task 3: Merge al hidratar (conservar pendientes locales)

**Files:**
- Create: `src/lib/data/hydrate-merge.ts`
- Modify: `src/components/supabase-hydrator.tsx`
- Test: `src/__tests__/lib/hydrate-merge.test.ts`

**Interfaces:**
- Consumes: `listOps` de `@/lib/offline-queue`.
- Produces:
  - `mergeById<T extends { id: string }>(serverRows: T[], localRows: T[], pendingIds: Set<string>): T[]` — devuelve los `serverRows` más los `localRows` cuyo `id` está en `pendingIds` y NO está ya en `serverRows`. (Pura.)
  - `pendingRecordIds(): Promise<Set<string>>` — deriva del outbox los ids de registro pendientes a partir de los `op_id` con prefijos `ws:`/`rec:`/`re:`/`tr:`/`se:`/`cl:` (quita el prefijo).

- [ ] **Step 1: Escribir el test (falla)**

```ts
// src/__tests__/lib/hydrate-merge.test.ts
/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto'
import { mergeById, pendingRecordIds } from '@/lib/data/hydrate-merge'
import { enqueueOp, listOps, removeOp } from '@/lib/offline-queue'

beforeEach(async () => { for (const o of await listOps()) await removeOp(o.op_id) })

it('mergeById conserva el local pendiente que aún no está en el server', () => {
  const server = [{ id: 'a', v: 1 }]
  const local = [{ id: 'a', v: 9 }, { id: 'b', v: 2 }]
  const merged = mergeById(server, local, new Set(['b']))
  expect(merged.map((r) => r.id).sort()).toEqual(['a', 'b'])
  // 'a' ya está en server → no se duplica ni se pisa con el local
  expect(merged.find((r) => r.id === 'a')!.v).toBe(1)
})

it('pendingRecordIds quita los prefijos de op_id', async () => {
  await enqueueOp({ op_id: 'rec:r1', type: 'create_reception', payload: {}, deps: [] })
  await enqueueOp({ op_id: 're:e1', type: 'create_route_event', payload: {}, deps: [] })
  await enqueueOp({ op_id: 'photo:p1', type: 'upload_photo', payload: {}, deps: [] })
  const ids = await pendingRecordIds()
  expect(ids.has('r1')).toBe(true)
  expect(ids.has('e1')).toBe(true)
  expect(ids.has('p1')).toBe(false) // las fotos no son "registros" del store
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test:jest -- hydrate-merge`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/lib/data/hydrate-merge.ts`**

```ts
import { listOps } from '@/lib/offline-queue'

/** Une server + locales pendientes por id, sin duplicar ni pisar lo del server. */
export function mergeById<T extends { id: string }>(
  serverRows: T[],
  localRows: T[],
  pendingIds: Set<string>,
): T[] {
  const serverIds = new Set(serverRows.map((r) => r.id))
  const extras = localRows.filter((r) => pendingIds.has(r.id) && !serverIds.has(r.id))
  return [...serverRows, ...extras]
}

const RECORD_PREFIXES = ['ws:', 'rec:', 're:', 'tr:', 'se:', 'cl:']

/** Ids de registro (no fotos) que siguen pendientes de subir, derivados del outbox. */
export async function pendingRecordIds(): Promise<Set<string>> {
  const ops = await listOps()
  const ids = new Set<string>()
  for (const op of ops) {
    const prefix = RECORD_PREFIXES.find((p) => op.op_id.startsWith(p))
    if (prefix) ids.add(op.op_id.slice(prefix.length).split(':')[0])
  }
  return ids
}
```

- [ ] **Step 4: Cablear el merge en el hydrator**

En `src/components/supabase-hydrator.tsx`, dentro de `load()`, justo antes de `useStore.getState().hydrate({...})`, capturar el estado local previo y los ids pendientes, y envolver las colecciones afectadas con `mergeById`. Agregar import:

```ts
import { mergeById, pendingRecordIds } from '@/lib/data/hydrate-merge'
```

Y reemplazar el bloque `useStore.getState().hydrate({ ... })` por:

```ts
        const pend = await pendingRecordIds()
        const prev = useStore.getState()
        useStore.getState().hydrate({
          containers,
          weighingSessions: mergeById(weighingSessions, prev.weighingSessions, pend),
          receptions: mergeById(receptions, prev.receptions, pend),
          routeEvents: mergeById(routeEvents, prev.routeEvents, pend),
          photos,
          storageEvents: mergeById(storageEvents, prev.storageEvents, pend),
          treatmentRuns: mergeById(treatmentRuns, prev.treatmentRuns, pend),
          externalTransfers,
          locations: mergeById(locations, prev.locations, pend),
          users,
        })
```

(Las colecciones no afectadas por creación offline —containers, photos, externalTransfers, users— no se mergean.)

- [ ] **Step 5: Correr tests y build**

Run: `npm run test:jest -- hydrate-merge && npm run build`
Expected: tests PASS; build compila.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/hydrate-merge.ts src/components/supabase-hydrator.tsx src/__tests__/lib/hydrate-merge.test.ts
git commit -m "feat(offline): merge al hidratar conserva registros pendientes locales"
```

---

### Task 4: Cablear Pesaje (sesión + recepción + derivados)

**Files:**
- Modify: `src/app/register/weighing/page.tsx`

**Interfaces:**
- Consumes: `submitWeighingSession`, `submitReception`, `submitTreatmentRun`, `submitStorageEvent`, `submitContainerLocation`, `receptionOpId` de `@/lib/data/field-writes`; `enqueueEventPhotos` de `@/lib/data/photos`.

- [ ] **Step 1: Reescribir `handleStart` (local-first)**

Reemplazar el cuerpo de `handleStart` (líneas ~138-183) para generar el id de cliente y encolar en vez de `await q.createWeighingSession`:

```ts
  async function handleStart() {
    if (!currentProfileId || !client) return
    const now = new Date().toISOString()
    const createdId = crypto.randomUUID()
    await submitWeighingSession({
      id: createdId, client_id: client.id, date: today,
      started_at: now, operator_id: currentProfileId,
    })
    addWeighingSession({
      id: createdId, client_id: client.id, date: today, started_at: now,
      ended_at: null, operator_id: currentProfileId, status: 'in_progress', reception_ids: [],
    })
    const newSession: ActiveSession = {
      key: weighingSessionKey(today), type: 'weighing', started_at: now,
      context: { type: 'weighing', client_id: client.id, date: today, operator_id: currentProfileId, weighing_session_id: createdId },
    }
    await startSession(newSession)
    setActiveSession(newSession)
  }
```

- [ ] **Step 2: Reescribir `persistWeighingPhotos` y `handleCreateReception`**

Reemplazar `persistWeighingPhotos` (usa `enqueueEventPhotos` con `parentOpId`) y el cuerpo de `handleCreateReception` (genera id, encola, NO espera red):

```ts
  async function persistWeighingPhotos(
    receptionId: string, label: string, takenAt: string, dataUrls: (string | null | undefined)[],
  ): Promise<string[]> {
    const enqueued = await enqueueEventPhotos({
      dataUrls, eventType: 'weighing', eventId: receptionId, label,
      uploadedBy: currentProfileId, takenAt, parentOpId: receptionOpId(receptionId),
    })
    enqueued.forEach(addPhoto)
    return enqueued.map((p) => p.id)
  }

  async function handleCreateReception(currentSessionId: string, gross: number) {
    if (!session || !currentProfileId) return
    const now = new Date().toISOString()
    const label = buildPhotoLabel()
    const receptionId = crypto.randomUUID()

    await submitReception({
      id: receptionId, container_id: formState.container_id, weighing_session_id: currentSessionId,
      arrived_at: now, gross_weight_kg: gross, operator_id: currentProfileId,
      observations: formState.observations, company_id: inheritedCompanyId,
      waste_type: formState.waste_type, treat_immediately: formState.treat_immediately,
    })

    const photoIds = await persistWeighingPhotos(receptionId, label, now, [
      formState.photo_container, formState.photo_scale,
    ])

    addReception({
      id: receptionId, container_id: formState.container_id, weighing_session_id: currentSessionId,
      arrived_at: now, gross_weight_kg: gross, operator_id: currentProfileId, photo_ids: photoIds,
      observations: formState.observations, company_id: inheritedCompanyId,
      waste_type: formState.waste_type, treat_immediately: formState.treat_immediately,
```

Conservar el resto del cuerpo original de `handleCreateReception` a partir de la llamada a `addReception` (los campos `voided_*` y el cierre de función, más el `updateWeighingSession`/`resetForm` que siguen). NO cambiar `handleSaveEdit` (edición sigue online).

- [ ] **Step 3: Reescribir los derivados en `handleFinish`**

En `handleFinish` (líneas ~385-456): la actualización de la sesión a `completed` puede seguir online (es edición de un registro que quizás aún está en cola; ver nota). Para mantener simple y consistente con "creación offline", reemplazar el cierre de sesión por una **actualización optimista del store** + encolar los derivados como creaciones. Reemplazar el bloque desde el paso 1 hasta el paso 2 (derivados) por:

```ts
  async function handleFinish() {
    if (!activeSession || activeSession.context.type !== 'weighing' || !session || !currentProfileId) return
    const ctx = activeSession.context
    const now = new Date().toISOString()

    // Cerrar sesión: optimista en store + intento online best-effort (si la
    // sesión aún está en cola, el upsert de creación ya la llevará como in_progress;
    // el cierre se reintenta al reabrir/hidratar). No bloquea.
    updateWeighingSession(ctx.weighing_session_id, { status: 'completed', ended_at: now })
    try {
      await q.updateWeighingSession(createClient(), ctx.weighing_session_id, { status: 'completed', ended_at: now })
    } catch (err) {
      console.error('[pesaje] cerrar sesión (online) falló, sigue local:', err)
    }

    // Derivados por reception: TreatmentRun (inmediato) o StorageEvent + ContainerLocation.
    for (const r of sessionReceptions) {
      if (r.treat_immediately && r.waste_type === 'infectious') {
        const trId = crypto.randomUUID()
        await submitTreatmentRun({ id: trId, container_id: r.container_id, started_at: now, completed_at: now, operator_id: currentProfileId })
        addTreatmentRun({ id: trId, container_id: r.container_id, started_at: now, completed_at: now, operator_id: currentProfileId })
        const locId = crypto.randomUUID()
        await submitContainerLocation({ id: locId, container_id: r.container_id, reported_at: now, operator_id: currentProfileId, location_type: 'treatment', client_id: null, floor: null, area: null, notes: 'Tratado al finalizar pesaje' })
        addLocation({ id: locId, container_id: r.container_id, reported_at: now, operator_id: currentProfileId, location_type: 'treatment', client_id: null, floor: null, area: null, notes: 'Tratado al finalizar pesaje' })
      } else {
        const stId = crypto.randomUUID()
        await submitStorageEvent({ id: stId, container_id: r.container_id, entry_at: now, operator_id: currentProfileId })
        addStorageEvent({ id: stId, container_id: r.container_id, entry_at: now, exit_at: null, operator_id: currentProfileId, photo_ids: [] })
        const locId = crypto.randomUUID()
        await submitContainerLocation({ id: locId, container_id: r.container_id, reported_at: now, operator_id: currentProfileId, location_type: 'cold_storage', client_id: null, floor: null, area: null, notes: 'Cámara fría (auto tras pesaje)' })
        addLocation({ id: locId, container_id: r.container_id, reported_at: now, operator_id: currentProfileId, location_type: 'cold_storage', client_id: null, floor: null, area: null, notes: 'Cámara fría (auto tras pesaje)' })
      }
    }

    await endSession(activeSession.key)
    setActiveSession(null)
    router.push('/dashboard')
  }
```

Actualizar el bloque de imports del archivo: agregar
`import { submitWeighingSession, submitReception, submitTreatmentRun, submitStorageEvent, submitContainerLocation, receptionOpId } from '@/lib/data/field-writes'`
y cambiar el import de `uploadEventPhotos` por `enqueueEventPhotos` (de `@/lib/data/photos`). `handleCancel` y `handleSaveEdit` siguen usando `q`/online; conservar el import de `q` y `createClient`.

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/register/weighing/page.tsx
git commit -m "feat(offline): pesaje local-first (sesión, recepción y derivados encolan)"
```

---

### Task 5: Cablear Recorrido Andén (creación)

**Files:**
- Modify: `src/app/register/route/anden/[slot]/page.tsx`

**Interfaces:**
- Consumes: `submitRouteEvent`, `routeEventOpId` de `@/lib/data/field-writes`; `enqueueEventPhotos` de `@/lib/data/photos`.

- [ ] **Step 1: Reescribir `handleCreateAnden`**

Reemplazar el cuerpo de `handleCreateAnden` (líneas ~167-252) por la versión local-first (genera id, encola evento+containers, encola fotos por rol con `parentOpId = routeEventOpId(id)`):

```ts
  async function handleCreateAnden() {
    if (!currentProfileId || !client) return
    const now = new Date().toISOString()
    const recordCompanyId = formState.companyId
    const routeEventId = crypto.randomUUID()

    await submitRouteEvent(
      {
        id: routeEventId, client_id: client.id, company_id: recordCompanyId || null,
        kind: 'anden', slot: slotId, date: today, started_at: now,
        operator_id: currentProfileId, status: 'in_progress', area: formState.area,
      },
      formState.dirtyReceivedIds,
      formState.cleanDeliveredIds,
    )

    const label = buildLabel()
    const parentOpId = routeEventOpId(routeEventId)
    const upDirty = await enqueueEventPhotos({ dataUrls: formState.dirtyPhotos, eventType: 'route', eventId: routeEventId, label, uploadedBy: currentProfileId, takenAt: now, role: 'dirty', parentOpId })
    const upClean = await enqueueEventPhotos({ dataUrls: formState.cleanPhotos, eventType: 'route', eventId: routeEventId, label, uploadedBy: currentProfileId, takenAt: now, role: 'clean', parentOpId })
    const upSig = await enqueueEventPhotos({ dataUrls: formState.signature ? [formState.signature] : [], eventType: 'route', eventId: routeEventId, label, uploadedBy: currentProfileId, takenAt: now, role: 'signature', parentOpId })
    ;[...upDirty, ...upClean, ...upSig].forEach(addPhoto)
    const dirtyIds = upDirty.map((p) => p.id)
    const cleanIds = upClean.map((p) => p.id)
    const signatureId = upSig[0]?.id ?? null

    addRouteEvent({
      id: routeEventId, client_id: client.id, company_id: recordCompanyId || null,
      kind: 'anden', slot: slotId, date: today, started_at: now, ended_at: null,
      operator_id: currentProfileId, status: 'in_progress',
      containers_dirty_received: formState.dirtyReceivedIds,
      containers_clean_delivered: formState.cleanDeliveredIds,
      area: formState.area, dirty_photo_ids: dirtyIds, clean_photo_ids: cleanIds,
      photo_ids: [...dirtyIds, ...cleanIds], signature_photo_id: signatureId,
    })

    resetForm()
  }
```

Actualizar imports: agregar `import { submitRouteEvent, routeEventOpId } from '@/lib/data/field-writes'` y cambiar `uploadEventPhotos` → `enqueueEventPhotos` (de `@/lib/data/photos`). `handleUpdateAnden`, `handleDeleteAnden`, `handleFinish`, `handleCancel` siguen online; conservar `q` y `createClient`.

**Nota sobre `handleFinish` (andén):** marca los andenes `in_progress` como `completed` vía `q.updateRouteEvent` online. Si un andén recién creado aún está en cola, ese update online fallará silenciosamente (ya se captura con try/catch y alert). Para no romper el flujo offline, **envolver cada `q.updateRouteEvent` del finish en su propio try/catch que no aborte** y aplicar el cambio optimista al store igualmente. Reemplazar el `try { await Promise.all(... ) } catch { alert; return }` por:

```ts
    for (const a of sessionAndenes) {
      try { await q.updateRouteEvent(supabase, a.id, { status: 'completed', ended_at: now }) }
      catch (err) { console.error('[recorrido andén] finalizar (online) falló, sigue local:', err) }
      updateRouteEvent(a.id, { status: 'completed', ended_at: now })
    }
```
(eliminando el `sessionAndenes.forEach(... )` posterior, ya incluido en el loop).

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/register/route/anden/[slot]/page.tsx"
git commit -m "feat(offline): recorrido andén local-first (crea evento, tachos y fotos encolan)"
```

---

### Task 6: Cablear Recorrido Morgue (creación)

**Files:**
- Modify: `src/app/register/route/morgue/page.tsx`

**Interfaces:**
- Consumes: `submitRouteEvent`, `routeEventOpId` de `@/lib/data/field-writes`; `enqueueEventPhotos` de `@/lib/data/photos`.

El morgue crea el `route_event` en `handleStart` (status `in_progress`, sin tachos) y asocia tachos + fotos + cierra en `handleFinish`. Se mapea reusando `submitRouteEvent`: gracias a la semántica de `enqueueOp` (put por `op_id`), re-encolar `re:<id>` en el finish o bien sobrescribe la op pendiente con el payload `completed`, o bien crea una op nueva que hace upsert idempotente del registro ya subido. Ambos casos convergen al estado final correcto.

**Reescribir `handleStart`** (líneas ~99-162) a local-first:

```ts
  async function handleStart() {
    if (!currentProfileId || !client) return
    if (!companyId) { alert('Seleccioná la empresa del recorrido antes de iniciar.'); return }
    const now = new Date().toISOString()
    const routeEventId = crypto.randomUUID()

    await submitRouteEvent(
      {
        id: routeEventId, client_id: client.id, company_id: companyId || null,
        kind: 'morgue', slot: null, date: today, started_at: now,
        operator_id: currentProfileId, status: 'in_progress', area: formState.area,
      },
      [], [],
    )

    addRouteEvent({
      id: routeEventId, client_id: client.id, company_id: companyId || null,
      kind: 'morgue', slot: null, date: today, started_at: now, ended_at: null,
      operator_id: currentProfileId, status: 'in_progress',
      containers_dirty_received: formState.dirtyReceivedIds,
      containers_clean_delivered: formState.cleanDeliveredIds,
      area: formState.area, photo_ids: [], dirty_photo_ids: [], clean_photo_ids: [],
      signature_photo_id: null,
    })
    const session: ActiveSession = {
      key: routeMorgueSessionKey(today, now), type: 'route', started_at: now,
      context: { type: 'route', client_id: client.id, company_id: companyId, kind: 'morgue', slot: null, date: today, operator_id: currentProfileId, route_event_id: routeEventId },
    }
    await startSession(session)
    setActiveSession(session)
  }
```

**Reescribir `handleFinish`** (líneas ~182 en adelante): re-encolar el evento como `completed` con sus tachos y encolar las fotos. Reemplazar los pasos 1 y 2 (cierre online + `uploadEventPhotos`) por:

```ts
  async function handleFinish() {
    if (!activeSession || activeSession.context.type !== 'route') return
    const now = new Date().toISOString()
    const routeEventId = activeSession.context.route_event_id
    const ctx = activeSession.context
    const label = `PTDP Morgue ${client?.name ?? ''} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`

    // Re-encolar el evento como completed + tachos (idempotente por op_id/id).
    await submitRouteEvent(
      {
        id: routeEventId, client_id: ctx.client_id, company_id: ctx.company_id ?? null,
        kind: 'morgue', slot: null, date: today, started_at: activeSession.started_at,
        ended_at: now, operator_id: ctx.operator_id, status: 'completed', area: formState.area,
      },
      formState.dirtyReceivedIds, formState.cleanDeliveredIds,
    )

    const parentOpId = routeEventOpId(routeEventId)
    const upDirty = await enqueueEventPhotos({ dataUrls: formState.dirtyPhotos, eventType: 'route', eventId: routeEventId, label, uploadedBy: currentProfileId, takenAt: now, role: 'dirty', parentOpId })
    const upClean = await enqueueEventPhotos({ dataUrls: formState.cleanPhotos, eventType: 'route', eventId: routeEventId, label, uploadedBy: currentProfileId, takenAt: now, role: 'clean', parentOpId })
    const upSig = await enqueueEventPhotos({ dataUrls: formState.signature ? [formState.signature] : [], eventType: 'route', eventId: routeEventId, label, uploadedBy: currentProfileId, takenAt: now, role: 'signature', parentOpId })
    ;[...upDirty, ...upClean, ...upSig].forEach(addPhoto)
    const dirtyIds = upDirty.map((p) => p.id)
    const cleanIds = upClean.map((p) => p.id)
    const signatureId = upSig[0]?.id ?? null

    updateRouteEvent(routeEventId, {
      status: 'completed', ended_at: now, area: formState.area,
      containers_dirty_received: formState.dirtyReceivedIds,
      containers_clean_delivered: formState.cleanDeliveredIds,
      dirty_photo_ids: dirtyIds, clean_photo_ids: cleanIds,
      photo_ids: [...dirtyIds, ...cleanIds], signature_photo_id: signatureId,
    })

    await endSession(activeSession.key)
    setActiveSession(null)
    setFormState({ companyId: '', dirtyReceivedIds: [], cleanDeliveredIds: [], area: '', dirtyPhotos: [], cleanPhotos: [], signature: null })
    router.push('/register/route')
  }
```

Conservar el resto del cuerpo de `handleFinish` posterior a este bloque si lo hubiera (p.ej. `updateRouteEvent` final ya incluido arriba). `handleCancel` sigue online. Actualizar imports: agregar `import { submitRouteEvent, routeEventOpId } from '@/lib/data/field-writes'`; cambiar `uploadEventPhotos` → `enqueueEventPhotos`. Conservar `q`/`createClient` para `handleCancel`.

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/register/route/morgue/page.tsx
git commit -m "feat(offline): recorrido morgue local-first (crea evento y fotos encolan)"
```

---

### Task 7: Documentación del vault

**Files:**
- Create: `vault/logs/2026-06-19-offline-outbox-campo.md`
- Modify: `vault/_index.md`

- [ ] **Step 1: Escribir el log**

Crear `vault/logs/2026-06-19-offline-outbox-campo.md` con frontmatter (title, tags `[log, offline, pwa, supabase]`, updated) y secciones:
- **Qué se hizo:** motor offline (Plan A: `idb.ts` compartido, store `outbox`/`photo_blobs`, `outbox-sync.ts` con `applyOp` idempotente + `drainOutbox` por dependencias, hook que drena) + cableado (Plan B: `field-writes.ts` encola creaciones con `op_id` prefijado y deps; `enqueueEventPhotos` guarda blobs y encola `upload_photo`; pesaje/andén/morgue crean local-first; `mergeById` en el hydrator conserva pendientes).
- **Decisiones:** local-first siempre; reintento indefinido sin bloquear independientes; cola del dispositivo (sincroniza con cualquier sesión); alcance = CREACIÓN (edición/anulación siguen online); ids de cliente para idempotencia.
- **Verificación:** jest (conteo final), build OK.
- **Pendiente:** E2E manual en modo avión (crear recorrido/pesaje sin red → recuperar → cola drena a 0, sin duplicados); deuda conocida (un `upload_photo` atascado permanente no limpia su blob).
- Referenciar spec `docs/superpowers/specs/2026-06-19-offline-outbox-campo-design.md` y planes A/B.

- [ ] **Step 2: Actualizar el índice**

En `vault/_index.md`: agregar fila a la tabla de estado y entrada en "Logs de cambios"; actualizar "Última actualización del vault" a `2026-06-19`.

- [ ] **Step 3: Commit**

```bash
git add vault/logs/2026-06-19-offline-outbox-campo.md vault/_index.md
git commit -m "docs(vault): log offline outbox de campo (Plan A + B)"
```

---

## Verificación final (Plan B)

- [ ] `npm run test:jest` — toda la suite verde (incluye `enqueue-photos`, `field-writes`, `hydrate-merge`).
- [ ] `npm run build` — compila sin errores.
- [ ] Smoke manual (modo avión): iniciar pesaje + crear recepción con fotos sin red → la pantalla avanza y muestra el registro; el indicador muestra pendientes. Reconectar → la cola drena a 0. Verificar en Supabase que la sesión, recepción, derivados y fotos aparecen una sola vez (sin duplicados). Recargar a mitad (con pendientes) → el registro local no desaparece.

## Notas de cobertura (self-review)

- Spec §1 ids de cliente (T4/T5/T6 `crypto.randomUUID`) · §2 outbox (Plan A) · §3 escritura local-first (T4/T5/T6 + `field-writes` T2) · §4 motor (Plan A) · §5 merge al hidratar (T3) · §6 UX indicador (Plan A T4) + fotos locales vía object URL (T1) · §7 alcance: solo creación de campo; edición/anulación online (constraint global).
- Contratos del motor respetados: padre-antes-que-hijo (deps + orden de `enqueueOp`), `op_id` único (prefijo+uuid), `event_type` válido (literal en cada llamada), `hospiwaste:outbox-changed` (en `field-writes`), merge (T3).
- Fuera de alcance explícito (YAGNI): edición offline, anulación offline, gestión de cuota, pantalla de cola.
