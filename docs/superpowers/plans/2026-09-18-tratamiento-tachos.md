# Reactivación del módulo de tratamiento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reactivar el registro de tratamiento de tachos en el APK, con escritura al outbox offline, id determinista que impide duplicados y cierre del `exit_at` de cámara fría.

**Architecture:** La lógica pura de selección de candidatos y de generación de ids sube a `shared/src/lib/data/treatment.ts` (sin IO, testeable con Jest). La orquestación de escrituras se queda en `app/src/lib/data/treat-containers.ts` porque necesita el outbox SQLite, que es del APK. La pantalla queda como presentación.

**Tech Stack:** Next.js 15 + Capacitor (APK Android), Zustand, Supabase, SQLite local vía `@hospiwaste/shared/lib/local-store`, Jest + Testing Library, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-18-tratamiento-tachos-design.md`

## Global Constraints

- Monorepo npm workspaces. Código de shared se importa **siempre** como `@hospiwaste/shared/...`, nunca con `@/` dentro de shared. `@/*` es local de cada app.
- Comandos de test: `npm test -w shared`, `npm test -w app`, o `npm test` desde el root para los tres workspaces.
- El payload de `storage_events` se construye **campo por campo**. Nunca por spread de un objeto del store: el `StorageEvent` de Zustand lleva `photo_ids`, que no es columna de esa tabla, y el upsert falla en el drain del outbox sin que nadie lo vea.
- Columnas reales de `storage_events`: `id, container_id, entry_at, exit_at, operator_id, created_at`.
- `treatment_runs.id`, `storage_events.id` y `container_locations.id` son `uuid` en Postgres. Cualquier id generado en cliente tiene que ser un UUID válido.
- No se agregan dependencias nuevas.
- `INTERIM_MODE` no se toca en ninguna tarea.
- Fuera de alcance en todo el plan: fotos de tratamiento, lavado, duración/corridas de autoclave, rechazo permanente del outbox, saneamiento de los 641 `exit_at` viejos, filtro de 120 L en `/containers`.

---

### Task 1: Id determinista (UUID v5) y polyfills de test

Genera el id del `treatment_run` a partir del tacho y su recepción, de modo que doble tap, dos teléfonos y reenvíos del outbox colapsen en una sola fila.

`crypto.subtle` y `TextEncoder` **no existen en el jsdom de Jest** (verificado: `crypto.randomUUID` sí, `crypto.subtle` no). Sí existen en el WebView real, porque Capacitor sirve en `https://localhost` al no fijarse `androidScheme`, que es secure context. Por eso hacen falta los polyfills en los dos `jest.setup.ts`, que ya tienen precedente de polyfills (`structuredClone`, `URL.createObjectURL`).

**Files:**
- Create: `shared/src/lib/data/treatment.ts`
- Modify: `shared/jest.setup.ts` (al final del archivo)
- Modify: `app/jest.setup.ts` (al final del archivo)
- Test: `shared/src/__tests__/lib/treatment.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `treatmentRunId(containerId: string, receptionId: string): Promise<string>` y `treatmentLocationId(containerId: string, receptionId: string): Promise<string>`, ambas async.

- [ ] **Step 1: Agregar los polyfills a los dos setups de Jest**

Agregar al final de **`shared/jest.setup.ts`** y al final de **`app/jest.setup.ts`** exactamente el mismo bloque:

```ts
// jsdom no implementa crypto.subtle ni TextEncoder (sí crypto.randomUUID).
// El WebView real sí los tiene: Capacitor sirve en https://localhost, que es
// secure context. Sin esto, uuidV5 revienta solo en los tests.
if (typeof globalThis.crypto?.subtle === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { webcrypto } = require('node:crypto')
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}
if (typeof globalThis.TextEncoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TextEncoder } = require('node:util')
  Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder, configurable: true })
}
```

- [ ] **Step 2: Escribir el test que falla**

Crear `shared/src/__tests__/lib/treatment.test.ts`:

```ts
import { treatmentRunId, treatmentLocationId, uuidV5 } from '@hospiwaste/shared/lib/data/treatment'

describe('uuidV5', () => {
  it('reproduce el vector conocido de la RFC 4122 (namespace DNS + www.example.com)', async () => {
    const id = await uuidV5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'www.example.com')
    expect(id).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2')
  })
})

describe('treatmentRunId', () => {
  it('es determinista: mismo tacho y misma recepción dan el mismo id', async () => {
    const a = await treatmentRunId('001', 'rec-1')
    const b = await treatmentRunId('001', 'rec-1')
    expect(a).toBe(b)
  })

  it('cambia cuando cambia la recepción (el ciclo siguiente no colisiona)', async () => {
    const a = await treatmentRunId('001', 'rec-1')
    const b = await treatmentRunId('001', 'rec-2')
    expect(a).not.toBe(b)
  })

  it('cambia cuando cambia el tacho', async () => {
    const a = await treatmentRunId('001', 'rec-1')
    const b = await treatmentRunId('002', 'rec-1')
    expect(a).not.toBe(b)
  })

  it('devuelve un UUID v5 válido (versión 5, variante RFC 4122)', async () => {
    const id = await treatmentRunId('001', 'rec-1')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('el id de la ubicación no colisiona con el del tratamiento', async () => {
    const run = await treatmentRunId('001', 'rec-1')
    const loc = await treatmentLocationId('001', 'rec-1')
    expect(run).not.toBe(loc)
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npm test -w shared -- src/__tests__/lib/treatment.test.ts`
Expected: FAIL — `Cannot find module '@hospiwaste/shared/lib/data/treatment'`

- [ ] **Step 4: Escribir la implementación mínima**

Crear `shared/src/lib/data/treatment.ts`:

```ts
/** Namespace fijo del proyecto para ids deterministas (UUID v5).
 *  NO CAMBIAR: cambiarlo re-emite todos los ids y rompe la deduplicación de
 *  tratamientos ya registrados. */
const NAMESPACE_HOSPIWASTE = '6f9b1f4e-2d3a-4c58-9a1b-7e0c5d8f2a41'

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '')
  const out = new Uint8Array(16)
  for (let i = 0; i < 16; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToUuid(b: Uint8Array): string {
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/** UUID v5 (SHA-1) según RFC 4122. Async porque usa WebCrypto. */
export async function uuidV5(namespace: string, name: string): Promise<string> {
  const ns = uuidToBytes(namespace)
  const nameBytes = new TextEncoder().encode(name)
  const input = new Uint8Array(ns.length + nameBytes.length)
  input.set(ns, 0)
  input.set(nameBytes, ns.length)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', input))
  const out = digest.slice(0, 16)
  out[6] = (out[6] & 0x0f) | 0x50 // versión 5
  out[8] = (out[8] & 0x3f) | 0x80 // variante RFC 4122
  return bytesToUuid(out)
}

/** Un tratamiento por recepción. Cuando el tacho vuelve sucio hay recepción
 *  nueva y por lo tanto id nuevo: los ciclos no colisionan entre sí. */
export function treatmentRunId(containerId: string, receptionId: string): Promise<string> {
  return uuidV5(NAMESPACE_HOSPIWASTE, `treatment:${containerId}:${receptionId}`)
}

/** Ubicación derivada del mismo tratamiento. Prefijo distinto para no colisionar. */
export function treatmentLocationId(containerId: string, receptionId: string): Promise<string> {
  return uuidV5(NAMESPACE_HOSPIWASTE, `treatment-location:${containerId}:${receptionId}`)
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npm test -w shared -- src/__tests__/lib/treatment.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Verificar que no rompiste nada más**

Run: `npm test -w shared`
Expected: PASS (los polyfills no deben afectar a ninguna suite existente).

- [ ] **Step 7: Commit**

```bash
git add shared/src/lib/data/treatment.ts shared/src/__tests__/lib/treatment.test.ts shared/jest.setup.ts app/jest.setup.ts
git commit -m "feat(tratamiento): id determinista UUID v5 por tacho y recepción"
```

---

### Task 2: Selector puro de candidatos a tratamiento

Se lleva las ~25 líneas de filtrado que hoy viven dentro del `useMemo` de la pantalla, les agrega orden por antigüedad y los días en cámara fría.

**Nota para quien implemente:** el filtro original llamaba a `computeContainerPhase(routeIds, ...)`. Aquí no se pasan `routeEvents` y **no es un olvido**: `computeContainerPhase` sólo mira `routeEventIds` cuando la recepción es `null` (`shared/src/lib/data/containers.ts:44-45`), y acá la recepción siempre existe. Las cuatro reglas de abajo determinan `cold_storage` por sí solas.

**Files:**
- Modify: `shared/src/lib/data/treatment.ts` (agregar al final)
- Test: `shared/src/__tests__/lib/treatment.test.ts` (agregar al final)

**Interfaces:**
- Consumes: tipos de `@hospiwaste/shared/lib/types`.
- Produces:
  - `interface TreatmentCandidate { container: Container; reception: ContainerReception; storageEvent: StorageEvent; coldStorageSinceMs: number }`
  - `interface TreatmentCandidateSlice { containers: Container[]; receptions: ContainerReception[]; storageEvents: StorageEvent[]; treatmentRuns: TreatmentRun[]; externalTransfers: ExternalTransfer[] }`
  - `listTreatmentCandidates(slice: TreatmentCandidateSlice, nowMs: number): TreatmentCandidate[]`

- [ ] **Step 1: Escribir los tests que fallan**

Primero, **ampliar el import que ya existe** en la primera línea de
`shared/src/__tests__/lib/treatment.test.ts` en vez de agregar un segundo import del
mismo módulo (el lint marca `no-duplicate-imports`):

```ts
import {
  treatmentRunId, treatmentLocationId, uuidV5, listTreatmentCandidates,
} from '@hospiwaste/shared/lib/data/treatment'
```

Y agregar al final del archivo:

```ts
import type {
  Container, ContainerReception, StorageEvent, TreatmentRun, ExternalTransfer,
} from '@hospiwaste/shared/lib/types'

const cont = (id: string): Container => ({
  id, size_liters: 240, tare_weight_kg: 13.5, status: 'active',
  registered_at: '2026-01-01T00:00:00Z',
})

const rec = (
  id: string, container_id: string, arrived_at: string,
  extra: Partial<ContainerReception> = {},
): ContainerReception => ({
  id, container_id, weighing_session_id: null, arrived_at,
  gross_weight_kg: 40, operator_id: 'op-1', photo_ids: [], observations: '',
  waste_type: 'infectious', ...extra,
})

const sto = (id: string, container_id: string, entry_at: string, exit_at: string | null = null): StorageEvent => ({
  id, container_id, entry_at, exit_at, operator_id: 'op-1', photo_ids: [],
})

const emptySlice = {
  containers: [] as Container[],
  receptions: [] as ContainerReception[],
  storageEvents: [] as StorageEvent[],
  treatmentRuns: [] as TreatmentRun[],
  externalTransfers: [] as ExternalTransfer[],
}

const NOW = new Date('2026-09-18T12:00:00Z').getTime()

describe('listTreatmentCandidates', () => {
  it('incluye un tacho infeccioso en cámara fría sin tratamiento posterior', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [rec('r1', '001', '2026-09-17T08:00:00Z')],
      storageEvents: [sto('s1', '001', '2026-09-17T09:00:00Z')],
    }, NOW)
    expect(out.map((c) => c.container.id)).toEqual(['001'])
  })

  it('un tacho tratado HOY tras una recepción de AYER no reaparece (regresión del bug de julio)', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [rec('r1', '001', '2026-09-17T08:00:00Z')],
      storageEvents: [sto('s1', '001', '2026-09-17T09:00:00Z')],
      treatmentRuns: [{
        id: 't1', container_id: '001', started_at: '2026-09-18T07:00:00Z',
        completed_at: '2026-09-18T07:00:00Z', operator_id: 'op-1',
      }],
    }, NOW)
    expect(out).toEqual([])
  })

  it('un tacho con recepción POSTERIOR a su último tratamiento sí reaparece', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [rec('r2', '001', '2026-09-18T08:00:00Z')],
      storageEvents: [sto('s2', '001', '2026-09-18T09:00:00Z')],
      treatmentRuns: [{
        id: 't1', container_id: '001', started_at: '2026-09-17T07:00:00Z',
        completed_at: '2026-09-17T07:00:00Z', operator_id: 'op-1',
      }],
    }, NOW)
    expect(out.map((c) => c.container.id)).toEqual(['001'])
  })

  it('excluye los anatomopatológicos: salen por traslado externo', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [rec('r1', '001', '2026-09-17T08:00:00Z', { waste_type: 'anatomopathological' })],
      storageEvents: [sto('s1', '001', '2026-09-17T09:00:00Z')],
    }, NOW)
    expect(out).toEqual([])
  })

  it('ignora la recepción anulada y usa la anterior vigente', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [
        rec('r1', '001', '2026-09-17T08:00:00Z'),
        rec('r2', '001', '2026-09-18T08:00:00Z', { voided_at: '2026-09-18T08:30:00Z' }),
      ],
      storageEvents: [sto('s1', '001', '2026-09-17T09:00:00Z')],
    }, NOW)
    expect(out.map((c) => c.reception.id)).toEqual(['r1'])
  })

  it('excluye el tacho sin cámara fría (pesado pero con la sesión sin cerrar)', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [rec('r1', '001', '2026-09-17T08:00:00Z')],
    }, NOW)
    expect(out).toEqual([])
  })

  it('excluye los tachos dados de baja', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [{ ...cont('001'), status: 'decommissioned' }],
      receptions: [rec('r1', '001', '2026-09-17T08:00:00Z')],
      storageEvents: [sto('s1', '001', '2026-09-17T09:00:00Z')],
    }, NOW)
    expect(out).toEqual([])
  })

  it('ordena por antigüedad en cámara fría: el más viejo primero', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001'), cont('002')],
      receptions: [
        rec('r1', '001', '2026-09-18T08:00:00Z'),
        rec('r2', '002', '2026-09-10T08:00:00Z'),
      ],
      storageEvents: [
        sto('s1', '001', '2026-09-18T09:00:00Z'),
        sto('s2', '002', '2026-09-10T09:00:00Z'),
      ],
    }, NOW)
    expect(out.map((c) => c.container.id)).toEqual(['002', '001'])
  })

  it('calcula coldStorageSinceMs desde la entrada a cámara fría', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [rec('r1', '001', '2026-09-18T08:00:00Z')],
      storageEvents: [sto('s1', '001', '2026-09-18T09:00:00Z')],
    }, NOW)
    expect(out[0].coldStorageSinceMs).toBe(3 * 60 * 60 * 1000)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -w shared -- src/__tests__/lib/treatment.test.ts`
Expected: FAIL — `listTreatmentCandidates is not a function`

- [ ] **Step 3: Implementar**

Agregar al final de `shared/src/lib/data/treatment.ts`:

```ts
import type {
  Container,
  ContainerReception,
  ExternalTransfer,
  StorageEvent,
  TreatmentRun,
} from '@hospiwaste/shared/lib/types'

export interface TreatmentCandidate {
  container: Container
  reception: ContainerReception
  storageEvent: StorageEvent
  coldStorageSinceMs: number
}

export interface TreatmentCandidateSlice {
  containers: Container[]
  receptions: ContainerReception[]
  storageEvents: StorageEvent[]
  treatmentRuns: TreatmentRun[]
  externalTransfers: ExternalTransfer[]
}

const ms = (iso: string): number => new Date(iso).getTime()

/** Cola del tratamiento: tachos infecciosos activos que están en cámara fría y
 *  cuyo ciclo actual todavía no se cerró. Ordenados del más viejo al más nuevo.
 *
 *  La comparación con tratamientos y traslados es POR FECHA, no por existencia:
 *  comparar existencia fue el bug de julio que escondió 41 tachos. */
export function listTreatmentCandidates(
  slice: TreatmentCandidateSlice,
  nowMs: number,
): TreatmentCandidate[] {
  const out: TreatmentCandidate[] = []

  for (const container of slice.containers) {
    if (container.status !== 'active') continue

    const reception = slice.receptions
      .filter((r) => r.container_id === container.id && !r.voided_at)
      .sort((a, b) => ms(b.arrived_at) - ms(a.arrived_at))[0]
    if (!reception) continue
    if (reception.waste_type !== 'infectious') continue

    const receptionAt = ms(reception.arrived_at)

    const yaTratado = slice.treatmentRuns.some(
      (t) => t.container_id === container.id && ms(t.started_at) >= receptionAt,
    )
    if (yaTratado) continue

    const yaTrasladado = slice.externalTransfers.some(
      (t) => t.container_id === container.id && ms(t.storage_started_at) >= receptionAt,
    )
    if (yaTrasladado) continue

    const storageEvent = slice.storageEvents
      .filter((s) => s.container_id === container.id && ms(s.entry_at) >= receptionAt)
      .sort((a, b) => ms(b.entry_at) - ms(a.entry_at))[0]
    if (!storageEvent) continue

    out.push({
      container,
      reception,
      storageEvent,
      coldStorageSinceMs: nowMs - ms(storageEvent.entry_at),
    })
  }

  return out.sort((a, b) => ms(a.storageEvent.entry_at) - ms(b.storageEvent.entry_at))
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -w shared -- src/__tests__/lib/treatment.test.ts`
Expected: PASS, 14 tests en total (5 de Task 1 + 9 de ésta).

- [ ] **Step 5: Commit**

```bash
git add shared/src/lib/data/treatment.ts shared/src/__tests__/lib/treatment.test.ts
git commit -m "feat(tratamiento): selector puro de candidatos ordenado por antigüedad"
```

---

### Task 3: Acción `updateStorageEvent` en el store

No existe hoy. Hace falta para reflejar el `exit_at` en memoria sin recargar la app.

**Files:**
- Modify: `shared/src/lib/store.ts` (interfaz cerca de la línea 99, implementación cerca de la 236)
- Test: `shared/src/__tests__/lib/store-storage-events.test.ts`

**Interfaces:**
- Produces: `updateStorageEvent(id: string, updates: Partial<StorageEvent>): void` en el store de Zustand.

- [ ] **Step 1: Escribir el test que falla**

Crear `shared/src/__tests__/lib/store-storage-events.test.ts`:

```ts
import { useStore } from '@hospiwaste/shared/lib/store'
import type { StorageEvent } from '@hospiwaste/shared/lib/types'

const evento: StorageEvent = {
  id: 's-test-1', container_id: '001', entry_at: '2026-09-18T09:00:00Z',
  exit_at: null, operator_id: 'op-1', photo_ids: [],
}

describe('updateStorageEvent', () => {
  beforeEach(() => {
    useStore.setState({ storageEvents: [evento] })
  })

  it('cierra el exit_at del evento indicado', () => {
    useStore.getState().updateStorageEvent('s-test-1', { exit_at: '2026-09-18T15:00:00Z' })
    expect(useStore.getState().storageEvents[0].exit_at).toBe('2026-09-18T15:00:00Z')
  })

  it('no toca los demás eventos', () => {
    const otro: StorageEvent = { ...evento, id: 's-test-2', container_id: '002' }
    useStore.setState({ storageEvents: [evento, otro] })
    useStore.getState().updateStorageEvent('s-test-1', { exit_at: '2026-09-18T15:00:00Z' })
    expect(useStore.getState().storageEvents[1].exit_at).toBeNull()
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -w shared -- src/__tests__/lib/store-storage-events.test.ts`
Expected: FAIL — `useStore.getState().updateStorageEvent is not a function`

- [ ] **Step 3: Implementar**

En `shared/src/lib/store.ts`, agregar a la interfaz justo debajo de `addStorageEvent` (línea ~99):

```ts
  updateStorageEvent: (id: string, updates: Partial<StorageEvent>) => void
```

Y la implementación justo debajo de la de `addStorageEvent` (línea ~238), con la misma forma que `updateReception`:

```ts
  updateStorageEvent: (id, updates) =>
    set((s) => ({
      storageEvents: s.storageEvents.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -w shared -- src/__tests__/lib/store-storage-events.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add shared/src/lib/store.ts shared/src/__tests__/lib/store-storage-events.test.ts
git commit -m "feat(store): acción updateStorageEvent para cerrar la cámara fría"
```

---

### Task 4: `submitStorageExit` — cierre del `exit_at` en el outbox

Re-escribe la fila de `storage_events` con el `exit_at` puesto. El drain del outbox hace `upsert` con `onConflict: 'id'` (`shared/src/lib/local-store/sync-engine.ts:108`), así que actualiza la fila existente en vez de duplicarla.

**Files:**
- Modify: `app/src/lib/data/field-writes.ts` (agregar debajo de `submitStorageEvent`)
- Test: `app/src/__tests__/lib/field-writes.test.ts` (agregar al final del `describe`)

**Interfaces:**
- Consumes: `getLocalStore()` y `notifyOutboxChanged()`, ya presentes en el archivo.
- Produces: `submitStorageExit(input: { id: string; container_id: string; entry_at: string; exit_at: string; operator_id: string }): Promise<void>`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar dentro del `describe('field-writes → LocalStore', ...)` de `app/src/__tests__/lib/field-writes.test.ts`:

```ts
  it('submitStorageExit escribe exactamente las columnas de la tabla, sin photo_ids', async () => {
    await submitStorageExit({
      id: 'se1', container_id: '001', entry_at: '2026-09-18T09:00:00Z',
      exit_at: '2026-09-18T15:00:00Z', operator_id: 'op1',
    })
    const s = await getLocalStore()
    const row = (await s.getRows('storage_events')).find((r) => r.id === 'se1')!
    expect(row.payload).toEqual({
      id: 'se1', container_id: '001', entry_at: '2026-09-18T09:00:00Z',
      exit_at: '2026-09-18T15:00:00Z', operator_id: 'op1',
    })
    expect(row.payload).not.toHaveProperty('photo_ids')
  })
```

Y agregar `submitStorageExit` al import del principio del archivo:

```ts
import { submitRouteEvent, submitWeighingSession, submitReception, submitStorageExit } from '@/lib/data/field-writes'
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -w app -- src/__tests__/lib/field-writes.test.ts`
Expected: FAIL — `submitStorageExit is not a function`

- [ ] **Step 3: Implementar**

Agregar en `app/src/lib/data/field-writes.ts`, justo debajo de `submitStorageEvent`:

```ts
/** Cierra la salida de cámara fría re-escribiendo la fila existente. El drain
 *  upsertea sobre `id`, así que actualiza en vez de insertar.
 *
 *  El payload se arma CAMPO POR CAMPO a propósito: el `StorageEvent` del store
 *  lleva `photo_ids`, que no es columna de `storage_events`. Un spread haría
 *  fallar el upsert en el drain, en segundo plano y sin nadie mirando. */
export async function submitStorageExit(input: {
  id: string; container_id: string; entry_at: string; exit_at: string; operator_id: string
}): Promise<void> {
  const store = await getLocalStore()
  await store.putRow('storage_events', input.id, {
    id: input.id,
    container_id: input.container_id,
    entry_at: input.entry_at,
    exit_at: input.exit_at,
    operator_id: input.operator_id,
  } satisfies TablesInsert<'storage_events'>)
  notifyOutboxChanged()
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -w app -- src/__tests__/lib/field-writes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/data/field-writes.ts app/src/__tests__/lib/field-writes.test.ts
git commit -m "feat(tratamiento): submitStorageExit cierra la cámara fría vía outbox"
```

---

### Task 5: `treatContainers` — orquestación de las tres escrituras

Por cada tacho: `treatment_run` → cierre de `exit_at` → `container_location`. Todo al SQLite local antes de que salga nada a la red. **No es atómico** — el outbox es fila por fila, sin transacción. La garantía es durabilidad local.

Si un tacho falla, **corta** y reporta cuántos entraron de verdad. El comportamiento actual (seguir en silencio) es lo que se está arreglando.

**Files:**
- Create: `app/src/lib/data/treat-containers.ts`
- Test: `app/src/__tests__/lib/treat-containers.test.ts`

**Interfaces:**
- Consumes: `TreatmentCandidate` y `treatmentRunId`/`treatmentLocationId` de Task 1 y 2; `submitTreatmentRun`, `submitStorageExit`, `submitContainerLocation` de Task 4 y del archivo existente.
- Produces:
  - `interface TreatmentStoreSink { addTreatmentRun(run: TreatmentRun): void; updateStorageEvent(id: string, updates: Partial<StorageEvent>): void; addLocation(location: ContainerLocation): void }`
  - `interface TreatResult { treated: number; failedAt: string | null; error: unknown }`
  - `treatContainers(candidates: TreatmentCandidate[], operatorId: string, nowIso: string, sink: TreatmentStoreSink): Promise<TreatResult>`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `app/src/__tests__/lib/treat-containers.test.ts`:

```ts
/**
 * @jest-environment jsdom
 */
import 'fake-indexeddb/auto'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { treatContainers } from '@/lib/data/treat-containers'
import type { TreatmentCandidate } from '@hospiwaste/shared/lib/data/treatment'

const NOW = '2026-09-18T15:00:00Z'

function candidate(id: string, exitAt: string | null = null): TreatmentCandidate {
  return {
    container: {
      id, size_liters: 240, tare_weight_kg: 13.5, status: 'active',
      registered_at: '2026-01-01T00:00:00Z',
    },
    reception: {
      id: `rec-${id}`, container_id: id, weighing_session_id: null,
      arrived_at: '2026-09-18T08:00:00Z', gross_weight_kg: 40, operator_id: 'op-1',
      photo_ids: [], observations: '', waste_type: 'infectious',
    },
    storageEvent: {
      id: `sto-${id}`, container_id: id, entry_at: '2026-09-18T09:00:00Z',
      exit_at: exitAt, operator_id: 'op-1', photo_ids: [],
    },
    coldStorageSinceMs: 6 * 60 * 60 * 1000,
  }
}

function sink() {
  return {
    addTreatmentRun: jest.fn(),
    updateStorageEvent: jest.fn(),
    addLocation: jest.fn(),
  }
}

describe('treatContainers', () => {
  it('escribe las tres filas por tacho', async () => {
    const s = sink()
    const res = await treatContainers([candidate('001')], 'op-1', NOW, s)
    expect(res).toEqual({ treated: 1, failedAt: null, error: null })

    const store = await getLocalStore()
    expect((await store.getRows('treatment_runs')).length).toBe(1)
    expect((await store.getRows('container_locations')).length).toBe(1)
    const sto = (await store.getRows('storage_events')).find((r) => r.id === 'sto-001')!
    expect((sto.payload as { exit_at: string }).exit_at).toBe(NOW)
  })

  it('el payload de storage_events no lleva photo_ids', async () => {
    await treatContainers([candidate('002')], 'op-1', NOW, sink())
    const store = await getLocalStore()
    const sto = (await store.getRows('storage_events')).find((r) => r.id === 'sto-002')!
    expect(sto.payload).not.toHaveProperty('photo_ids')
  })

  it('no pisa un exit_at que ya tenía valor', async () => {
    const s = sink()
    await treatContainers([candidate('003', '2026-09-18T10:00:00Z')], 'op-1', NOW, s)
    expect(s.updateStorageEvent).not.toHaveBeenCalled()
    const store = await getLocalStore()
    expect((await store.getRows('storage_events')).find((r) => r.id === 'sto-003')).toBeUndefined()
  })

  it('el mismo tacho y la misma recepción dos veces producen un solo id', async () => {
    await treatContainers([candidate('004')], 'op-1', NOW, sink())
    await treatContainers([candidate('004')], 'op-1', NOW, sink())
    const store = await getLocalStore()
    const runs = (await store.getRows('treatment_runs'))
      .filter((r) => (r.payload as { container_id: string }).container_id === '004')
    expect(runs.length).toBe(1)
  })

  it('actualiza el store por cada tacho tratado', async () => {
    const s = sink()
    await treatContainers([candidate('005')], 'op-1', NOW, s)
    expect(s.addTreatmentRun).toHaveBeenCalledTimes(1)
    expect(s.updateStorageEvent).toHaveBeenCalledWith('sto-005', { exit_at: NOW })
    expect(s.addLocation).toHaveBeenCalledTimes(1)
  })

  it('si falla un tacho corta y reporta cuántos entraron de verdad', async () => {
    const s = sink()
    s.addTreatmentRun
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => { throw new Error('boom') })
    const res = await treatContainers([candidate('006'), candidate('007')], 'op-1', NOW, s)
    expect(res.treated).toBe(1)
    expect(res.failedAt).toBe('007')
    expect(res.error).toBeInstanceOf(Error)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -w app -- src/__tests__/lib/treat-containers.test.ts`
Expected: FAIL — `Cannot find module '@/lib/data/treat-containers'`

- [ ] **Step 3: Implementar**

Crear `app/src/lib/data/treat-containers.ts`:

```ts
import {
  treatmentRunId,
  treatmentLocationId,
  type TreatmentCandidate,
} from '@hospiwaste/shared/lib/data/treatment'
import type {
  ContainerLocation, StorageEvent, TreatmentRun,
} from '@hospiwaste/shared/lib/types'
import { submitTreatmentRun, submitStorageExit, submitContainerLocation } from './field-writes'

export interface TreatmentStoreSink {
  addTreatmentRun: (run: TreatmentRun) => void
  updateStorageEvent: (id: string, updates: Partial<StorageEvent>) => void
  addLocation: (location: ContainerLocation) => void
}

export interface TreatResult {
  /** Tachos efectivamente escritos en el store local. */
  treated: number
  /** container_id donde se cortó, o null si entraron todos. */
  failedAt: string | null
  error: unknown
}

/** Registra el tratamiento de los tachos dados. Por cada uno, en orden:
 *  treatment_run → cierre del exit_at de cámara fría → container_location.
 *
 *  NO es atómico: el outbox es fila por fila y no hay transacción entre las
 *  tres. La garantía es que todo se escribe al SQLite local (durable) antes de
 *  que salga nada a la red. Si un tacho falla, se corta: los anteriores quedan
 *  registrados y los restantes siguen en la cola, que es derivada. */
export async function treatContainers(
  candidates: TreatmentCandidate[],
  operatorId: string,
  nowIso: string,
  sink: TreatmentStoreSink,
): Promise<TreatResult> {
  let treated = 0

  for (const { container, reception, storageEvent } of candidates) {
    try {
      const runId = await treatmentRunId(container.id, reception.id)
      const run: TreatmentRun = {
        id: runId,
        container_id: container.id,
        started_at: nowIso,
        completed_at: nowIso,
        operator_id: operatorId,
      }
      await submitTreatmentRun(run)
      sink.addTreatmentRun(run)

      if (storageEvent.exit_at === null) {
        await submitStorageExit({
          id: storageEvent.id,
          container_id: storageEvent.container_id,
          entry_at: storageEvent.entry_at,
          exit_at: nowIso,
          operator_id: storageEvent.operator_id,
        })
        sink.updateStorageEvent(storageEvent.id, { exit_at: nowIso })
      }

      const location: ContainerLocation = {
        id: await treatmentLocationId(container.id, reception.id),
        container_id: container.id,
        reported_at: nowIso,
        operator_id: operatorId,
        location_type: 'treatment',
        client_id: null,
        floor: null,
        area: null,
        notes: 'Tratamiento',
      }
      await submitContainerLocation(location)
      sink.addLocation(location)

      treated += 1
    } catch (error) {
      return { treated, failedAt: container.id, error }
    }
  }

  return { treated, failedAt: null, error: null }
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -w app -- src/__tests__/lib/treat-containers.test.ts`
Expected: PASS, 6 tests.

Si TypeScript se queja de la forma de `ContainerLocation`, leer su definición en `shared/src/lib/types.ts` y ajustar los campos del literal — no cambiar la lógica.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/data/treat-containers.ts app/src/__tests__/lib/treat-containers.test.ts
git commit -m "feat(tratamiento): orquestación de escrituras contra el outbox"
```

---

### Task 6: La pantalla usa las piezas nuevas

La pantalla pierde toda la lógica de negocio y pasa a ser presentación. Gana la columna de días en cámara fría y el reporte honesto de cuántos tachos entraron.

**Files:**
- Modify: `app/src/app/register/treatment/page.tsx`

**Interfaces:**
- Consumes: `listTreatmentCandidates`, `TreatmentCandidate` (Task 2); `treatContainers` (Task 5); `updateStorageEvent` del store (Task 3); `formatDuration` de `@hospiwaste/shared/lib/data/dashboard-metrics`.
- Produces: nada.

- [ ] **Step 1: Reemplazar los imports del encabezado**

Sustituir el bloque de imports que hoy va de `import { useStore }` hasta `import * as q from '@hospiwaste/shared/lib/supabase/queries'` por:

```tsx
import { useStore } from '@hospiwaste/shared/lib/store'
import { formatTachoNumber } from '@hospiwaste/shared/lib/data/containers'
import { formatDuration } from '@hospiwaste/shared/lib/data/dashboard-metrics'
import {
  listTreatmentCandidates,
  type TreatmentCandidate,
} from '@hospiwaste/shared/lib/data/treatment'
import { treatContainers } from '@/lib/data/treat-containers'
```

Se van `createClient`, `* as q`, `computeContainerPhase` y `getRouteEventIdsForContainer`: la pantalla ya no habla con la red ni deriva fases.

- [ ] **Step 2: Reemplazar la desestructuración del store**

```tsx
  const {
    containers,
    receptions,
    storageEvents,
    treatmentRuns,
    externalTransfers,
    currentProfileId,
    addTreatmentRun,
    updateStorageEvent,
    addLocation,
  } = useStore()
```

`routeEvents` deja de usarse (ver la nota de Task 2). `updateStorageEvent` es nuevo.

- [ ] **Step 3: Reemplazar el `useMemo` de candidatos entero**

Borrar el bloque completo `const candidates = useMemo(...)` —desde `// Memoized list of candidates` hasta su cierre— y poner:

```tsx
  const candidates = useMemo(
    () => listTreatmentCandidates(
      { containers, receptions, storageEvents, treatmentRuns, externalTransfers },
      Date.now(),
    ),
    [containers, receptions, storageEvents, treatmentRuns, externalTransfers],
  )
```

`Date.now()` se evalúa en cada recálculo. La etiqueta se mide en horas y días, así que el desfase entre renders es irrelevante.

- [ ] **Step 4: Ajustar `selectedContainers` a la nueva forma**

```tsx
  const selectedCandidates = useMemo<TreatmentCandidate[]>(
    () => candidates.filter((c) => selectedIds.has(c.container.id)),
    [candidates, selectedIds],
  )
```

- [ ] **Step 5: Reemplazar `handleSubmit`**

```tsx
  async function handleSubmit() {
    if (!currentProfileId || selectedCandidates.length === 0 || submitting) return
    setSubmitting(true)
    const res = await treatContainers(
      selectedCandidates,
      currentProfileId,
      new Date().toISOString(),
      { addTreatmentRun, updateStorageEvent, addLocation },
    )
    if (res.failedAt) {
      console.error('[tratamiento] se cortó en', res.failedAt, res.error)
    }
    setSubmittedCount(res.treated)
    setSubmitting(false)
    setStep('done')
  }
```

Reporta `res.treated`, no `selectedIds.size`: nunca más "se registraron 12" cuando entraron 9.

- [ ] **Step 6: Ajustar la pantalla de confirmación**

Cambiar `const numbers = selectedContainers.map(...)` por:

```tsx
    const numbers = selectedCandidates.map((c) => formatTachoNumber(c.container.id))
```

- [ ] **Step 7: Ajustar la lista y agregar los días en cámara**

En el `.map` de `candidates`, reemplazar `{candidates.map((c) => {` y su cuerpo por:

```tsx
          {candidates.map((cand) => {
            const isSelected = selectedIds.has(cand.container.id)
            return (
              <button
                key={cand.container.id}
                type="button"
                onClick={() => toggleSelect(cand.container.id)}
                className={`w-full text-left rounded-lg border px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isSelected ? (
                    <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300 shrink-0" />
                  )}
                  <span className="font-mono font-semibold text-slate-800">
                    {formatTachoNumber(cand.container.id)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-slate-500">
                    {formatDuration(cand.coldStorageSinceMs)} en cámara
                  </span>
                  <Badge variant="secondary">{cand.container.size_liters} L</Badge>
                </div>
              </button>
            )
          })}
```

- [ ] **Step 8: Verificar que compila y que la suite sigue verde**

Run: `npm run build:app`
Expected: build exitoso, sin errores de TypeScript.

Run: `npm test -w app`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/src/app/register/treatment/page.tsx
git commit -m "refactor(tratamiento): la pantalla usa el selector puro y el outbox"
```

---

### Task 7: Reactivar la entrada al módulo

Cuatro toques, todos de quitar lo que puso el commit `5fd0575`.

**Files:**
- Delete: `app/src/app/register/treatment/layout.tsx`
- Modify: `app/src/app/page.tsx:17`
- Modify: `app/src/components/layout/mobile-bottom-nav.tsx:27`
- Modify: `app/src/__tests__/components/home-actions.test.tsx`

**Interfaces:** ninguna.

- [ ] **Step 1: Actualizar el test primero**

En `app/src/__tests__/components/home-actions.test.tsx`, reemplazar el primer `it` por:

```tsx
  it('muestra Recorrido como "En mantenimiento" y deja Tratamiento navegable', () => {
    render(<HomePage />)
    expect(screen.getAllByText('En mantenimiento')).toHaveLength(1)
    expect(screen.queryByRole('link', { name: /recorrido/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /tratamiento/i }))
      .toHaveAttribute('href', '/register/treatment')
  })
```

Cambia el nombre del `describe` también, que hoy dice "en modo interino" y sigue siendo cierto, así que se deja igual.

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -w app -- src/__tests__/components/home-actions.test.tsx`
Expected: FAIL — encuentra 2 "En mantenimiento" y no encuentra el link de tratamiento.

- [ ] **Step 3: Habilitar el tile del Home**

En `app/src/app/page.tsx:17`, cambiar `disabled: true` por `disabled: false` en la entrada de Tratamiento. Queda:

```tsx
  { href: '/register/treatment', label: 'Tratamiento',      icon: Flame,     style: 'bg-violet-100 text-violet-700', disabled: false },
```

- [ ] **Step 4: Habilitar la pestaña del bottom nav**

En `app/src/components/layout/mobile-bottom-nav.tsx:27`, quitar `, disabled: true` de la entrada de Tratamiento. Queda:

```tsx
  { href: '/register/treatment', label: 'Tratamiento', icon: Flame,     matchPrefix: '/register/treatment' },
```

- [ ] **Step 5: Borrar el layout que bloqueaba la ruta**

El archivo entero es el guard que agregó `5fd0575`; antes de ese commit no existía.

```bash
git rm app/src/app/register/treatment/layout.tsx
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npm test -w app`
Expected: PASS.

Run: `npm run build:app`
Expected: build exitoso.

- [ ] **Step 7: Commit**

```bash
git add app/src/app/page.tsx app/src/components/layout/mobile-bottom-nav.tsx app/src/__tests__/components/home-actions.test.tsx
git commit -m "feat(tratamiento): reactivar la entrada al módulo en el APK"
```

---

### Task 8: Bucket `sin_actividad` en el dashboard

Hoy `computeCirculationStatus` manda a `en_planta` tanto al tacho cuyo último evento es un tratamiento completado como al que no tiene **ningún** evento (`shared/src/lib/data/dashboard-metrics.ts:107`). Son 22 tratados contra 73 sin actividad, todos en verde. Con el módulo activo, esa es justo la métrica que el coordinador va a mirar para saber si funciona.

**Files:**
- Modify: `shared/src/lib/data/dashboard-metrics.ts` (tipo ~línea 16, `BUCKET_DEFINITIONS` ~línea 27, `computeCirculationStatus` ~línea 107, `counts` ~línea 125)
- Modify: `hub/src/components/containers/container-filters.tsx` (`PHASE_OPTIONS`, ~línea 18)
- Test: `shared/src/__tests__/lib/dashboard-metrics.test.ts` (líneas 38-40, 183, 227)

**Interfaces:**
- Produces: `CirculationBucket` gana el valor `'sin_actividad'`.

- [ ] **Step 1: Actualizar los tests existentes**

En `shared/src/__tests__/lib/dashboard-metrics.test.ts`:

Línea ~38, agregar la clave nueva al final del orden esperado:

```ts
    expect(result.buckets.map((b) => b.key)).toEqual([
      'en_planta', 'en_cliente', 'pendiente_pesar', 'pendiente_tratar', 'sin_actividad',
    ])
```

Línea ~183, cambiar:

```ts
  it('sin eventos → sin_actividad (nunca entró al sistema)', () => {
    expect(computeCirculationBucket(cont, base)).toBe('sin_actividad')
  })
```

Línea ~227, cambiar:

```ts
  it('sin eventos → sin_actividad y sinceMs null', () => {
    expect(computeCirculationStatus(cont, base)).toEqual({ bucket: 'sin_actividad', sinceMs: null })
  })
```

Y agregar un test nuevo al final del `describe('computeCirculationStatus', ...)`:

```ts
  it('distingue el tratado del que nunca tuvo actividad', () => {
    const receptions = [{
      id: 'r1', container_id: cont.id, weighing_session_id: null,
      arrived_at: '2026-09-17T08:00:00Z', gross_weight_kg: 40, operator_id: 'op-1',
      photo_ids: [], observations: '',
    }]
    const treatmentRuns = [{
      id: 't1', container_id: cont.id, started_at: '2026-09-18T10:00:00Z',
      completed_at: '2026-09-18T10:00:00Z', operator_id: 'op-1',
    }]
    expect(computeCirculationStatus(cont, { ...base, receptions, treatmentRuns }).bucket)
      .toBe('en_planta')
    expect(computeCirculationStatus(cont, base).bucket).toBe('sin_actividad')
  })
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -w shared -- src/__tests__/lib/dashboard-metrics.test.ts`
Expected: FAIL — recibe `'en_planta'` donde espera `'sin_actividad'`.

- [ ] **Step 3: Agregar el bucket al tipo y a las definiciones**

En `shared/src/lib/data/dashboard-metrics.ts`, el tipo (~línea 16):

```ts
export type CirculationBucket =
  | 'en_planta'        // tratado y listo para salir
  | 'en_cliente'       // entregado limpio en recorrido, esperando recogida sucia
  | 'pendiente_pesar'  // recogido sucio, sin recepción vigente
  | 'pendiente_tratar' // pesado, esperando tratamiento
  | 'sin_actividad'    // dado de alta, sin ningún evento todavía
```

`BUCKET_DEFINITIONS` (~línea 27), agregando la entrada al final:

```ts
const BUCKET_DEFINITIONS: Array<{ key: CirculationBucket; label: string; color: string }> = [
  { key: 'en_planta',        label: 'En planta',            color: '#16A34A' }, // verde
  { key: 'en_cliente',       label: 'En cliente',           color: '#F97316' }, // naranja
  { key: 'pendiente_pesar',  label: 'Pendiente por pesar',  color: '#94A3B8' }, // gris
  { key: 'pendiente_tratar', label: 'Pendiente por tratar', color: '#DC2626' }, // rojo
  { key: 'sin_actividad',    label: 'Sin actividad',        color: '#CBD5E1' }, // gris claro
]
```

- [ ] **Step 4: Cambiar la clasificación y el acumulador**

En `computeCirculationStatus` (~línea 107), la primera rama:

```ts
  if (latest === -Infinity) bucket = 'sin_actividad'
```

Las demás ramas no se tocan: `latest === closed` sigue dando `en_planta`, que ahora significa lo que dice.

En `computeCirculationBreakdown` (~línea 125), agregar la clave al contador inicial:

```ts
  const counts: Record<CirculationBucket, number> = {
    en_planta: 0, en_cliente: 0, pendiente_pesar: 0, pendiente_tratar: 0, sin_actividad: 0,
  }
```

- [ ] **Step 5: Agregar la opción al filtro del hub**

En `hub/src/components/containers/container-filters.tsx`, en `PHASE_OPTIONS`:

```ts
const PHASE_OPTIONS: { value: CirculationBucket; label: string }[] = [
  { value: 'en_planta', label: circulationLabel('en_planta') },
  { value: 'en_cliente', label: circulationLabel('en_cliente') },
  { value: 'pendiente_pesar', label: circulationLabel('pendiente_pesar') },
  { value: 'pendiente_tratar', label: circulationLabel('pendiente_tratar') },
  { value: 'sin_actividad', label: circulationLabel('sin_actividad') },
]
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npm test -w shared -- src/__tests__/lib/dashboard-metrics.test.ts`
Expected: PASS.

Run: `npm test`
Expected: PASS en los tres workspaces. Si alguna suite del hub asume cuatro buckets, actualizarla al mismo criterio.

Run: `npm run build:hub`
Expected: build exitoso. Si TypeScript señala un `switch` o un `Record<CirculationBucket, ...>` incompleto en el hub, completarlo con `sin_actividad`.

- [ ] **Step 7: Commit**

```bash
git add shared/src/lib/data/dashboard-metrics.ts shared/src/__tests__/lib/dashboard-metrics.test.ts hub/src/components/containers/container-filters.tsx
git commit -m "feat(dashboard): separar 'sin actividad' de 'en planta' en circulación"
```

---

### Task 9: Documentar en el vault

`CLAUDE.md` exige log por feature y ADR por decisión no obvia. Además hay que cerrar la incoherencia de que el apagado del 2026-09-15 nunca se documentó.

**Files:**
- Create: `vault/logs/2026-09-18-reactivacion-tratamiento.md`
- Create: `vault/decisions/2026-09-18-id-determinista-tratamiento.md`
- Modify: `vault/_index.md` (pendientes, lista de ADRs, lista de logs)
- Modify: `vault/processes/ContainerLifecycle.md` (el tratamiento cierra el `exit_at`)

**Interfaces:** ninguna.

- [ ] **Step 1: Escribir el log**

`vault/logs/2026-09-18-reactivacion-tratamiento.md`, con frontmatter (`title`, `tags`, `updated: 2026-09-18`). Contenido mínimo: que el módulo se apagó el 2026-09-15 sin documentar, que planta seguía usándolo desde el APK v1.5 sin outbox, qué se arregló, y las tres consultas abiertas a Francesca.

- [ ] **Step 2: Escribir el ADR del id determinista**

`vault/decisions/2026-09-18-id-determinista-tratamiento.md`, siguiendo `vault/decisions/Formato-ADR.md`. Decisión: el id del `treatment_run` es UUID v5 de `tacho:recepción` en vez de aleatorio. Razón: colapsa doble tap, dos teléfonos y reenvíos del outbox sin depender de la red ni de un constraint que rebote horas después.

- [ ] **Step 3: Actualizar el índice**

En `vault/_index.md`: quitar el pendiente "Reactivar el módulo de tratamiento", agregar el ADR nuevo a la lista de decisiones y el log a la sección de logs vigentes. Agregar a los pendientes las tres consultas a Francesca (autoclave por lote, cronometraje del ciclo, qué muestra la foto de tratamiento).

- [ ] **Step 4: Corregir `ContainerLifecycle.md`**

El diagrama dice que el tacho pasa de tratamiento a `clean` sin mencionar la cámara fría. Agregar que el envío a tratamiento **cierra el `exit_at`** del evento de cámara fría, y que por eso el tiempo en cámara fría es confiable desde el 2026-09-18 en adelante.

- [ ] **Step 5: Commit**

```bash
git add vault/
git commit -m "docs(vault): log y ADR de la reactivación del tratamiento"
```

---

## Cierre

Al terminar las nueve tareas, el módulo queda activo **en el código**. No cambia nada en planta hasta desplegar el APK, que es un pendiente ya abierto en `vault/_index.md`.

Antes del despliegue, verificación manual en el dispositivo:

1. Pesar un tacho infeccioso y finalizar la sesión → debe aparecer en la cola de tratamiento.
2. Poner el teléfono en modo avión, tratarlo → debe confirmar normalmente.
3. Restaurar la red → el registro debe aparecer en Supabase, y el `storage_event` correspondiente con `exit_at` no nulo.
4. Tratar el mismo tacho dos veces seguidas → debe haber **una sola** fila en `treatment_runs`.
