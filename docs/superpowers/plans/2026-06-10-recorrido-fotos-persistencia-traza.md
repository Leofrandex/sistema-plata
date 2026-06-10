# Lote post-lanzamiento: fotos recorrido, persistencia cross-device, traza usuario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arreglar la persistencia/hidratación incompleta que rompe el tratamiento cross-device y el gráfico kg/día, agregar traza de usuario en tachos, eliminar columnas muertas, y rediseñar las fotos de recorrido (sucios/limpios, obligatorias, visibles al editar).

**Architecture:** Los eventos siguen siendo la fuente de verdad (sin columna de fase). Se completa el camino write-through → Supabase → hidratación para `storage_events`, `container_locations`, `treatment_runs` y `external_transfers`, que hoy viven solo en mocks/store local. Las fotos de recorrido se etiquetan con `photos.role` (`'dirty'`/`'clean'`) y se reconstruyen agrupadas al hidratar.

**Tech Stack:** Next.js (App Router) + React + Zustand + Supabase (Postgres + Storage) + TypeScript + Jest. Queries tipadas en `src/lib/supabase/queries/*`. Migraciones en `supabase/migrations/` aplicadas vía el MCP de Supabase (`apply_migration`), tipos regenerados vía `generate_typescript_types`.

**Proyecto Supabase:** ref `xqqnthyipkdkwyknbtnw`.

**Convenciones del repo:**
- Queries: cada función recibe `db: DB` primero, usa `unwrap(...)`, devuelve filas tipadas. Se exportan vía `src/lib/supabase/queries/index.ts`.
- Tests Jest en `src/__tests__/lib/`. Correr todo: `npm test`. Build/typecheck: `npm run build`.
- Commits frecuentes, mensajes en español tipo `feat(...)`/`fix(...)`/`chore(...)`, terminando con la línea `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Estás en `main`. Antes de la primera tarea, crear rama de trabajo (Task 0).

---

## Mapa de archivos

**Crear:**
- `src/lib/supabase/queries/storage.ts` — queries de `storage_events`, `container_locations`, `external_transfers`.
- `supabase/migrations/20260610010000_photos_role.sql`
- `supabase/migrations/20260610020000_containers_created_by.sql`
- `supabase/migrations/20260610030000_route_events_drop_floor_dock.sql`
- `src/__tests__/lib/hydrate-adapters.test.ts`
- `src/__tests__/lib/route-photos.test.ts`

**Modificar:**
- `src/lib/supabase/queries/treatment.ts` — agregar `listTreatmentRuns`.
- `src/lib/supabase/queries/index.ts` — exportar `./storage`.
- `src/lib/supabase/queries/containers.ts` — `created_by` en insert (vía tipos regenerados; sin cambio manual si se pasa el campo).
- `src/components/supabase-hydrator.tsx` — cargar y mapear las 4 tablas; agrupar fotos de recorrido por `role`.
- `src/app/register/weighing/page.tsx` — write-through de `storage_events` + `container_locations`; usar IDs reales.
- `src/app/register/treatment/page.tsx` — write-through del `container_location`.
- `src/components/register/route-form.tsx` — secciones de fotos sucios/limpios + existentes.
- `src/app/register/route/anden/[slot]/page.tsx` — estado del form por categoría, fotos existentes, anti doble-submit, validación.
- `src/app/register/route/morgue/page.tsx` — adaptar al nuevo `RouteFormState` (morgue mantiene su comportamiento).
- `src/lib/types.ts` — `Container.created_by`; `RouteEvent.dirty_photo_ids`/`clean_photo_ids`; quitar `floor`/`dock` de `RouteEvent`.
- `src/lib/data/photos.ts` — `role` opcional en `uploadEventPhotos`.
- `src/lib/supabase/queries/photos.ts` — `role` en insert de `uploadPhoto`.
- `src/components/admin/container-form.tsx` + `src/app/admin/containers/page.tsx` — poblar y mostrar `created_by`.
- `src/lib/mock-data.ts` — quitar `floor`/`dock` de route events mock si rompen el tipo.

---

# Grupo 1 — Persistencia + hidratación completas

### Task 0: Rama de trabajo

- [ ] **Step 1: Crear la rama**

```bash
git checkout -b feat/lote-fotos-persistencia-traza
```

- [ ] **Step 2: Verificar baseline verde**

Run: `npm test`
Expected: PASS (suite actual, ~todos los tests verdes).

---

### Task 1: Query module `storage.ts` (storage_events, container_locations, external_transfers)

**Files:**
- Create: `src/lib/supabase/queries/storage.ts`
- Modify: `src/lib/supabase/queries/treatment.ts`
- Modify: `src/lib/supabase/queries/index.ts`

- [ ] **Step 1: Crear el módulo de queries**

Create `src/lib/supabase/queries/storage.ts`:

```ts
import type { Tables, TablesInsert } from '../database.types'
import { unwrap, type DB } from './_helpers'

export type StorageEventRow = Tables<'storage_events'>
export type ContainerLocationRow = Tables<'container_locations'>
export type ExternalTransferRow = Tables<'external_transfers'>

// ─── storage_events ──────────────────────────────────────────────────────────

export async function createStorageEvent(
  db: DB,
  input: TablesInsert<'storage_events'>,
): Promise<StorageEventRow> {
  return unwrap(await db.from('storage_events').insert(input).select().single())
}

export async function listStorageEvents(db: DB): Promise<StorageEventRow[]> {
  return unwrap(await db.from('storage_events').select('*').order('entry_at'))
}

// ─── container_locations ─────────────────────────────────────────────────────

export async function createContainerLocation(
  db: DB,
  input: TablesInsert<'container_locations'>,
): Promise<ContainerLocationRow> {
  return unwrap(await db.from('container_locations').insert(input).select().single())
}

export async function listContainerLocations(db: DB): Promise<ContainerLocationRow[]> {
  return unwrap(await db.from('container_locations').select('*').order('reported_at'))
}

// ─── external_transfers ──────────────────────────────────────────────────────

export async function listExternalTransfers(db: DB): Promise<ExternalTransferRow[]> {
  return unwrap(await db.from('external_transfers').select('*').order('storage_started_at'))
}
```

- [ ] **Step 2: Agregar `listTreatmentRuns` a treatment.ts**

In `src/lib/supabase/queries/treatment.ts`, append after `createTreatmentRun`:

```ts
export async function listTreatmentRuns(db: DB): Promise<TreatmentRunRow[]> {
  return unwrap(await db.from('treatment_runs').select('*').order('started_at'))
}
```

- [ ] **Step 3: Exportar el módulo nuevo**

In `src/lib/supabase/queries/index.ts`, add to the export list (after `./route-events`):

```ts
export * from './storage'
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: compila sin errores de tipos en las nuevas queries.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries/storage.ts src/lib/supabase/queries/treatment.ts src/lib/supabase/queries/index.ts
git commit -m "feat(queries): storage_events/container_locations/external_transfers + listTreatmentRuns

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Hidratar las 4 tablas faltantes en el store

**Files:**
- Modify: `src/components/supabase-hydrator.tsx`
- Test: `src/__tests__/lib/hydrate-adapters.test.ts`

Hoy `storageEvents`, `treatmentRuns`, `externalTransfers` y `locations` nunca se reemplazan: quedan en MOCK. Esto los pone como datos reales de Supabase.

- [ ] **Step 1: Escribir el test de los adaptadores fila→tipo (que falla)**

Create `src/__tests__/lib/hydrate-adapters.test.ts`:

```ts
import { rowToStorageEvent, rowToTreatmentRun, rowToExternalTransfer, rowToLocation } from '@/components/supabase-hydrator'
import type { StorageEventRow, ContainerLocationRow, ExternalTransferRow } from '@/lib/supabase/queries'
import type { TreatmentRunRow } from '@/lib/supabase/queries'

describe('hydrate adapters', () => {
  it('rowToStorageEvent mapea campos y deja photo_ids vacío', () => {
    const row: StorageEventRow = {
      id: 'st-1', container_id: '001', entry_at: '2026-06-10T10:00:00Z',
      exit_at: null, operator_id: 'op-1', created_at: '2026-06-10T10:00:00Z',
    }
    expect(rowToStorageEvent(row)).toEqual({
      id: 'st-1', container_id: '001', entry_at: '2026-06-10T10:00:00Z',
      exit_at: null, operator_id: 'op-1', photo_ids: [],
    })
  })

  it('rowToTreatmentRun mapea started/completed', () => {
    const row: TreatmentRunRow = {
      id: 'tr-1', container_id: '001', started_at: '2026-06-10T11:00:00Z',
      completed_at: '2026-06-10T11:00:00Z', operator_id: 'op-1', created_at: '2026-06-10T11:00:00Z',
    }
    expect(rowToTreatmentRun(row)).toEqual({
      id: 'tr-1', container_id: '001', started_at: '2026-06-10T11:00:00Z',
      completed_at: '2026-06-10T11:00:00Z', operator_id: 'op-1',
    })
  })

  it('rowToLocation mapea todos los campos nullables', () => {
    const row: ContainerLocationRow = {
      id: 'loc-1', container_id: '001', reported_at: '2026-06-10T11:00:00Z',
      operator_id: 'op-1', location_type: 'cold_storage', client_id: null,
      floor: null, area: null, notes: 'Cámara fría',
    }
    expect(rowToLocation(row)).toEqual(row)
  })

  it('rowToExternalTransfer mapea destino', () => {
    const row: ExternalTransferRow = {
      id: 'xf-1', container_id: '001', storage_started_at: '2026-06-10T11:00:00Z',
      transferred_at: null, destination: 'Centro X', operator_id: 'op-1', created_at: '2026-06-10T11:00:00Z',
    }
    expect(rowToExternalTransfer(row)).toEqual({
      id: 'xf-1', container_id: '001', storage_started_at: '2026-06-10T11:00:00Z',
      transferred_at: null, destination: 'Centro X', operator_id: 'op-1',
    })
  })
})
```

- [ ] **Step 2: Correr el test para ver que falla**

Run: `npm test -- hydrate-adapters`
Expected: FAIL — `rowToStorageEvent is not a function` (aún no exportados).

- [ ] **Step 3: Agregar los adaptadores y la carga en el hydrator**

In `src/components/supabase-hydrator.tsx`:

(a) Extender los imports de tipos del store:

```ts
import type {
  Container,
  WeighingSession,
  ContainerReception,
  RouteEvent,
  Photo,
  StorageEvent,
  TreatmentRun,
  ExternalTransfer,
  ContainerLocation,
} from '@/lib/types'
```

(b) Extender el `Promise.all` de carga (dentro de `load()`), agregando 4 llamadas:

```ts
const [
  containersRaw, sessionsRaw, routeEventsRaw, dirtyLinks, cleanLinks, photosRaw,
  storageRaw, treatmentRaw, transfersRaw, locationsRaw,
] = await Promise.all([
  q.listContainers(supabase),
  q.listWeighingSessions(supabase),
  q.listRouteEvents(supabase),
  q.listAllRouteContainersDirty(supabase),
  q.listAllRouteContainersClean(supabase),
  q.listAllPhotos(supabase),
  q.listStorageEvents(supabase),
  q.listTreatmentRuns(supabase),
  q.listExternalTransfers(supabase),
  q.listContainerLocations(supabase),
])
if (cancelled) return
```

(c) Antes del `useStore.getState().hydrate({...})`, mapear:

```ts
const storageEvents: StorageEvent[] = storageRaw.map(rowToStorageEvent)
const treatmentRuns: TreatmentRun[] = treatmentRaw.map(rowToTreatmentRun)
const externalTransfers: ExternalTransfer[] = transfersRaw.map(rowToExternalTransfer)
const locations: ContainerLocation[] = locationsRaw.map(rowToLocation)
```

(d) Incluirlos en el patch de `hydrate`:

```ts
useStore.getState().hydrate({
  containers,
  weighingSessions,
  receptions,
  routeEvents,
  photos,
  storageEvents,
  treatmentRuns,
  externalTransfers,
  locations,
})
```

(e) Agregar los adaptadores exportados al final del archivo (junto a `rowToContainer`):

```ts
export function rowToStorageEvent(r: q.StorageEventRow): StorageEvent {
  return {
    id: r.id,
    container_id: r.container_id,
    entry_at: r.entry_at,
    exit_at: r.exit_at,
    operator_id: r.operator_id,
    photo_ids: [],
  }
}

export function rowToTreatmentRun(r: q.TreatmentRunRow): TreatmentRun {
  return {
    id: r.id,
    container_id: r.container_id,
    started_at: r.started_at,
    completed_at: r.completed_at,
    operator_id: r.operator_id,
  }
}

export function rowToExternalTransfer(r: q.ExternalTransferRow): ExternalTransfer {
  return {
    id: r.id,
    container_id: r.container_id,
    storage_started_at: r.storage_started_at,
    transferred_at: r.transferred_at,
    destination: r.destination,
    operator_id: r.operator_id,
  }
}

export function rowToLocation(r: q.ContainerLocationRow): ContainerLocation {
  return {
    id: r.id,
    container_id: r.container_id,
    reported_at: r.reported_at,
    operator_id: r.operator_id,
    location_type: r.location_type,
    client_id: r.client_id,
    floor: r.floor,
    area: r.area,
    notes: r.notes,
  }
}
```

- [ ] **Step 4: Correr el test para ver que pasa**

Run: `npm test -- hydrate-adapters`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck completo**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/supabase-hydrator.tsx src/__tests__/lib/hydrate-adapters.test.ts
git commit -m "fix(hydrator): hidratar storage_events/treatment_runs/external_transfers/locations desde Supabase

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Write-through de storage_events + container_locations al finalizar pesaje

**Files:**
- Modify: `src/app/register/weighing/page.tsx` (`handleFinish`, ~líneas 404-428)

Hoy `handleFinish` crea `StorageEvent` y `ContainerLocation` solo en el store local. Persistirlos a Supabase y usar los IDs reales.

- [ ] **Step 1: Reemplazar el bloque de creación de eventos posteriores**

In `handleFinish`, reemplazar el bucle `for (const [idx, r] of sessionReceptions.entries()) { ... }` por:

```ts
// 2. Crear TreatmentRun (inmediato) o StorageEvent + ContainerLocation por reception.
//    Todo se persiste a Supabase primero y se refleja en el store con el id real.
const supabaseEvents = createClient()
for (const r of sessionReceptions) {
  if (r.treat_immediately && r.waste_type === 'infectious') {
    try {
      const tr = await q.createTreatmentRun(supabaseEvents, {
        container_id: r.container_id,
        started_at: now,
        completed_at: now,
        operator_id: currentProfileId,
      })
      addTreatmentRun({ id: tr.id, container_id: r.container_id, started_at: now, completed_at: now, operator_id: currentProfileId })
      const loc = await q.createContainerLocation(supabaseEvents, {
        container_id: r.container_id, reported_at: now, operator_id: currentProfileId,
        location_type: 'treatment', client_id: null, floor: null, area: null, notes: 'Tratado al finalizar pesaje',
      })
      addLocation({
        id: loc.id, container_id: r.container_id, reported_at: now, operator_id: currentProfileId,
        location_type: 'treatment', client_id: null, floor: null, area: null, notes: 'Tratado al finalizar pesaje',
      })
    } catch (err) {
      console.error('[pesaje] tratamiento inmediato falló:', err)
    }
  } else {
    try {
      const st = await q.createStorageEvent(supabaseEvents, {
        container_id: r.container_id, entry_at: now, exit_at: null, operator_id: currentProfileId,
      })
      addStorageEvent({ id: st.id, container_id: r.container_id, entry_at: now, exit_at: null, operator_id: currentProfileId, photo_ids: [] })
      const loc = await q.createContainerLocation(supabaseEvents, {
        container_id: r.container_id, reported_at: now, operator_id: currentProfileId,
        location_type: 'cold_storage', client_id: null, floor: null, area: null, notes: 'Cámara fría (auto tras pesaje)',
      })
      addLocation({
        id: loc.id, container_id: r.container_id, reported_at: now, operator_id: currentProfileId,
        location_type: 'cold_storage', client_id: null, floor: null, area: null, notes: 'Cámara fría (auto tras pesaje)',
      })
    } catch (err) {
      console.error('[pesaje] pase a cámara fría falló:', err)
    }
  }
}
```

(Nota: se elimina el uso del índice `idx` y los ids `storage-${Date.now()}`/`loc-${Date.now()}`.)

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: compila. (`addStorageEvent`, `addLocation`, `addTreatmentRun` ya están desestructurados del store en este archivo.)

- [ ] **Step 3: Commit**

```bash
git add src/app/register/weighing/page.tsx
git commit -m "fix(pesaje): persistir storage_events y container_locations a Supabase al finalizar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Write-through del container_location en envío a tratamiento

**Files:**
- Modify: `src/app/register/treatment/page.tsx` (`handleSubmit`, ~líneas 89-118)

El `addLocation` del envío a tratamiento también es local-only.

- [ ] **Step 1: Persistir la ubicación de tratamiento**

In `handleSubmit`, dentro del `try`, reemplazar el bloque `addLocation({ id: \`loc-${Date.now()}-${id}\`, ... })` por:

```ts
const loc = await q.createContainerLocation(supabase, {
  container_id: id,
  reported_at: now,
  operator_id: currentProfileId,
  location_type: 'treatment',
  client_id: null,
  floor: null,
  area: null,
  notes: 'Tratamiento',
})
addLocation({
  id: loc.id,
  container_id: id,
  reported_at: now,
  operator_id: currentProfileId,
  location_type: 'treatment',
  client_id: null,
  floor: null,
  area: null,
  notes: 'Tratamiento',
})
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: compila.

- [ ] **Step 3: Verificación manual cross-device (clave de este grupo)**

Manual:
1. En dispositivo/navegador A: iniciar pesaje, pesar un tacho infeccioso (sin "tratar inmediatamente"), finalizar.
2. En Supabase (MCP `execute_sql`): `select count(*) from storage_events;` y `select count(*) from container_locations;` → deben tener filas nuevas.
3. En dispositivo/navegador B (sesión distinta): abrir `/register/treatment` → el tacho aparece como candidato.
4. Volver a A, refrescar → sigue apareciendo (ya no depende del store local).

- [ ] **Step 4: Commit**

```bash
git add src/app/register/treatment/page.tsx
git commit -m "fix(tratamiento): persistir container_location a Supabase

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Grupo 3 — Anti doble-submit en andén

### Task 5: Deshabilitar "Guardar andén" mientras guarda

**Files:**
- Modify: `src/app/register/route/anden/[slot]/page.tsx`

Causa de los andenes duplicados (001/055/185 dos veces): el botón no se bloquea durante el guardado async.

- [ ] **Step 1: Agregar estado `saving` y guard en `handleSaveAnden`**

Cerca de los otros `useState` del componente, agregar:

```ts
const [saving, setSaving] = useState(false)
```

Reemplazar `handleSaveAnden` por:

```ts
async function handleSaveAnden() {
  if (!currentProfileId || !client || saving) return
  setSaving(true)
  try {
    if (editingAndenId) {
      await handleUpdateAnden(editingAndenId)
    } else {
      await handleCreateAnden()
    }
  } finally {
    setSaving(false)
  }
}
```

- [ ] **Step 2: Deshabilitar el botón con `saving`**

En el botón "Guardar andén / Guardar cambios del andén", cambiar `disabled`:

```tsx
<Button onClick={handleSaveAnden} disabled={!canSaveAnden || saving} size="lg" className="gap-2 sm:flex-1">
  <Plus className="h-4 w-4" />
  {saving ? 'Guardando…' : isEditing ? 'Guardar cambios del andén' : 'Guardar andén y agregar otro'}
</Button>
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: compila.

- [ ] **Step 4: Verificación manual**

Manual: iniciar recorrido, seleccionar tachos + empresa + fotos, hacer doble-click rápido en "Guardar andén" → se crea **un** andén (verificar en el drawer y en `select count(*) from route_events where date = current_date`).

- [ ] **Step 5: Commit**

```bash
git add src/app/register/route/anden/[slot]/page.tsx
git commit -m "fix(recorrido): evitar andenes duplicados por doble-submit

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Grupo 4 — Traza de usuario en tachos

### Task 6: Migración `containers.created_by` + regenerar tipos

**Files:**
- Create: `supabase/migrations/20260610020000_containers_created_by.sql`

- [ ] **Step 1: Escribir la migración**

Create `supabase/migrations/20260610020000_containers_created_by.sql`:

```sql
-- Traza de quién registró cada tacho. Nullable: los 230 históricos quedan null.
alter table public.containers
  add column created_by uuid references public.profiles(id);

comment on column public.containers.created_by is
  'Perfil que registró el tacho. Null para históricos importados.';
```

- [ ] **Step 2: Aplicar la migración (MCP Supabase)**

Aplicar con la herramienta MCP `apply_migration` (project_id `xqqnthyipkdkwyknbtnw`, name `containers_created_by`, query = el SQL de arriba).
Verificar: `execute_sql` → `select column_name from information_schema.columns where table_name='containers' and column_name='created_by';` devuelve 1 fila.

- [ ] **Step 3: Regenerar tipos**

Usar la herramienta MCP `generate_typescript_types` (project_id `xqqnthyipkdkwyknbtnw`) y volcar el resultado a `src/lib/supabase/database.types.ts`. Verificar que `containers.Row` ahora incluye `created_by: string | null`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260610020000_containers_created_by.sql src/lib/supabase/database.types.ts
git commit -m "feat(db): containers.created_by + regenerar tipos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Poblar y propagar `created_by` en el alta de tachos

**Files:**
- Modify: `src/lib/types.ts` (`Container`)
- Modify: `src/components/admin/container-form.tsx`
- Modify: `src/app/admin/containers/page.tsx`
- Modify: `src/components/supabase-hydrator.tsx` (`rowToContainer`)

- [ ] **Step 1: Agregar `created_by` al tipo `Container`**

In `src/lib/types.ts`, dentro de `interface Container`, agregar:

```ts
  /** Perfil que registró el tacho. Null para históricos importados. */
  created_by?: string | null
```

- [ ] **Step 2: Mapear `created_by` al hidratar + hidratar perfiles a `users`**

In `src/components/supabase-hydrator.tsx`:

(a) En `rowToContainer`, agregar al objeto devuelto:

```ts
    created_by: r.created_by ?? null,
```

(b) El store arranca con `users` = mock, y nunca se reemplaza, así que los nombres
de perfiles reales (uuid de `created_by`) no resolverían. Hidratar los perfiles:
en el `Promise.all` de `load()` agregar `q.listProfiles(supabase)` y mapearlos a
`User[]`. Agregar a la lista de cargas:

```ts
  q.listProfiles(supabase),
```

(asignándolo a una nueva variable `profilesRaw` en el destructuring del array).
Antes del `hydrate({...})`, construir:

```ts
const users = profilesRaw.map((p) => ({ id: p.id, name: p.name }))
```

e incluir `users` en el patch de `hydrate`.

- [ ] **Step 3: Pasar `created_by` al crear el tacho**

In `src/app/admin/containers/page.tsx`, `handleAdd`: obtener el perfil del store y enviarlo.

(a) Extender el destructuring del store:

```ts
const { containers, addContainer, updateContainer, currentProfileId, users } = useStore()
```

(b) En la llamada `q.createContainer(...)`, agregar el campo:

```ts
      created_by: currentProfileId,
```

(c) En `addContainer(...)`, incluir `created_by`:

```ts
    addContainer({ ...data, status: 'active', registered_at: now, created_by: currentProfileId })
```

- [ ] **Step 4: Mostrar "Registrado por" en la tabla**

In `src/app/admin/containers/page.tsx`:

(a) Agregar la columna al `<thead>` (antes de la celda vacía de acciones):

```tsx
              <th className="px-4 py-3 font-medium">Registrado por</th>
```

(b) Agregar la celda en cada fila (antes de la celda de "Dar de baja"). Resolver el nombre desde `users` (o `profiles` del store si existe; usar `users` que ya está en el store):

```tsx
                  <td className="px-4 py-3 text-slate-600">
                    {c.created_by ? (users.find((u) => u.id === c.created_by)?.name ?? '—') : '—'}
                  </td>
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: compila. (Si `q.createContainer` no acepta `created_by`, es porque los tipos no se regeneraron en Task 6 — volver a Step 3 de Task 6.)

- [ ] **Step 6: Verificación manual**

Manual: en `/admin/containers`, crear un tacho nuevo → en Supabase `select id, created_by from containers where id='<nuevo>'` muestra el uuid; la tabla muestra el nombre del usuario; los históricos muestran "—".

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/components/supabase-hydrator.tsx src/app/admin/containers/page.tsx
git commit -m "feat(tachos): registrar y mostrar created_by

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Grupo 5 — Limpieza de schema

### Task 8: Drop de `route_events.floor` y `route_events.dock`

**Files:**
- Create: `supabase/migrations/20260610030000_route_events_drop_floor_dock.sql`
- Modify: `src/lib/types.ts` (`RouteEvent`)
- Modify: `src/components/supabase-hydrator.tsx` (`mapRouteEvents`)
- Modify: `src/components/register/route-form.tsx` (`RouteFormState`)
- Modify: `src/app/register/route/anden/[slot]/page.tsx`
- Modify: `src/app/register/route/morgue/page.tsx`
- Modify: `src/__tests__/lib/map-route-events.test.ts`
- Modify: `src/lib/mock-data.ts` (si define floor/dock)

`area` se conserva como la ubicación del recorrido. `floor`/`dock` nunca se escriben.

- [ ] **Step 1: Escribir y aplicar la migración**

Create `supabase/migrations/20260610030000_route_events_drop_floor_dock.sql`:

```sql
-- Columnas muertas: nunca se escriben desde la UI (la ubicación usa `area`).
alter table public.route_events drop column if exists floor;
alter table public.route_events drop column if exists dock;
```

Aplicar vía MCP `apply_migration` (name `route_events_drop_floor_dock`). Verificar con `execute_sql`:
`select column_name from information_schema.columns where table_name='route_events' and column_name in ('floor','dock');` → 0 filas.

- [ ] **Step 2: Regenerar tipos**

MCP `generate_typescript_types` → volcar a `src/lib/supabase/database.types.ts`. Verificar que `route_events.Row` ya no tiene `floor`/`dock`.

- [ ] **Step 3: Quitar `floor`/`dock` del tipo `RouteEvent`**

In `src/lib/types.ts`, en `interface RouteEvent`, eliminar las líneas `floor: string`, `dock: string` y dejar solo:

```ts
  // Ubicación del recorrido (selector único; ver LOCATION_OPTIONS)
  area: string
```

- [ ] **Step 4: Ajustar `mapRouteEvents`**

In `src/components/supabase-hydrator.tsx`, en el objeto devuelto por `mapRouteEvents`, eliminar `floor: e.floor` y `dock: e.dock`; conservar `area: e.area`.

- [ ] **Step 5: Ajustar el formulario y las páginas**

In `src/components/register/route-form.tsx`, en `RouteFormState`, eliminar `floor: string` y `dock: string` (conservar `area`).

In `src/app/register/route/anden/[slot]/page.tsx`:
- En `EMPTY_FORM` eliminar `floor: ''`, `dock: ''`.
- En `handleSelectAnden` eliminar `floor: ev.floor`, `dock: ev.dock`.
- En `handleCreateAnden`/`handleUpdateAnden`: en los objetos `q.updateRouteEvent`/`addRouteEvent`/`updateRouteEvent` eliminar `floor`/`dock` (conservar `area`).

In `src/app/register/route/morgue/page.tsx`, eliminar `floor`/`dock` (conservar `area`) en TODAS sus apariciones:
- El `useState<RouteFormState>` inicial (quitar `floor: ''`, `dock: ''`).
- En `updateForm`, quitar las dos líneas `...(updates.floor !== undefined && { floor: updates.floor })` y `...(updates.dock !== undefined && { dock: updates.dock })`.
- En el `setFormState` del `useEffect` de hidratación (quitar `floor: event.floor`, `dock: event.dock`).
- En `addRouteEvent` de `handleStart` (quitar `floor: formState.floor`, `dock: formState.dock`).
- En el `setFormState` de `handleCancel` (quitar `floor: ''`, `dock: ''`).
- En `q.updateRouteEvent` y en el `patch: Partial<RouteEvent>` de `handleFinish` (quitar `floor`/`dock`).

(En este punto morgue sigue usando `photos` — no se toca aún; se migra en Task 14.)

- [ ] **Step 6: Ajustar el test de mapRouteEvents y los mocks**

In `src/__tests__/lib/map-route-events.test.ts`:
- En `makeRow`, eliminar `floor: '2'` y `dock: 'A'` (ya no existen en `RouteEventRow`).
- En el test "preserva los campos base", quitar `floor: '2'`, `dock: 'A'` del `toMatchObject` y dejar `area: 'UCI'`.

In `src/lib/mock-data.ts`: si los route events mock definen `floor`/`dock`, eliminarlos (mantener `area`).

- [ ] **Step 7: Correr tests + build**

Run: `npm test`
Expected: PASS (incl. map-route-events ajustado).
Run: `npm run build`
Expected: compila sin referencias a `floor`/`dock`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore(db): drop route_events.floor/dock (columnas muertas)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Grupo 2 — Rediseño de fotos en recorrido

### Task 9: Migración `photos.role` + regenerar tipos

**Files:**
- Create: `supabase/migrations/20260610010000_photos_role.sql`

- [ ] **Step 1: Escribir y aplicar la migración**

Create `supabase/migrations/20260610010000_photos_role.sql`:

```sql
-- Rol de la foto dentro de su evento. Para recorrido: 'dirty' | 'clean'.
-- Null para pesaje (posicional balanza/tacho) y resto de eventos.
alter table public.photos add column role text;

comment on column public.photos.role is
  'Rol de la foto en su evento. Recorrido: dirty|clean. Null en otros eventos.';
```

Aplicar vía MCP `apply_migration` (name `photos_role`). Verificar con `execute_sql`:
`select column_name from information_schema.columns where table_name='photos' and column_name='role';` → 1 fila.

- [ ] **Step 2: Regenerar tipos**

MCP `generate_typescript_types` → volcar a `src/lib/supabase/database.types.ts`. Verificar que `photos.Row` incluye `role: string | null`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260610010000_photos_role.sql src/lib/supabase/database.types.ts
git commit -m "feat(db): photos.role para distinguir fotos sucios/limpios en recorrido

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Propagar `role` en la subida de fotos

**Files:**
- Modify: `src/lib/supabase/queries/photos.ts` (`uploadPhoto`)
- Modify: `src/lib/data/photos.ts` (`uploadEventPhotos`)

- [ ] **Step 1: Aceptar `role` en `uploadPhoto`**

In `src/lib/supabase/queries/photos.ts`, en `uploadPhoto`:
- Agregar `role?: string | null` al objeto `args`.
- Agregar `role: args.role ?? null` al objeto `insert`.

- [ ] **Step 2: Aceptar `role` en `uploadPhotoFromDataUrl`**

In the same file, agregar `role?: string | null` a los `args` de `uploadPhotoFromDataUrl` (ya hace spread `...rest`, así que se propaga solo si está en el tipo).

- [ ] **Step 3: Aceptar `role` en `uploadEventPhotos`**

In `src/lib/data/photos.ts`, agregar `role?: string | null` a los `args` y pasarlo a `q.uploadPhotoFromDataUrl`:

```ts
      const row = await q.uploadPhotoFromDataUrl(db, {
        dataUrl,
        eventType: args.eventType,
        eventId: args.eventId,
        label: args.label,
        uploadedBy: args.uploadedBy,
        takenAt: args.takenAt,
        role: args.role ?? null,
      })
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: compila.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries/photos.ts src/lib/data/photos.ts
git commit -m "feat(fotos): role opcional en subida de fotos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Reconstruir fotos de recorrido agrupadas por rol al hidratar

**Files:**
- Modify: `src/lib/types.ts` (`RouteEvent`)
- Modify: `src/components/supabase-hydrator.tsx` (`mapRouteEvents` + hydrator)
- Test: `src/__tests__/lib/route-photos.test.ts`
- Modify: `src/__tests__/lib/map-route-events.test.ts`

- [ ] **Step 1: Agregar campos al tipo `RouteEvent`**

In `src/lib/types.ts`, en `interface RouteEvent`, junto a `photo_ids`, agregar:

```ts
  // Fotos del recorrido por categoría. `photo_ids` es la unión (lo usan los reportes).
  // Opcionales: los mocks y literales que no las setean quedan undefined (se leen con `?? []`).
  dirty_photo_ids?: string[]
  clean_photo_ids?: string[]
```

(Opcionales a propósito: evita tocar `MOCK_ROUTE_EVENTS` y el `addRouteEvent` de morgue,
que no las setean. El hydrator y el andén sí las llenan; los lectores usan `?? []`.)

- [ ] **Step 2: Escribir el test del helper de agrupación (que falla)**

Create `src/__tests__/lib/route-photos.test.ts`:

```ts
import { groupRoutePhotosByRole } from '@/components/supabase-hydrator'
import type { PhotoRow } from '@/lib/supabase/queries'

function photo(over: Partial<PhotoRow>): PhotoRow {
  return {
    id: 'p', storage_path: 'route/e1/p.jpg', url: null, event_type: 'route',
    event_id: 'e1', taken_at: '2026-06-10T10:00:00Z', label: '', uploaded_by: null,
    created_at: '2026-06-10T10:00:00Z', role: null, ...over,
  }
}

describe('groupRoutePhotosByRole', () => {
  it('separa dirty y clean por evento', () => {
    const rows: PhotoRow[] = [
      photo({ id: 'd1', event_id: 'e1', role: 'dirty' }),
      photo({ id: 'd2', event_id: 'e1', role: 'dirty' }),
      photo({ id: 'c1', event_id: 'e1', role: 'clean' }),
      photo({ id: 'd3', event_id: 'e2', role: 'dirty' }),
    ]
    const { dirtyByEvent, cleanByEvent } = groupRoutePhotosByRole(rows)
    expect(dirtyByEvent.get('e1')).toEqual(['d1', 'd2'])
    expect(cleanByEvent.get('e1')).toEqual(['c1'])
    expect(dirtyByEvent.get('e2')).toEqual(['d3'])
    expect(cleanByEvent.get('e2')).toBeUndefined()
  })

  it('fotos legacy sin role no entran en ningún grupo', () => {
    const rows: PhotoRow[] = [photo({ id: 'x', event_id: 'e1', role: null })]
    const { dirtyByEvent, cleanByEvent } = groupRoutePhotosByRole(rows)
    expect(dirtyByEvent.get('e1')).toBeUndefined()
    expect(cleanByEvent.get('e1')).toBeUndefined()
  })
})
```

- [ ] **Step 3: Correr el test para ver que falla**

Run: `npm test -- route-photos`
Expected: FAIL — `groupRoutePhotosByRole is not a function`.

- [ ] **Step 4: Implementar el helper y usarlo en el hydrator**

In `src/components/supabase-hydrator.tsx`:

(a) Agregar el helper exportado (cerca de `groupContainers`):

```ts
/** Agrupa las fotos de eventos 'route' por rol (dirty/clean) y por event_id.
 *  Las fotos sin role (legacy/pesaje) se ignoran. Exportada para test. */
export function groupRoutePhotosByRole(photos: q.PhotoRow[]): {
  dirtyByEvent: Map<string, string[]>
  cleanByEvent: Map<string, string[]>
} {
  const dirtyByEvent = new Map<string, string[]>()
  const cleanByEvent = new Map<string, string[]>()
  for (const p of photos) {
    if (p.event_type !== 'route') continue
    const target = p.role === 'dirty' ? dirtyByEvent : p.role === 'clean' ? cleanByEvent : null
    if (!target) continue
    const arr = target.get(p.event_id) ?? []
    arr.push(p.id)
    target.set(p.event_id, arr)
  }
  return { dirtyByEvent, cleanByEvent }
}
```

(b) En `load()`, después de construir `photoIdsByEvent`, agregar:

```ts
const { dirtyByEvent: dirtyPhotosByEvent, cleanByEvent: cleanPhotosByEvent } =
  groupRoutePhotosByRole(photosRaw)
```

(c) Cambiar la construcción de `routeEvents` para incluir los tres arrays:

```ts
const routeEvents = mapRouteEvents(routeEventsRaw, dirtyLinks, cleanLinks).map((e) => ({
  ...e,
  photo_ids: photoIdsByEvent.get(e.id) ?? [],
  dirty_photo_ids: dirtyPhotosByEvent.get(e.id) ?? [],
  clean_photo_ids: cleanPhotosByEvent.get(e.id) ?? [],
}))
```

(d) En `mapRouteEvents`, agregar defaults en el objeto devuelto (para que el tipo cierre):

```ts
    photo_ids: [],
    dirty_photo_ids: [],
    clean_photo_ids: [],
```

- [ ] **Step 5: Ajustar el test de mapRouteEvents**

In `src/__tests__/lib/map-route-events.test.ts`, en el test "devuelve arrays vacíos…", agregar aserciones:

```ts
    expect(result[0].dirty_photo_ids).toEqual([])
    expect(result[0].clean_photo_ids).toEqual([])
```

- [ ] **Step 6: Correr tests + build**

Run: `npm test`
Expected: PASS (route-photos + map-route-events + resto).
Run: `npm run build`
Expected: compila.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/components/supabase-hydrator.tsx src/__tests__/lib/route-photos.test.ts src/__tests__/lib/map-route-events.test.ts
git commit -m "feat(recorrido): reconstruir fotos dirty/clean por rol al hidratar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: Form de recorrido con secciones sucios/limpios (estado por categoría)

**Files:**
- Modify: `src/components/register/route-form.tsx`

Cambiar el estado de fotos de un solo array a dos (sucios/limpios) y mostrar dos secciones de captura en orden. Las fotos existentes (modo edición) se manejan en Task 13 vía props.

- [ ] **Step 1: Cambiar `RouteFormState` y las props**

In `src/components/register/route-form.tsx`:

(a) Reemplazar en `RouteFormState`:

```ts
  photos: string[] // dataURLs
```

por:

```ts
  /** Fotos NUEVAS (dataURLs) a subir, por categoría. */
  dirtyPhotos: string[]
  cleanPhotos: string[]
```

(b) Extender `Props` con las fotos existentes (modo edición) y sus callbacks de quitar:

```ts
  /** Fotos ya subidas que se conservan (modo edición), por categoría. */
  existingDirtyPhotos?: { id: string; url: string }[]
  existingCleanPhotos?: { id: string; url: string }[]
  onRemoveExistingDirty?: (id: string) => void
  onRemoveExistingClean?: (id: string) => void
```

(c) Agregar los nuevos props al destructuring de la firma del componente. Reemplazar:

```ts
export function RouteForm({ state, onChange, containers, companies, locked, showCompanySelector = false }: Props) {
```

por:

```ts
export function RouteForm({
  state, onChange, containers, companies, locked, showCompanySelector = false,
  existingDirtyPhotos, existingCleanPhotos, onRemoveExistingDirty, onRemoveExistingClean,
}: Props) {
```

- [ ] **Step 2: Reemplazar la sección de fotos**

Reemplazar el bloque `{/* Fotos ilimitadas */}` (la sección con un solo `PhotoCaptureMulti`) por dos secciones, sucios primero:

```tsx
      {/* Fotos de tachos sucios (primero) */}
      <section className="space-y-2">
        <ExistingPhotosGrid
          label="Foto de tachos sucios — ya cargadas"
          photos={existingDirtyPhotos ?? []}
          disabled={locked}
          onRemove={onRemoveExistingDirty}
        />
        <PhotoCaptureMulti
          label="Foto de tachos sucios"
          required
          disabled={locked}
          photos={state.dirtyPhotos}
          onAdd={(url) => onChange({ dirtyPhotos: [...state.dirtyPhotos, url] })}
          onRemove={(i) => onChange({ dirtyPhotos: state.dirtyPhotos.filter((_, idx) => idx !== i) })}
        />
      </section>

      {/* Fotos de tachos limpios (después) */}
      <section className="space-y-2">
        <ExistingPhotosGrid
          label="Foto de tachos limpios — ya cargadas"
          photos={existingCleanPhotos ?? []}
          disabled={locked}
          onRemove={onRemoveExistingClean}
        />
        <PhotoCaptureMulti
          label="Foto de tachos limpios"
          required
          disabled={locked}
          photos={state.cleanPhotos}
          onAdd={(url) => onChange({ cleanPhotos: [...state.cleanPhotos, url] })}
          onRemove={(i) => onChange({ cleanPhotos: state.cleanPhotos.filter((_, idx) => idx !== i) })}
        />
      </section>
```

Eliminar las funciones locales `addPhoto`/`removePhoto` (ya no se usan).

- [ ] **Step 3: Agregar el subcomponente `ExistingPhotosGrid`**

Al final de `route-form.tsx`, agregar:

```tsx
function ExistingPhotosGrid({
  label, photos, disabled, onRemove,
}: {
  label: string
  photos: { id: string; url: string }[]
  disabled: boolean
  onRemove?: (id: string) => void
}) {
  if (photos.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative">
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden border bg-slate-900">
              <Image src={p.url} alt="Foto cargada" fill className="object-contain" sizes="(max-width: 640px) 50vw, 33vw" />
            </div>
            {!disabled && onRemove && (
              <Button
                type="button" variant="destructive" size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => onRemove(p.id)} aria-label="Quitar foto cargada"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

Agregar los imports necesarios al tope de `route-form.tsx`:

```ts
import Image from 'next/image'
```

(`X` y `Button` ya están importados.)

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: compila salvo en `anden/[slot]/page.tsx` y `morgue/page.tsx`, que se ajustan en Task 13/14. Si el build falla solo ahí, es esperado; continuar.

- [ ] **Step 5: Commit**

```bash
git add src/components/register/route-form.tsx
git commit -m "feat(recorrido): secciones de fotos sucios/limpios + grid de existentes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 13: Página de andén — subir por categoría, mostrar existentes, validar obligatorias

**Files:**
- Modify: `src/app/register/route/anden/[slot]/page.tsx`

- [ ] **Step 1: Actualizar `EMPTY_FORM` y el estado de existentes**

In `src/app/register/route/anden/[slot]/page.tsx`:

(a) Reemplazar `EMPTY_FORM`:

```ts
const EMPTY_FORM: RouteFormState = {
  companyId: '',
  dirtyReceivedIds: [],
  cleanDeliveredIds: [],
  area: '',
  dirtyPhotos: [],
  cleanPhotos: [],
}
```

(b) Reemplazar el estado `existingPhotoIds` por dos sets de fotos existentes con URL:

```ts
const [existingDirty, setExistingDirty] = useState<{ id: string; url: string }[]>([])
const [existingClean, setExistingClean] = useState<{ id: string; url: string }[]>([])
```

(c) En `resetForm`, reemplazar `setExistingPhotoIds([])` por:

```ts
    setExistingDirty([])
    setExistingClean([])
```

- [ ] **Step 2: `handleSelectAnden` carga las fotos existentes por categoría**

Necesitamos `photos` del store para resolver URLs. Asegurar que `photos` está en el destructuring de `useStore()` (ya lo está vía `addPhoto`; agregar `photos`). Reemplazar `handleSelectAnden`:

```ts
function handleSelectAnden(id: string) {
  const ev = routeEvents.find((r) => r.id === id)
  if (!ev) return
  const toPhoto = (pid: string) => {
    const p = photos.find((ph) => ph.id === pid)
    return p ? { id: p.id, url: p.url } : null
  }
  setFormState({
    companyId: ev.company_id ?? '',
    dirtyReceivedIds: ev.containers_dirty_received,
    cleanDeliveredIds: ev.containers_clean_delivered,
    area: ev.area,
    dirtyPhotos: [],
    cleanPhotos: [],
  })
  setExistingDirty((ev.dirty_photo_ids ?? []).map(toPhoto).filter((x): x is { id: string; url: string } => x !== null))
  setExistingClean((ev.clean_photo_ids ?? []).map(toPhoto).filter((x): x is { id: string; url: string } => x !== null))
  setEditingAndenId(id)
  setDrawerOpen(false)
}
```

- [ ] **Step 3: Subir fotos por rol en crear/actualizar**

En `handleCreateAnden`, reemplazar el bloque "3) Subir fotos AHORA" por dos subidas con rol:

```ts
    // 3) Subir fotos AHORA por categoría (evita pérdida al editar luego)
    let dirtyIds: string[] = []
    let cleanIds: string[] = []
    try {
      const upDirty = await uploadEventPhotos(supabase, {
        dataUrls: formState.dirtyPhotos, eventType: 'route', eventId: routeEventId,
        label: buildLabel(), uploadedBy: currentProfileId, takenAt: now, role: 'dirty',
      })
      const upClean = await uploadEventPhotos(supabase, {
        dataUrls: formState.cleanPhotos, eventType: 'route', eventId: routeEventId,
        label: buildLabel(), uploadedBy: currentProfileId, takenAt: now, role: 'clean',
      })
      ;[...upDirty, ...upClean].forEach(addPhoto)
      dirtyIds = upDirty.map((p) => p.id)
      cleanIds = upClean.map((p) => p.id)
    } catch (err) {
      console.error('[recorrido andén] subir fotos falló:', err)
      alert('El andén se guardó, pero algunas fotos no se subieron por la conexión.')
    }
```

Y en el `addRouteEvent({...})` de ese handler, reemplazar `photo_ids: photoIds` por:

```ts
      dirty_photo_ids: dirtyIds,
      clean_photo_ids: cleanIds,
      photo_ids: [...dirtyIds, ...cleanIds],
```

(y eliminar las líneas `floor`/`dock` que ya no existen; conservar `area: formState.area`.)

En `handleUpdateAnden`, reemplazar el bloque "2) Subir SOLO las fotos nuevas" + el `updateRouteEvent(...)` por:

```ts
    // 2) Subir fotos nuevas por categoría; conservar las existentes que quedaron.
    let newDirtyIds: string[] = []
    let newCleanIds: string[] = []
    try {
      const upDirty = await uploadEventPhotos(supabase, {
        dataUrls: formState.dirtyPhotos, eventType: 'route', eventId: id,
        label: buildLabel(), uploadedBy: currentProfileId, takenAt: now, role: 'dirty',
      })
      const upClean = await uploadEventPhotos(supabase, {
        dataUrls: formState.cleanPhotos, eventType: 'route', eventId: id,
        label: buildLabel(), uploadedBy: currentProfileId, takenAt: now, role: 'clean',
      })
      ;[...upDirty, ...upClean].forEach(addPhoto)
      newDirtyIds = upDirty.map((p) => p.id)
      newCleanIds = upClean.map((p) => p.id)
    } catch (err) {
      console.error('[recorrido andén] subir fotos nuevas falló:', err)
      alert('Los cambios se guardaron, pero algunas fotos nuevas no se subieron.')
    }

    const dirtyIds = [...existingDirty.map((p) => p.id), ...newDirtyIds]
    const cleanIds = [...existingClean.map((p) => p.id), ...newCleanIds]

    updateRouteEvent(id, {
      company_id: formState.companyId || null,
      containers_dirty_received: formState.dirtyReceivedIds,
      containers_clean_delivered: formState.cleanDeliveredIds,
      area: formState.area,
      dirty_photo_ids: dirtyIds,
      clean_photo_ids: cleanIds,
      photo_ids: [...dirtyIds, ...cleanIds],
    })
```

> Nota: con `mergePhotoIds` ya no necesario, quitar su import si queda sin uso. La preservación de fotos existentes se hace arrastrando `existingDirty`/`existingClean` (menos los que el operador quitó vía `onRemoveExisting*`).

- [ ] **Step 4: Conectar quitar-existentes y pasar props al form**

Agregar handlers:

```ts
function removeExistingDirty(id: string) {
  setExistingDirty((prev) => prev.filter((p) => p.id !== id))
}
function removeExistingClean(id: string) {
  setExistingClean((prev) => prev.filter((p) => p.id !== id))
}
```

En el `<RouteForm .../>`, agregar las props:

```tsx
        existingDirtyPhotos={existingDirty}
        existingCleanPhotos={existingClean}
        onRemoveExistingDirty={removeExistingDirty}
        onRemoveExistingClean={removeExistingClean}
```

- [ ] **Step 5: Validación obligatoria (sucios Y limpios)**

Reemplazar `canSaveAnden`:

```ts
  const hasDirtyPhoto = formState.dirtyPhotos.length > 0 || existingDirty.length > 0
  const hasCleanPhoto = formState.cleanPhotos.length > 0 || existingClean.length > 0
  const canSaveAnden =
    isRunning &&
    !!formState.companyId &&
    (formState.dirtyReceivedIds.length + formState.cleanDeliveredIds.length > 0) &&
    hasDirtyPhoto &&
    hasCleanPhoto
```

- [ ] **Step 6: Typecheck + build**

Run: `npm run build`
Expected: compila (anden ya alineado con el nuevo `RouteFormState`).

- [ ] **Step 7: Verificación manual**

Manual:
1. Iniciar recorrido. Sin foto de sucios → botón guardar deshabilitado. Agregar foto de sucios pero no de limpios → sigue deshabilitado. Con ambas → habilitado.
2. Guardar andén. En Supabase: `select role, count(*) from photos where event_type='route' group by role;` → filas `dirty` y `clean`.
3. Editar ese andén desde el drawer → se ven las fotos ya cargadas en cada sección. Quitar una existente y guardar → se refleja. Agregar una nueva → se suma sin borrar las conservadas.

- [ ] **Step 8: Commit**

```bash
git add src/app/register/route/anden/[slot]/page.tsx
git commit -m "feat(recorrido): fotos sucios/limpios obligatorias y visibles al editar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 14: Adaptar morgue al nuevo `RouteFormState`

**Files:**
- Modify: `src/app/register/route/morgue/page.tsx`

Morgue usa `RouteForm` (sin selector de empresa). Tras Task 8 ya no tiene `floor`/`dock`,
pero sigue usando `photos` (roto desde Task 12). Divergencia decidida: morgue **recoge
sucios**, así que exige al menos una foto de sucios; las fotos de limpios son opcionales
(morgue rara vez entrega limpios). Se sube cada categoría con su `role`.

- [ ] **Step 1: Alinear el `RouteFormState` inicial y los `setFormState`**

In `src/app/register/route/morgue/page.tsx`, reemplazar `photos: []` por
`dirtyPhotos: [], cleanPhotos: []` en los **tres** `setFormState`/estado inicial:
el `useState` inicial (~línea 38), el `setFormState` del `useEffect` (~línea 67), y el
`setFormState` de `handleCancel` (~línea 179).

- [ ] **Step 2: Subir fotos por rol en `handleFinish`**

Reemplazar el bloque "2. DESPUÉS las fotos" (la única llamada a `uploadEventPhotos` con
`dataUrls: formState.photos`) por dos subidas con rol:

```ts
    let dirtyIds: string[] = []
    let cleanIds: string[] = []
    try {
      const upDirty = await uploadEventPhotos(supabase, {
        dataUrls: formState.dirtyPhotos, eventType: 'route', eventId: routeEventId,
        label, uploadedBy: currentProfileId, takenAt: now, role: 'dirty',
      })
      const upClean = await uploadEventPhotos(supabase, {
        dataUrls: formState.cleanPhotos, eventType: 'route', eventId: routeEventId,
        label, uploadedBy: currentProfileId, takenAt: now, role: 'clean',
      })
      ;[...upDirty, ...upClean].forEach(addPhoto)
      dirtyIds = upDirty.map((p) => p.id)
      cleanIds = upClean.map((p) => p.id)
    } catch (err) {
      console.error('[recorrido morgue] subir fotos falló (recorrido ya cerrado):', err)
      alert('El recorrido se finalizó, pero algunas fotos no se subieron por la conexión.')
    }
```

Y en el `patch: Partial<RouteEvent>`, reemplazar `photo_ids: photoIds` por:

```ts
      dirty_photo_ids: dirtyIds,
      clean_photo_ids: cleanIds,
      photo_ids: [...dirtyIds, ...cleanIds],
```

- [ ] **Step 3: Ajustar `canFinish`**

Reemplazar:

```ts
  const canFinish = totalContainers > 0 && formState.photos.length > 0
```

por (morgue exige foto de sucios; limpios opcional — divergencia documentada):

```ts
  // Morgue recoge sucios: exige al menos una foto de sucios. Limpios opcional.
  const canFinish = totalContainers > 0 && formState.dirtyPhotos.length > 0
```

Y en el `body` del `ConfirmDialog` de finalizar, reemplazar `Fotos: ${formState.photos.length}.`
por `Fotos sucios: ${formState.dirtyPhotos.length}, limpios: ${formState.cleanPhotos.length}.`

- [ ] **Step 4: Typecheck + build**

Run: `npm run build`
Expected: compila sin referencias a `photos`/`floor`/`dock` viejas.

- [ ] **Step 5: Verificación manual**

Manual: registrar una morgue → guarda sin errores; las fotos se asocian al route event (verificar en `photos`).

- [ ] **Step 6: Commit**

```bash
git add src/app/register/route/morgue/page.tsx
git commit -m "feat(morgue): alinear con RouteFormState por categoría

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 15: Limpieza de duplicados existentes en la base (data, opcional)

**Files:** ninguno (operación de datos vía MCP `execute_sql`).

Los 2 andenes duplicados (`a9c4e57a` es copia de `6e30aef9`) ensucian reportes. Anular el duplicado.

- [ ] **Step 1: Confirmar el duplicado**

`execute_sql`:
```sql
select id, started_at, company_id from route_events
where date='2026-06-10' and slot='10:30' order by started_at;
```
Expected: ver los dos Airkem con ~2.6s de diferencia.

- [ ] **Step 2: Borrar el route_event duplicado y sus join rows**

> Confirmar con el usuario antes de ejecutar (borrado de datos). Borrar el más reciente de los dos idénticos (`a9c4e57a-1530-46cf-a970-13bcc6407e9e`):

```sql
delete from route_event_containers_dirty where route_event_id='a9c4e57a-1530-46cf-a970-13bcc6407e9e';
delete from route_event_containers_clean where route_event_id='a9c4e57a-1530-46cf-a970-13bcc6407e9e';
delete from route_events where id='a9c4e57a-1530-46cf-a970-13bcc6407e9e';
```

- [ ] **Step 3: Verificar**

`select count(*) from route_event_containers_dirty;` → 4 (antes 7).

---

# Cierre

### Task 16: Suite completa + documentación del vault

**Files:**
- Create: `vault/logs/2026-06-10-recorrido-fotos-persistencia-traza.md`
- Modify: `vault/decisions/2026-05-21-estado-envase-derivado.md`
- Modify: `vault/project/DataModel.md`
- Modify: `vault/_index.md`

- [ ] **Step 1: Suite + build verdes**

Run: `npm test`
Expected: PASS (todos).
Run: `npm run build`
Expected: compila sin errores ni referencias a `floor`/`dock`/`photos` viejas.

- [ ] **Step 2: Log del lote**

Create `vault/logs/2026-06-10-recorrido-fotos-persistencia-traza.md` documentando: causa raíz (hidratación/persistencia incompleta), los 5 grupos, las 3 migraciones (`photos.role`, `containers.created_by`, drop `floor`/`dock`), y el fix de doble-submit. Front-matter con título/tags/fecha.

- [ ] **Step 3: Actualizar el ADR de estado derivado**

In `vault/decisions/2026-05-21-estado-envase-derivado.md`, agregar nota (2026-06-10): se reafirma eventos como fuente de verdad; el **próximo paso de escala es la vista de Postgres** (modelo B), no la columna cacheada; y se documenta que el bug cross-device fue de persistencia/hidratación, no del modelo derivado.

- [ ] **Step 4: Actualizar DataModel + índice**

In `vault/project/DataModel.md`: agregar `containers.created_by`; `photos.role` (dirty/clean en recorrido); baja de `route_events.floor`/`dock`; nota de que `storage_events`/`container_locations` ahora se persisten; y que `client_locations`/`external_transfers` siguen sin cablear (no obsoletas: `external_transfers` espera la pantalla de traslado).
In `vault/_index.md`: agregar la línea de log y mover la fecha de última actualización.

- [ ] **Step 5: Commit**

```bash
git add vault/
git commit -m "docs(vault): log del lote fotos/persistencia/traza + ADR fase + DataModel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 6: Finalizar la rama**

Invocar la skill `superpowers:finishing-a-development-branch` para decidir merge/PR.

---

## Notas de verificación E2E final (manual, antes de cerrar)

1. **Cross-device tratamiento:** pesar en navegador A → ver candidato en navegador B sin tocar A.
2. **Kg/día:** tras tratar tachos, el donut "procesado" sube de forma consistente al refrescar en cualquier dispositivo.
3. **Fotos recorrido:** no se puede guardar andén sin una foto de sucios y una de limpios; al editar, las existentes se ven y se conservan.
4. **Doble-submit:** doble-tap en guardar andén crea un solo registro.
5. **Traza:** tacho nuevo guarda y muestra `created_by`.
6. **Schema:** `route_events` sin `floor`/`dock`; ubicación sigue guardándose en `area`.
