# Historial editable de recorridos y pesajes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir consultar el historial de recorridos y pesajes desde la app (pestaña dentro de cada pantalla de registro), editar campos y anular registros lógicamente (solo coordinador, con confirmación + motivo), y rediseñar los 4 estados del dashboard a un modelo de línea de tiempo.

**Architecture:** Patrón de capas existente — queries Supabase → acciones de store (write-through + refresco local) → componentes React. La anulación es lógica (`voided_at/by/reason`), espejando `container_receptions`. El estado del dashboard se deriva en cliente de los eventos (modelo de línea de tiempo: gana el último evento del tacho).

**Tech Stack:** Next.js (App Router) · React · Zustand (`src/lib/store.ts`) · Supabase (`@supabase/ssr`) · TypeScript · Jest (`npm run test:jest`) · Tailwind. Build: `npm run build`.

**Spec:** `docs/superpowers/specs/2026-06-17-historial-editable-recorridos-pesajes-design.md`

---

## Mapa de archivos

**Datos / lógica (testeable):**
- `src/lib/types.ts` — agregar `voided_*` a `RouteEvent` y `WeighingSession`.
- `src/lib/data/containers.ts` — `getRouteEventIdsForContainer`/`getRouteEventIdsAnyDirection` ignoran recorridos anulados; nuevos helpers de línea de tiempo de empresa ya existen.
- `src/lib/data/dashboard-metrics.ts` — nueva `computeCirculationBucket` (modelo de línea de tiempo) + reescritura de `computeCirculationBreakdown` (4 buckets nuevos).
- `src/lib/data/reports.ts` — excluir recorridos/recepciones anulados.
- `src/components/supabase-hydrator.tsx` — mapear `voided_*` en receptions, route events y sessions.

**Base de datos:**
- `supabase/migrations/20260617000000_soft_delete_route_events_weighing_sessions.sql` — columnas `voided_*`.
- `src/lib/supabase/database.types.ts` — columnas `voided_*` en `route_events` y `weighing_sessions`.

**Queries / store:**
- `src/lib/supabase/queries/route-events.ts` — `voidRouteEvent`; filtro `voided_at is null` en listados.
- `src/lib/supabase/queries/weighing.ts` — `voidWeighingSession`; filtros.
- `src/lib/store.ts` — acciones `voidRouteEvent`, `voidWeighingSession`.

**UI:**
- `src/components/ui/confirm-void-dialog.tsx` — extraer el diálogo de confirmación + motivo (hoy inline en pesaje) a componente reutilizable.
- `src/components/history/route-history.tsx` — lista + detalle editable de recorridos.
- `src/components/history/weighing-history.tsx` — lista de sesiones + recepciones editables.
- `src/app/register/route/page.tsx` — envolver con pestañas Registrar / Historial.
- `src/app/register/weighing/page.tsx` — envolver con pestañas Registrar / Historial.

**Vault:**
- `vault/logs/2026-06-17-historial-editable-y-rediseno-estados-dashboard.md` (log final).

---

## Task 1: Tipos — anulación lógica en RouteEvent y WeighingSession

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Agregar campos `voided_*` a `RouteEvent`**

En `src/lib/types.ts`, dentro de `interface RouteEvent`, justo antes del cierre `}` (después de `signature_photo_id?: string | null`), agregar:

```ts
  /** Anulación lógica del recorrido (historial editable). Si no es null, el
   *  recorrido se considera revertido: deja de contar en derivación de estado y
   *  reportes. Nunca se borra físicamente (trazabilidad). */
  voided_at?: string | null
  voided_by?: string | null
  void_reason?: string | null
```

- [ ] **Step 2: Agregar campos `voided_*` a `WeighingSession`**

Dentro de `interface WeighingSession`, antes del cierre `}` (después de `reception_ids: string[]`), agregar:

```ts
  /** Anulación lógica de la sesión de pesaje (historial editable). Anula en
   *  cascada sus recepciones. Nunca se borra físicamente (trazabilidad). */
  voided_at?: string | null
  voided_by?: string | null
  void_reason?: string | null
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (sin errores nuevos).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): anulación lógica en RouteEvent y WeighingSession"
```

---

## Task 2: Migración de base de datos + database.types

**Files:**
- Create: `supabase/migrations/20260617000000_soft_delete_route_events_weighing_sessions.sql`
- Modify: `src/lib/supabase/database.types.ts`

- [ ] **Step 1: Escribir la migración SQL**

Crear `supabase/migrations/20260617000000_soft_delete_route_events_weighing_sessions.sql`:

```sql
-- Historial editable (spec 2026-06-17): anulación lógica de recorridos y sesiones
-- de pesaje, espejando container_receptions. Nunca se borra físicamente.

alter table public.route_events
  add column if not exists voided_at   timestamptz,
  add column if not exists voided_by   uuid references public.profiles(id),
  add column if not exists void_reason text;

comment on column public.route_events.voided_at is
  'Si no es null, el recorrido fue anulado desde el historial. Deja de contar en derivación de estado y reportes. Nunca se borra físicamente (trazabilidad).';

alter table public.weighing_sessions
  add column if not exists voided_at   timestamptz,
  add column if not exists voided_by   uuid references public.profiles(id),
  add column if not exists void_reason text;

comment on column public.weighing_sessions.voided_at is
  'Si no es null, la sesión de pesaje fue anulada desde el historial (anula en cascada sus recepciones). Nunca se borra físicamente (trazabilidad).';

-- La vista de cola de pesaje debe ignorar recorridos anulados.
create or replace view public.v_containers_pending_weighing
with (security_invoker = true)
as
select c.*
from public.containers c
where c.status = 'active'
  and exists (
    select 1
    from public.route_event_containers_dirty d
    join public.route_events re on re.id = d.route_event_id
    where d.container_id = c.id and re.voided_at is null
  )
  and not exists (
    select 1 from public.container_receptions r
    where r.container_id = c.id and r.voided_at is null
  );

grant select on public.v_containers_pending_weighing to authenticated;
```

- [ ] **Step 2: Aplicar la migración a Supabase**

Aplicar vía el MCP de Supabase (`apply_migration` con name `soft_delete_route_events_weighing_sessions` y el SQL de arriba) o `supabase db push` si hay CLI local.
Expected: sin error; `route_events` y `weighing_sessions` ganan 3 columnas; la vista se recrea.

- [ ] **Step 3: Agregar columnas a `database.types.ts` — route_events**

En `src/lib/supabase/database.types.ts`, en el bloque `route_events:` (≈ línea 493), agregar `voided_at`, `voided_by`, `void_reason` a `Row`, `Insert` y `Update`. En `Row` (todas las claves), agregar después de `status`:

```ts
          voided_at: string | null
          voided_by: string | null
          void_reason: string | null
```

En `Insert` y en `Update`, agregar (ambas con `?`):

```ts
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
```

- [ ] **Step 4: Agregar columnas a `database.types.ts` — weighing_sessions**

En el bloque `weighing_sessions:` (≈ línea 658), repetir exactamente lo mismo: las tres líneas no-opcionales en `Row` (después de `status`) y las tres opcionales en `Insert` y `Update`.

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260617000000_soft_delete_route_events_weighing_sessions.sql src/lib/supabase/database.types.ts
git commit -m "feat(db): columnas voided_* en route_events y weighing_sessions"
```

---

## Task 3: Derivación de estado ignora recorridos anulados

**Files:**
- Modify: `src/lib/data/containers.ts`
- Test: `src/__tests__/lib/containers.test.ts`

- [ ] **Step 1: Escribir el test que falla**

En `src/__tests__/lib/containers.test.ts`, dentro del `describe('getRouteEventIdsForContainer', ...)`, agregar después del último `it(...)`:

```ts
  it('ignora recorridos anulados (voided_at)', () => {
    const events: RouteEvent[] = [
      { ...baseRoute, id: 'route-1', containers_dirty_received: ['I-001'], containers_clean_delivered: [] },
      { ...baseRoute, id: 'route-2', containers_dirty_received: ['I-001'], containers_clean_delivered: [], voided_at: '2026-05-18T00:00:00Z', voided_by: 'op', void_reason: 'error' },
    ]
    expect(getRouteEventIdsForContainer(events, 'I-001')).toEqual(['route-1'])
  })
```

Y dentro de `describe('getPendingWeighingContainerIds', ...)`, agregar:

```ts
  it('un recorrido anulado devuelve el tacho fuera de pendientes', () => {
    const containers = [c('001')]
    const voidedRoute = { ...routeWith('001'), voided_at: '2026-06-03T10:00:00Z' } as RouteEvent
    const result = getPendingWeighingContainerIds(containers, [voidedRoute], [])
    expect(result).toEqual([])
  })
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm run test:jest -- containers.test`
Expected: FAIL (los recorridos anulados todavía cuentan).

- [ ] **Step 3: Implementar el filtro en `getRouteEventIdsForContainer` y `getRouteEventIdsAnyDirection`**

En `src/lib/data/containers.ts`, en `getRouteEventIdsForContainer`, cambiar el `.filter`:

```ts
  return routeEvents
    .filter((r) => !r.voided_at && r.containers_dirty_received.includes(containerId))
    .map((r) => r.id)
```

En `getRouteEventIdsAnyDirection`, cambiar el `.filter`:

```ts
    .filter((r) =>
      !r.voided_at &&
      (r.containers_dirty_received.includes(containerId) ||
        r.containers_clean_delivered.includes(containerId)),
    )
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test:jest -- containers.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/containers.ts src/__tests__/lib/containers.test.ts
git commit -m "feat(derivación): ignorar recorridos anulados en fase y cola de pesaje"
```

---

## Task 4: Dashboard — modelo de línea de tiempo (4 buckets nuevos)

**Files:**
- Modify: `src/lib/data/dashboard-metrics.ts`
- Test: `src/__tests__/lib/dashboard-metrics.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

En `src/__tests__/lib/dashboard-metrics.test.ts`, agregar un bloque nuevo al final (importar lo necesario arriba si falta: `computeCirculationBucket` desde `@/lib/data/dashboard-metrics` y los tipos):

```ts
import { computeCirculationBucket } from '@/lib/data/dashboard-metrics'
import type { Container, RouteEvent, ContainerReception, TreatmentRun, ExternalTransfer } from '@/lib/types'

describe('computeCirculationBucket (línea de tiempo)', () => {
  const cont: Container = {
    id: '001', size_liters: 240, tare_weight_kg: 14, status: 'active',
    registered_at: '2026-01-01T00:00:00Z',
  }
  const route = (over: Partial<RouteEvent>): RouteEvent => ({
    id: 'r', client_id: 'cl', company_id: 'ion', kind: 'anden', slot: '06:30',
    date: '2026-06-10', started_at: '2026-06-10T06:30:00Z', ended_at: null,
    operator_id: 'op', status: 'completed',
    containers_dirty_received: [], containers_clean_delivered: [], area: '', photo_ids: [],
    ...over,
  })
  const rec = (over: Partial<ContainerReception>): ContainerReception => ({
    id: 'rec', container_id: '001', weighing_session_id: 's', arrived_at: '2026-06-11T09:00:00Z',
    gross_weight_kg: 40, operator_id: 'op', photo_ids: [], observations: '', ...over,
  })
  const base = { routeEvents: [] as RouteEvent[], receptions: [] as ContainerReception[], treatmentRuns: [] as TreatmentRun[], externalTransfers: [] as ExternalTransfer[] }

  it('sin eventos → en_planta (limpio en planta)', () => {
    expect(computeCirculationBucket(cont, base)).toBe('en_planta')
  })

  it('último evento = entregado limpio → en_cliente', () => {
    const routeEvents = [route({ id: 'r1', started_at: '2026-06-10T06:30:00Z', containers_clean_delivered: ['001'] })]
    expect(computeCirculationBucket(cont, { ...base, routeEvents })).toBe('en_cliente')
  })

  it('recogido sucio después de entregado limpio → pendiente_pesar', () => {
    const routeEvents = [
      route({ id: 'r1', started_at: '2026-06-10T06:30:00Z', containers_clean_delivered: ['001'] }),
      route({ id: 'r2', started_at: '2026-06-12T06:30:00Z', containers_dirty_received: ['001'] }),
    ]
    expect(computeCirculationBucket(cont, { ...base, routeEvents })).toBe('pendiente_pesar')
  })

  it('pesado (recepción vigente) → pendiente_tratar', () => {
    const routeEvents = [route({ id: 'r2', started_at: '2026-06-12T06:30:00Z', containers_dirty_received: ['001'] })]
    const receptions = [rec({ arrived_at: '2026-06-12T10:00:00Z' })]
    expect(computeCirculationBucket(cont, { ...base, routeEvents, receptions })).toBe('pendiente_tratar')
  })

  it('recepción anulada → vuelve a pendiente_pesar', () => {
    const routeEvents = [route({ id: 'r2', started_at: '2026-06-12T06:30:00Z', containers_dirty_received: ['001'] })]
    const receptions = [rec({ arrived_at: '2026-06-12T10:00:00Z', voided_at: '2026-06-12T11:00:00Z' })]
    expect(computeCirculationBucket(cont, { ...base, routeEvents, receptions })).toBe('pendiente_pesar')
  })

  it('tratamiento completado es el último evento → en_planta', () => {
    const routeEvents = [route({ id: 'r2', started_at: '2026-06-12T06:30:00Z', containers_dirty_received: ['001'] })]
    const receptions = [rec({ arrived_at: '2026-06-12T10:00:00Z' })]
    const treatmentRuns: TreatmentRun[] = [{ id: 't', container_id: '001', started_at: '2026-06-12T12:00:00Z', completed_at: '2026-06-12T12:00:00Z', operator_id: 'op' }]
    expect(computeCirculationBucket(cont, { ...base, routeEvents, receptions, treatmentRuns })).toBe('en_planta')
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm run test:jest -- dashboard-metrics.test`
Expected: FAIL ("computeCirculationBucket is not a function").

- [ ] **Step 3: Implementar `computeCirculationBucket` y reescribir el breakdown**

En `src/lib/data/dashboard-metrics.ts`, reemplazar el bloque de circulación (tipos `CirculationBucket`, `BUCKET_DEFINITIONS`, `computeCirculationBreakdown`) por:

```ts
export type CirculationBucket =
  | 'en_planta'        // limpio físicamente en planta (recién dado de alta o tratado), sin entregar
  | 'en_cliente'       // entregado limpio en recorrido, esperando recogida sucia
  | 'pendiente_pesar'  // recogido sucio, sin recepción vigente
  | 'pendiente_tratar' // pesado, esperando tratamiento

export interface CirculationBreakdown {
  total: number
  buckets: Array<{ key: CirculationBucket; label: string; count: number; color: string }>
}

const BUCKET_DEFINITIONS: Array<{ key: CirculationBucket; label: string; color: string }> = [
  { key: 'en_planta',        label: 'En planta',           color: '#94A3B8' }, // slate
  { key: 'en_cliente',       label: 'En cliente',          color: '#10B981' }, // emerald
  { key: 'pendiente_pesar',  label: 'Pendiente por pesar', color: '#F59E0B' }, // amber
  { key: 'pendiente_tratar', label: 'Pendiente por tratar', color: '#2A27E9' }, // accent
]

interface CirculationTimelineSlice {
  routeEvents: RouteEvent[]
  receptions: ContainerReception[]
  treatmentRuns: TreatmentRun[]
  externalTransfers: ExternalTransfer[]
}

/**
 * Clasifica un tacho en uno de los 4 buckets de circulación según su evento
 * VIGENTE más reciente (modelo de línea de tiempo). Recorridos y recepciones
 * anulados (voided_at) se ignoran. Spec 2026-06-17.
 */
export function computeCirculationBucket(
  container: Container,
  store: CirculationTimelineSlice,
): CirculationBucket {
  const t = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : -Infinity)

  let cleanDelivered = -Infinity
  let dirtyReceived = -Infinity
  for (const r of store.routeEvents) {
    if (r.voided_at) continue
    const ts = t(r.started_at)
    if (r.containers_clean_delivered.includes(container.id) && ts > cleanDelivered) cleanDelivered = ts
    if (r.containers_dirty_received.includes(container.id) && ts > dirtyReceived) dirtyReceived = ts
  }

  let reception = -Infinity
  for (const r of store.receptions) {
    if (r.voided_at) continue
    if (r.container_id !== container.id) continue
    const ts = t(r.arrived_at)
    if (ts > reception) reception = ts
  }

  let closed = -Infinity // tratamiento o traslado completado
  for (const tr of store.treatmentRuns) {
    if (tr.container_id === container.id && tr.completed_at) closed = Math.max(closed, t(tr.completed_at))
  }
  for (const tf of store.externalTransfers) {
    if (tf.container_id === container.id && tf.transferred_at) closed = Math.max(closed, t(tf.transferred_at))
  }

  const latest = Math.max(cleanDelivered, dirtyReceived, reception, closed)
  if (latest === -Infinity) return 'en_planta'
  if (latest === closed) return 'en_planta'
  if (latest === reception) return 'pendiente_tratar'
  if (latest === dirtyReceived) return 'pendiente_pesar'
  return 'en_cliente'
}

export function computeCirculationBreakdown(store: CirculationStoreSlice): CirculationBreakdown {
  const counts: Record<CirculationBucket, number> = {
    en_planta: 0, en_cliente: 0, pendiente_pesar: 0, pendiente_tratar: 0,
  }
  const activeContainers = store.containers.filter(
    (c) => c.status === 'active' && !c.is_yaris_container,
  )
  for (const container of activeContainers) {
    counts[computeCirculationBucket(container, store)] += 1
  }
  return {
    total: activeContainers.length,
    buckets: BUCKET_DEFINITIONS.map((def) => ({ ...def, count: counts[def.key] })),
  }
}
```

Nota: `CirculationStoreSlice` ya incluye `routeEvents`, `receptions`, `treatmentRuns`, `externalTransfers` (y `containers`), así que satisface `CirculationTimelineSlice`. Se puede eliminar el `import` de `computeContainerPhase`/`getRouteEventIdsForContainer` de este archivo si quedan sin uso (dejar `computeNetWeight`).

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm run test:jest -- dashboard-metrics.test`
Expected: PASS.

- [ ] **Step 5: Ajustar el orden de la leyenda del gráfico (si hiciera falta)**

`src/components/dashboard/circulation-pie-chart.tsx` itera `data.buckets` sin nombres hardcodeados, así que toma los nuevos labels/colores automáticamente. Verificar que no haya referencias literales a "Sin registro"/"en_transito" en ese archivo (no las hay). Sin cambios de código esperados.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/dashboard-metrics.ts src/__tests__/lib/dashboard-metrics.test.ts
git commit -m "feat(dashboard): 4 estados de circulación por línea de tiempo"
```

---

## Task 5: Hydrator mapea los campos `voided_*`

**Files:**
- Modify: `src/components/supabase-hydrator.tsx`
- Test: `src/__tests__/lib/map-route-events.test.ts`

- [ ] **Step 1: Escribir el test que falla**

En `src/__tests__/lib/map-route-events.test.ts`, agregar un `it` que verifique que `mapRouteEvents` propaga `voided_at`. Primero revisar cómo se construyen las filas en ese test (helper de fila `route_events`), y agregar:

```ts
  it('propaga voided_at/by/reason desde la fila', () => {
    const rows = [
      { ...baseRow, id: 're-v', voided_at: '2026-06-17T00:00:00Z', voided_by: 'op', void_reason: 'error' },
    ]
    const [mapped] = mapRouteEvents(rows, [], [])
    expect(mapped.voided_at).toBe('2026-06-17T00:00:00Z')
    expect(mapped.void_reason).toBe('error')
  })
```

(Usar el `baseRow` / fixture que ya exista en ese archivo; si la fila base se llama distinto, adaptar el nombre. Si `baseRow` no tiene los campos, TypeScript los aceptará como extra porque el Row ya los declara tras Task 2.)

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm run test:jest -- map-route-events.test`
Expected: FAIL (`mapped.voided_at` es `undefined`).

- [ ] **Step 3: Mapear `voided_*` en `mapRouteEvents`**

En `src/components/supabase-hydrator.tsx`, dentro de `mapRouteEvents`, en el objeto retornado por `events.map((e) => ({ ... }))`, agregar antes del cierre (después de `clean_photo_ids: []`):

```ts
    voided_at: e.voided_at ?? null,
    voided_by: e.voided_by ?? null,
    void_reason: e.void_reason ?? null,
```

- [ ] **Step 4: Mapear `voided_*` en `rowToReception`**

En `rowToReception`, agregar antes del cierre (después de `treat_immediately: r.treat_immediately,`):

```ts
    voided_at: r.voided_at ?? null,
    voided_by: r.voided_by ?? null,
    void_reason: r.void_reason ?? null,
```

(Corrige un hueco existente: hoy una recepción anulada perdía su `voided_at` tras rehidratar.)

- [ ] **Step 5: Mapear `voided_*` en weighingSessions**

En el `.map` que construye `weighingSessions: WeighingSession[]`, agregar antes del cierre (después de `reception_ids: ...`):

```ts
          voided_at: s.voided_at ?? null,
          voided_by: s.voided_by ?? null,
          void_reason: s.void_reason ?? null,
```

- [ ] **Step 6: Correr el test y typecheck**

Run: `npm run test:jest -- map-route-events.test`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/supabase-hydrator.tsx src/__tests__/lib/map-route-events.test.ts
git commit -m "fix(hydrator): propagar voided_* en recorridos, sesiones y recepciones"
```

---

## Task 6: Queries de anulación + filtros de listado

**Files:**
- Modify: `src/lib/supabase/queries/route-events.ts`
- Modify: `src/lib/supabase/queries/weighing.ts`

- [ ] **Step 1: `voidRouteEvent` en route-events.ts**

En `src/lib/supabase/queries/route-events.ts`, agregar después de `updateRouteEvent`:

```ts
export async function voidRouteEvent(
  db: DB,
  id: string,
  voidedBy: string,
  reason: string
): Promise<RouteEventRow> {
  return unwrap(
    await db
      .from('route_events')
      .update({ voided_at: new Date().toISOString(), voided_by: voidedBy, void_reason: reason })
      .eq('id', id)
      .select()
      .single()
  )
}
```

- [ ] **Step 2: `voidWeighingSession` en weighing.ts (cascada a recepciones)**

En `src/lib/supabase/queries/weighing.ts`, agregar después de `updateWeighingSession`:

```ts
/**
 * Anula lógicamente una sesión y, en cascada, sus recepciones vigentes. No borra
 * físicamente: conserva la trazabilidad. Los tachos de esas recepciones vuelven
 * a quedar pendientes por pesar.
 */
export async function voidWeighingSession(
  db: DB,
  id: string,
  voidedBy: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString()
  const patch = { voided_at: now, voided_by: voidedBy, void_reason: reason }
  const { error: recErr } = await db
    .from('container_receptions')
    .update(patch)
    .eq('weighing_session_id', id)
    .is('voided_at', null)
  if (recErr) throw new Error(recErr.message)
  const { error } = await db.from('weighing_sessions').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (los `update` con `voided_*` compilan gracias a los tipos de Task 2).

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/queries/route-events.ts src/lib/supabase/queries/weighing.ts
git commit -m "feat(queries): voidRouteEvent y voidWeighingSession (anulación lógica)"
```

---

## Task 7: Acciones de store de anulación

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Declarar las acciones en la interfaz**

En `src/lib/store.ts`, en `interface HospiwasteStore`, bajo `// Recorridos` agregar tras `deleteRouteEvent`:

```ts
  voidRouteEvent: (id: string, voidedBy: string, reason: string) => void
```

Y bajo `// Sesiones de pesaje y receptions`, tras `deleteWeighingSession`:

```ts
  voidWeighingSession: (id: string, voidedBy: string, reason: string) => void
```

- [ ] **Step 2: Implementar `voidRouteEvent`**

Tras la implementación de `deleteRouteEvent` (la que filtra fotos), agregar:

```ts
  voidRouteEvent: (id, voidedBy, reason) =>
    set((s) => ({
      routeEvents: s.routeEvents.map((r) =>
        r.id === id ? { ...r, voided_at: new Date().toISOString(), voided_by: voidedBy, void_reason: reason } : r
      ),
    })),
```

- [ ] **Step 3: Implementar `voidWeighingSession` (cascada local)**

Tras la implementación de `deleteWeighingSession`, agregar:

```ts
  voidWeighingSession: (id, voidedBy, reason) =>
    set((s) => {
      const now = new Date().toISOString()
      const session = s.weighingSessions.find((w) => w.id === id)
      const receptionIds = new Set(session?.reception_ids ?? [])
      return {
        weighingSessions: s.weighingSessions.map((w) =>
          w.id === id ? { ...w, voided_at: now, voided_by: voidedBy, void_reason: reason } : w
        ),
        receptions: s.receptions.map((r) =>
          receptionIds.has(r.id) && !r.voided_at
            ? { ...r, voided_at: now, voided_by: voidedBy, void_reason: reason }
            : r
        ),
      }
    }),
```

- [ ] **Step 4: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat(store): acciones voidRouteEvent y voidWeighingSession"
```

---

## Task 8: Reportes excluyen registros anulados

**Files:**
- Modify: `src/lib/data/reports.ts`
- Test: `src/__tests__/lib/reports.test.ts`

- [ ] **Step 1: Inspeccionar `reports.ts` y el test**

Leer `src/lib/data/reports.ts` y `src/__tests__/lib/reports.test.ts`. Identificar dónde se iteran `routeEvents` y `receptions` para armar el reporte fotográfico.

- [ ] **Step 2: Escribir el test que falla**

En `src/__tests__/lib/reports.test.ts`, agregar un caso que pase un `routeEvent` y una `reception` con `voided_at` set y verifique que NO aparecen en el reporte resultante. Usar los fixtures/builders ya presentes en el archivo; afirmar sobre la estructura que devuelva la función pública del reporte (p. ej. que el día no incluya ese recorrido/recepción anulado).

- [ ] **Step 3: Correr y verificar que falla**

Run: `npm run test:jest -- reports.test`
Expected: FAIL (el anulado aún aparece).

- [ ] **Step 4: Filtrar anulados en `reports.ts`**

En la(s) función(es) de armado del reporte, al comienzo del procesamiento, filtrar:

```ts
const routeEvents = allRouteEvents.filter((r) => !r.voided_at)
const receptions = allReceptions.filter((r) => !r.voided_at)
```

Aplicar el filtro a las colecciones de entrada antes de agrupar por día/ruta. Ajustar a los nombres reales de variables/parámetros del archivo.

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npm run test:jest -- reports.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/reports.ts src/__tests__/lib/reports.test.ts
git commit -m "feat(reportes): excluir recorridos y recepciones anulados"
```

---

## Task 9: Diálogo de confirmación + motivo reutilizable

**Files:**
- Create: `src/components/ui/confirm-void-dialog.tsx`
- Modify: `src/app/register/weighing/page.tsx`

- [ ] **Step 1: Crear el componente compartido**

Crear `src/components/ui/confirm-void-dialog.tsx` extrayendo el `ConfirmVoidDialog` que hoy vive inline en `src/app/register/weighing/page.tsx` (líneas ~699-753), generalizándolo con título/descripción/CTA por props:

```tsx
'use client'

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  title: string
  description: React.ReactNode
  confirmLabel: string
  onCancel: () => void
  onConfirm: (reason: string) => void
}

export function ConfirmVoidDialog({ title, description, confirmLabel, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-card rounded-xl ring-1 ring-red-200 p-6 max-w-sm w-full space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="void-reason" className="text-sm font-medium text-foreground">
            Motivo <span className="text-red-600">*</span>
          </label>
          <textarea
            id="void-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Ej.: peso mal tecleado, tacho equivocado…"
            className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400/40"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            onClick={() => onConfirm(trimmed)}
            disabled={trimmed.length === 0}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Reusar el componente en pesaje**

En `src/app/register/weighing/page.tsx`: borrar la función local `ConfirmVoidDialog` (y su interface `VoidDialogProps`), importar el nuevo componente:

```tsx
import { ConfirmVoidDialog } from '@/components/ui/confirm-void-dialog'
```

y cambiar el uso en el JSX a:

```tsx
{confirmingVoid && (
  <ConfirmVoidDialog
    title="¿Deshacer el pesaje?"
    description={<>El tacho <strong className="font-mono">{formState.container_id}</strong> volverá a quedar disponible para pesar. El registro no se borra: queda anulado con motivo para trazabilidad.</>}
    confirmLabel="Deshacer pesaje"
    onCancel={() => setConfirmingVoid(false)}
    onConfirm={async (reason) => { setConfirmingVoid(false); await handleVoidEditing(reason) }}
  />
)}
```

- [ ] **Step 3: Verificar typecheck + suite**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run test:jest`
Expected: PASS (sin regresiones).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/confirm-void-dialog.tsx src/app/register/weighing/page.tsx
git commit -m "refactor(ui): ConfirmVoidDialog reutilizable (confirmación + motivo)"
```

---

## Task 10: Historial de recorridos (componente + pestaña)

**Files:**
- Create: `src/components/history/route-history.tsx`
- Modify: `src/app/register/route/page.tsx`

- [ ] **Step 1: Crear `route-history.tsx`**

Crear `src/components/history/route-history.tsx`. Lista los recorridos por fecha descendente, con detalle expandible. Edición (empresa, área, tachos limpios/sucios) y anulación solo si `currentRole === 'coordinator'`. Reutiliza `ContainerPickerSheet` y `ConfirmVoidDialog`.

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Pencil, Ban, Check, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { ConfirmVoidDialog } from '@/components/ui/confirm-void-dialog'
import { ContainerPickerSheet, type PickerVariant } from '@/components/register/container-picker-sheet'
import { formatTachoNumber } from '@/lib/data/containers'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import type { RouteEvent } from '@/lib/types'

export function RouteHistory() {
  const {
    routeEvents, companies, containers, currentProfileId, currentRole,
    updateRouteEvent, voidRouteEvent,
  } = useStore()
  const isCoordinator = currentRole === 'coordinator'

  const [editingId, setEditingId] = useState<string | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [picker, setPicker] = useState<{ id: string; variant: PickerVariant } | null>(null)

  const sorted = useMemo(
    () => [...routeEvents].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [routeEvents],
  )

  async function saveCompany(ev: RouteEvent, companyId: string | null) {
    try {
      await q.updateRouteEvent(createClient(), ev.id, { company_id: companyId })
    } catch (err) { console.error('[historial recorrido] empresa falló:', err); return }
    updateRouteEvent(ev.id, { company_id: companyId })
  }

  async function saveArea(ev: RouteEvent, area: string) {
    try {
      await q.updateRouteEvent(createClient(), ev.id, { area })
    } catch (err) { console.error('[historial recorrido] área falló:', err); return }
    updateRouteEvent(ev.id, { area })
  }

  async function saveContainers(ev: RouteEvent, variant: PickerVariant, ids: string[]) {
    const db = createClient()
    try {
      if (variant === 'dirty') await q.setRouteContainersDirty(db, ev.id, ids)
      else await q.setRouteContainersClean(db, ev.id, ids)
    } catch (err) { console.error('[historial recorrido] tachos falló:', err); return }
    updateRouteEvent(ev.id, variant === 'dirty'
      ? { containers_dirty_received: ids }
      : { containers_clean_delivered: ids })
  }

  async function doVoid(ev: RouteEvent, reason: string) {
    if (!currentProfileId) return
    try {
      await q.voidRouteEvent(createClient(), ev.id, currentProfileId, reason)
    } catch (err) { console.error('[historial recorrido] anular falló:', err); return }
    voidRouteEvent(ev.id, currentProfileId, reason)
    setVoidingId(null)
    setEditingId(null)
  }

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Sin recorridos registrados.</p>
  }

  return (
    <div className="space-y-3">
      {sorted.map((ev) => {
        const companyName = companies.find((c) => c.id === ev.company_id)?.name ?? '—'
        const isEditing = editingId === ev.id && isCoordinator
        return (
          <div key={ev.id} className={ev.voided_at ? 'rounded-lg border border-border bg-muted/40 p-4 opacity-70' : 'rounded-lg border border-border bg-card p-4'}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {ev.date} · {ev.kind === 'morgue' ? 'Morgue' : ev.slot} · {companyName}
                  {ev.voided_at && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">ANULADO</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sucios: {ev.containers_dirty_received.map(formatTachoNumber).join(', ') || '—'} · Limpios: {ev.containers_clean_delivered.map(formatTachoNumber).join(', ') || '—'}
                </p>
                {ev.area && <p className="text-xs text-muted-foreground">Área: {ev.area}</p>}
              </div>
              {isCoordinator && !ev.voided_at && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditingId(isEditing ? null : ev.id)}>
                    {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Anular" className="text-red-600" onClick={() => setVoidingId(ev.id)}>
                    <Ban className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {isEditing && (
              <div className="mt-4 space-y-3 border-t border-border pt-3">
                <label className="block text-xs font-medium text-foreground">
                  Empresa
                  <select
                    defaultValue={ev.company_id ?? ''}
                    onChange={(e) => saveCompany(ev, e.target.value || null)}
                    className="mt-1 block w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-medium text-foreground">
                  Área
                  <input
                    defaultValue={ev.area}
                    onBlur={(e) => { if (e.target.value !== ev.area) saveArea(ev, e.target.value) }}
                    className="mt-1 block w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPicker({ id: ev.id, variant: 'dirty' })}>Editar sucios</Button>
                  <Button variant="outline" size="sm" onClick={() => setPicker({ id: ev.id, variant: 'clean' })}>Editar limpios</Button>
                </div>
                <p className="flex items-center gap-1 text-xs text-emerald-700"><Check className="h-3 w-3" /> Los cambios se guardan al instante.</p>
              </div>
            )}
          </div>
        )
      })}

      {picker && (() => {
        const ev = routeEvents.find((r) => r.id === picker.id)
        if (!ev) return null
        const selected = picker.variant === 'dirty' ? ev.containers_dirty_received : ev.containers_clean_delivered
        const otherSide = picker.variant === 'dirty' ? ev.containers_clean_delivered : ev.containers_dirty_received
        const otherSet = new Set(otherSide)
        return (
          <ContainerPickerSheet
            open
            variant={picker.variant}
            containers={containers.filter((c) => !otherSet.has(c.id))}
            selectedIds={selected}
            onClose={() => setPicker(null)}
            onConfirm={(ids) => saveContainers(ev, picker.variant, ids)}
          />
        )
      })()}

      {voidingId && (() => {
        const ev = routeEvents.find((r) => r.id === voidingId)
        if (!ev) return null
        return (
          <ConfirmVoidDialog
            title="¿Anular este recorrido?"
            description={<>El recorrido del <strong>{ev.date} · {ev.kind === 'morgue' ? 'Morgue' : ev.slot}</strong> dejará de contar en el estado de los tachos y en los reportes. No se borra: queda anulado con motivo.</>}
            confirmLabel="Anular recorrido"
            onCancel={() => setVoidingId(null)}
            onConfirm={(reason) => doVoid(ev, reason)}
          />
        )
      })()}
    </div>
  )
}
```

- [ ] **Step 2: Integrar pestañas en `/register/route`**

En `src/app/register/route/page.tsx`, importar arriba:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RouteHistory } from '@/components/history/route-history'
```

Localizar el JSX raíz que devuelve la página (el contenedor del formulario de recorrido). Envolver su contenido en pestañas: el contenido actual va dentro de `<TabsContent value="registrar">…</TabsContent>` y se agrega `<TabsContent value="historial"><RouteHistory /></TabsContent>`. Ejemplo de estructura:

```tsx
<Tabs defaultValue="registrar" className="max-w-2xl mx-auto">
  <TabsList>
    <TabsTrigger value="registrar">Registrar</TabsTrigger>
    <TabsTrigger value="historial">Historial</TabsTrigger>
  </TabsList>
  <TabsContent value="registrar">
    {/* …todo el contenido de recorrido que ya existía… */}
  </TabsContent>
  <TabsContent value="historial">
    <RouteHistory />
  </TabsContent>
</Tabs>
```

Mantener intactos los handlers/estado del formulario; solo se re-anida el JSX existente dentro de `TabsContent value="registrar"`.

- [ ] **Step 3: Verificar typecheck + build**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add src/components/history/route-history.tsx src/app/register/route/page.tsx
git commit -m "feat(historial): pestaña Historial de recorridos (editar + anular)"
```

---

## Task 11: Historial de pesajes (componente + pestaña)

**Files:**
- Create: `src/components/history/weighing-history.tsx`
- Modify: `src/app/register/weighing/page.tsx`

- [ ] **Step 1: Crear `weighing-history.tsx`**

Crear `src/components/history/weighing-history.tsx`. Lista sesiones por fecha desc; al abrir una, lista sus recepciones con edición (peso bruto, tipo de desecho, tacho) y anulación por recepción, más "Anular sesión". Solo coordinador edita/anula.

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Pencil, Ban, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { ConfirmVoidDialog } from '@/components/ui/confirm-void-dialog'
import { formatTachoNumber, computeNetWeight } from '@/lib/data/containers'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import type { ContainerReception, WasteType } from '@/lib/types'

const WASTE_TYPES: { value: WasteType; label: string }[] = [
  { value: 'infectious', label: 'Infeccioso' },
  { value: 'anatomopathological', label: 'Anatomopatológico' },
  { value: 'cytotoxic', label: 'Citotóxico' },
  { value: 'liquid', label: 'Líquidos' },
  { value: 'morgue', label: 'Morgue' },
  { value: 'metallic', label: 'Metálicos' },
]

export function WeighingHistory() {
  const {
    weighingSessions, receptions, containers, currentProfileId, currentRole,
    updateReception, voidWeighingSession,
  } = useStore()
  const isCoordinator = currentRole === 'coordinator'

  const [openId, setOpenId] = useState<string | null>(null)
  const [voiding, setVoiding] = useState<{ kind: 'reception' | 'session'; id: string } | null>(null)

  const sorted = useMemo(
    () => [...weighingSessions].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [weighingSessions],
  )

  async function saveField(rec: ContainerReception, patch: Partial<ContainerReception>) {
    try {
      await q.updateReception(createClient(), rec.id, patch)
    } catch (err) { console.error('[historial pesaje] editar falló:', err); return }
    updateReception(rec.id, patch)
  }

  async function voidReception(rec: ContainerReception, reason: string) {
    if (!currentProfileId) return
    try {
      await q.voidReception(createClient(), rec.id, currentProfileId, reason)
    } catch (err) { console.error('[historial pesaje] anular recepción falló:', err); return }
    updateReception(rec.id, { voided_at: new Date().toISOString(), voided_by: currentProfileId, void_reason: reason })
    setVoiding(null)
  }

  async function voidSession(sessionId: string, reason: string) {
    if (!currentProfileId) return
    try {
      await q.voidWeighingSession(createClient(), sessionId, currentProfileId, reason)
    } catch (err) { console.error('[historial pesaje] anular sesión falló:', err); return }
    voidWeighingSession(sessionId, currentProfileId, reason)
    setVoiding(null)
    setOpenId(null)
  }

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Sin sesiones de pesaje.</p>
  }

  return (
    <div className="space-y-3">
      {sorted.map((s) => {
        const recs = receptions.filter((r) => s.reception_ids.includes(r.id))
        const live = recs.filter((r) => !r.voided_at)
        const isOpen = openId === s.id
        return (
          <div key={s.id} className={s.voided_at ? 'rounded-lg border border-border bg-muted/40 p-4 opacity-70' : 'rounded-lg border border-border bg-card p-4'}>
            <button type="button" className="w-full text-left" onClick={() => setOpenId(isOpen ? null : s.id)}>
              <p className="text-sm font-semibold text-foreground">
                {s.date} · {live.length} tacho{live.length !== 1 ? 's' : ''}
                {s.voided_at && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">ANULADA</span>}
              </p>
            </button>

            {isOpen && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {recs.map((r) => {
                  const cont = containers.find((c) => c.id === r.container_id)
                  const net = cont ? computeNetWeight(r.gross_weight_kg, cont.tare_weight_kg) : null
                  return (
                    <div key={r.id} className={r.voided_at ? 'rounded-md bg-muted/40 p-2 text-xs opacity-60' : 'rounded-md bg-muted/20 p-2 text-xs'}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold">{formatTachoNumber(r.container_id)}</span>
                        <span className="tabular-nums">{r.gross_weight_kg} kg bruto{net !== null ? ` · ${net} kg neto` : ''}</span>
                        {isCoordinator && !r.voided_at && !s.voided_at && (
                          <Button variant="ghost" size="icon" aria-label="Anular pesaje" className="text-red-600" onClick={() => setVoiding({ kind: 'reception', id: r.id })}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      {isCoordinator && !r.voided_at && !s.voided_at && (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <input
                            type="number" step="0.01" defaultValue={r.gross_weight_kg}
                            aria-label="Peso bruto"
                            onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v !== r.gross_weight_kg) saveField(r, { gross_weight_kg: v }) }}
                            className="rounded border border-foreground/15 bg-background px-2 py-1"
                          />
                          <select
                            defaultValue={r.waste_type ?? 'infectious'} aria-label="Tipo de desecho"
                            onChange={(e) => saveField(r, { waste_type: e.target.value as WasteType })}
                            className="rounded border border-foreground/15 bg-background px-2 py-1"
                          >
                            {WASTE_TYPES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                          </select>
                          <select
                            defaultValue={r.container_id} aria-label="Tacho"
                            onChange={(e) => saveField(r, { container_id: e.target.value })}
                            className="rounded border border-foreground/15 bg-background px-2 py-1 font-mono"
                          >
                            {containers.filter((c) => c.status === 'active').map((c) => (
                              <option key={c.id} value={c.id}>{formatTachoNumber(c.id)}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
                {isCoordinator && !s.voided_at && (
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setVoiding({ kind: 'session', id: s.id })}>
                    <X className="mr-1 h-3.5 w-3.5" /> Anular sesión completa
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {voiding?.kind === 'reception' && (() => {
        const r = receptions.find((x) => x.id === voiding.id)
        if (!r) return null
        return (
          <ConfirmVoidDialog
            title="¿Anular este pesaje?"
            description={<>El tacho <strong className="font-mono">{formatTachoNumber(r.container_id)}</strong> volverá a quedar pendiente por pesar. El registro queda anulado con motivo.</>}
            confirmLabel="Anular pesaje"
            onCancel={() => setVoiding(null)}
            onConfirm={(reason) => voidReception(r, reason)}
          />
        )
      })()}

      {voiding?.kind === 'session' && (
        <ConfirmVoidDialog
          title="¿Anular la sesión completa?"
          description="Todas las recepciones vigentes de la sesión se anularán y esos tachos volverán a pendientes por pesar."
          confirmLabel="Anular sesión"
          onCancel={() => setVoiding(null)}
          onConfirm={(reason) => voidSession(voiding.id, reason)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Integrar pestañas en `/register/weighing`**

En `src/app/register/weighing/page.tsx`, importar:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { WeighingHistory } from '@/components/history/weighing-history'
```

Envolver el contenido del `return` (el `<div className="max-w-2xl mx-auto space-y-6 pb-20">…`) en `Tabs`: el contenido actual dentro de `<TabsContent value="registrar">` y agregar `<TabsContent value="historial"><WeighingHistory /></TabsContent>`:

```tsx
<Tabs defaultValue="registrar" className="max-w-2xl mx-auto">
  <TabsList>
    <TabsTrigger value="registrar">Registrar</TabsTrigger>
    <TabsTrigger value="historial">Historial</TabsTrigger>
  </TabsList>
  <TabsContent value="registrar">
    {/* …todo el contenido de pesaje que ya existía (header, banners, form, drawer, dialogs)… */}
  </TabsContent>
  <TabsContent value="historial">
    <WeighingHistory />
  </TabsContent>
</Tabs>
```

- [ ] **Step 3: Verificar typecheck + build + suite**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run test:jest`
Expected: PASS.
Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add src/components/history/weighing-history.tsx src/app/register/weighing/page.tsx
git commit -m "feat(historial): pestaña Historial de pesajes (editar + anular)"
```

---

## Task 12: Verificación final + log de vault

**Files:**
- Create: `vault/logs/2026-06-17-historial-editable-y-rediseno-estados-dashboard.md`
- Modify: `vault/_index.md`

- [ ] **Step 1: Suite completa + build**

Run: `npm run test:jest`
Expected: PASS (todos).
Run: `npm run build`
Expected: build OK.

- [ ] **Step 2: E2E manual (anotar resultados)**

Verificar en navegador, logueado como **coordinador** y como **operador**:
1. Pestaña "Historial" visible para ambos en Recorrido y Pesaje.
2. Operador: NO ve botones de editar/anular.
3. Coordinador: editar empresa/área/tachos de un recorrido se refleja al instante y tras recargar.
4. Coordinador: anular un recorrido de recogida sucia → el tacho sale de "Pendiente por pesar" en el dashboard.
5. Coordinador: anular un pesaje → el tacho vuelve de "Pendiente por tratar" a "Pendiente por pesar".
6. Dashboard muestra los 4 estados nuevos con sus colores y el ciclo se observa correctamente.

- [ ] **Step 3: Escribir el log del vault**

Crear `vault/logs/2026-06-17-historial-editable-y-rediseno-estados-dashboard.md` con frontmatter (title, tags, fecha), resumiendo: anulación lógica de recorridos/sesiones (migración), historial editable por pestañas (solo coordinador edita/anula), y el rediseño de los 4 estados del dashboard por línea de tiempo (En planta / En cliente / Pendiente por pesar / Pendiente por tratar). Documentar el **porqué** (correcciones sin SQL; cierre del ciclo de estados), no la implementación obvia.

- [ ] **Step 4: Actualizar `vault/_index.md`**

Agregar fila en la tabla de estado y una entrada en "Logs de cambios" y "Notas del último procesamiento" apuntando al nuevo log. Marcar la sección como 🟢 Completado.

- [ ] **Step 5: Commit**

```bash
git add vault/
git commit -m "docs(vault): log historial editable + rediseño 4 estados dashboard"
```

---

## Notas de revisión (self-review)

- **Consistencia "Pendiente por pesar":** `computeCirculationBucket` clasifica como `pendiente_pesar` cuando el último evento es `dirty_received` sin recepción vigente posterior — la misma condición que `getPendingWeighingContainerIds`. Si se editan ambas, mantenerlas alineadas.
- **`treat_immediately`:** un pesaje con tratamiento inmediato genera un `treatment_run` completado en el mismo instante → el tacho queda `en_planta` (último evento = tratamiento completado), no `pendiente_tratar`. Esperado.
- **Cascada de anulación de sesión:** `voidWeighingSession` (query y store) anula también las recepciones; verificado en E2E paso 5.
- **Hueco corregido:** `rowToReception` ahora propaga `voided_at` (antes se perdía al rehidratar), necesario para que las anulaciones del historial sobrevivan recargas.
