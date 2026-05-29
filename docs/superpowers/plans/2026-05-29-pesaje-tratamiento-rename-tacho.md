# Pesaje + Tratamiento + Empresa/Tipo dinámicos + rename "tacho" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer la empresa y el tipo de desecho propiedades dinámicas del tacho (derivadas de recorrido/recepción), mostrar pendientes por número con bloqueo de finalización, agregar tratamiento inmediato, activar la página de tratamiento contra Supabase, y renombrar "envase → tacho" mostrando el número pelado.

**Architecture:** El estado del tacho ya se deriva de eventos (`computeContainerPhase`). Extendemos esa filosofía: la empresa actual se deriva del recorrido abierto (`getContainerCurrentCompanyId`) y el tipo de desecho se ingresa en pesaje y se guarda en la recepción. Tres columnas nuevas (`container_receptions.company_id/waste_type/treat_immediately`, `route_events.company_id`) y un backfill+drop de `containers.waste_type`. El id interno del tacho NO cambia; se muestra pelado vía `formatTachoNumber`.

**Tech Stack:** Next.js (App Router) + TypeScript, Zustand store hidratado desde Supabase (`@supabase/ssr`), Vitest, Postgres (Supabase) con migraciones SQL en `supabase/migrations/`.

**Spec:** `docs/superpowers/specs/2026-05-29-pesaje-tratamiento-rename-tacho-design.md`

**Orden crítico:** `containers.waste_type` se mantiene en TS hasta la Fase 7. La columna DB se dropea recién en la Fase 7 (tras backfill y tras que todos los lectores usen la recepción). Las migraciones se aplican en orden de timestamp.

---

## File Structure

**Migraciones nuevas (`supabase/migrations/`):**
- `20260529000000_reception_company_wastetype_treat.sql` — agrega `container_receptions.company_id`, `waste_type` (con backfill desde container), `treat_immediately`.
- `20260529010000_route_events_company_id.sql` — agrega `route_events.company_id`.
- `20260529020000_drop_containers_waste_type.sql` — dropea `containers.waste_type` (Fase 7, tras backfill).

**Tipos / lógica (`src/lib/`):**
- `types.ts` — `ContainerReception` (+3 campos), `RouteEvent` (+company_id), `Container` (−waste_type, Fase 7).
- `data/containers.ts` — `formatTachoNumber`, `getContainerCurrentCompanyId` (empresa heredada para pesaje), ajuste a `computeContainerPhase`.
- `data/reports.ts` — agrupar por empresa registrada (fallback histórico).
- `active-session.ts` — `WeighingSessionContext.skipped`.
- `supabase/queries/treatment.ts` (nuevo), `queries/index.ts`, `queries/route-events.ts`, `supabase/database.types.ts` (regenerado).
- `supabase-hydrator.tsx` — mapear campos nuevos de reception/route + `treatment_runs`; quitar `waste_type` de `rowToContainer` (Fase 7).

**UI (`src/`):**
- `components/register/weighing-form.tsx` — selector de tipo (input), check tratado inmediato, empresa heredada informativa, quitar selector cliente/yaris-tipo, mostrar número pelado.
- `app/register/weighing/page.tsx` — pendientes listados, bloqueo+escape, persistir campos nuevos, tratamiento inmediato en finish.
- `components/register/weighing-session-drawer.tsx` — número pelado.
- `app/register/treatment/page.tsx` — reescritura Supabase, multi-select, candidatos cold_storage infeccioso.
- `components/register/route-form.tsx` + `app/register/route/anden/[slot]/page.tsx` + `app/register/route/morgue/page.tsx` — selector de empresa.
- `components/admin/container-form.tsx`, `app/admin/containers/page.tsx` — quitar tipo de desecho, mostrar número pelado.
- `components/containers/*`, `app/containers/**`, `components/dashboard/*`, `app/register/transfer/*` — usar tipo de la recepción / número pelado.
- Rename masivo "envase → tacho" en strings.

**Tests (`src/__tests__/`):**
- `lib/containers.test.ts` (extender), `lib/reports.test.ts` (extender), `lib/format-tacho.test.ts` (nuevo).

---

## Fase 0 — Migraciones + tipos base

### Task 0.1: Migración receptions (company_id + waste_type backfill + treat_immediately)

**Files:**
- Create: `supabase/migrations/20260529000000_reception_company_wastetype_treat.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- ============================================================================
-- 2026-05-29: empresa y tipo de desecho dinámicos en la recepción de pesaje
--   - container_receptions.company_id  (snapshot de la empresa del recorrido)
--   - container_receptions.waste_type  (input del operador en pesaje; backfill
--     desde el waste_type histórico del tacho)
--   - container_receptions.treat_immediately (tratar al finalizar la sesión)
-- Ver: docs/superpowers/specs/2026-05-29-pesaje-tratamiento-rename-tacho-design.md
-- ============================================================================

alter table public.container_receptions
  add column company_id uuid null references public.companies(id);

alter table public.container_receptions
  add column waste_type waste_type not null default 'infectious';

-- Backfill: copiar el tipo real del tacho a sus recepciones existentes
update public.container_receptions r
  set waste_type = c.waste_type
  from public.containers c
  where r.container_id = c.id;

alter table public.container_receptions
  add column treat_immediately boolean not null default false;
```

> Nota: el enum se llama `waste_type` (ver `20260521*` / `database.types.ts`). Si el
> nombre real del tipo enum difiere, ajustarlo. No se dropea `containers.waste_type` acá.

- [ ] **Step 2: Aplicar la migración**

Run (CLI Supabase, o vía el MCP de Supabase): `supabase db push`
Expected: aplica sin error; `container_receptions` tiene las 3 columnas nuevas y las
recepciones históricas conservan su `waste_type`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260529000000_reception_company_wastetype_treat.sql
git commit -m "feat(db): receptions company_id + waste_type (backfill) + treat_immediately"
```

### Task 0.2: Migración route_events.company_id

**Files:**
- Create: `supabase/migrations/20260529010000_route_events_company_id.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 2026-05-29: empresa seleccionada en el recorrido (para reporte por institución)
alter table public.route_events
  add column company_id uuid null references public.companies(id);
```

- [ ] **Step 2: Aplicar**

Run: `supabase db push`
Expected: `route_events.company_id` existe (nullable).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260529010000_route_events_company_id.sql
git commit -m "feat(db): route_events.company_id"
```

### Task 0.3: Regenerar database.types.ts

**Files:**
- Modify: `src/lib/supabase/database.types.ts`

- [ ] **Step 1: Regenerar tipos**

Run: `supabase gen types typescript --linked > src/lib/supabase/database.types.ts`
(o el script equivalente del repo; ref del proyecto: `xqqnthyipkdkwyknbtnw`)
Expected: `container_receptions` Row/Insert/Update incluyen `company_id`, `waste_type`,
`treat_immediately`; `route_events` incluye `company_id`.

- [ ] **Step 2: Verificar compilación de tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (las columnas opcionales en Insert no rompen los inserts
existentes; los campos NOT NULL con default son opcionales en Insert).

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/database.types.ts
git commit -m "chore(db): regenerar database.types con campos nuevos"
```

### Task 0.4: Tipos del dominio — ContainerReception + RouteEvent

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Agregar campos a `ContainerReception`**

En `src/lib/types.ts`, dentro de `interface ContainerReception` (después de `observations`):

```typescript
  observations: string                  // texto libre del operador (e.g. "Yaris/Picanto sin tara"). Default ''.
  /** Empresa (ION/Airkem) a la que sirve este tacho en este ciclo. Snapshot
   *  derivado del recorrido abierto al momento de pesar. Null para histórico. */
  company_id: string | null
  /** Tipo de desecho ingresado por el operador en pesaje (dinámico, ya no es
   *  propiedad permanente del tacho). */
  waste_type: WasteType
  /** Si true, al finalizar la sesión el tacho se trata de inmediato (salta
   *  cámara fría) y queda disponible. Solo aplica a tipo infeccioso. */
  treat_immediately: boolean
```

- [ ] **Step 2: Agregar `company_id` a `RouteEvent`**

En `interface RouteEvent`, después de `client_id`:

```typescript
  client_id: string             // FK → Client (institución del recorrido)
  company_id: string | null     // FK → Company (empresa seleccionada: ION/Airkem)
```

- [ ] **Step 3: Verificar que TS marca los lugares a actualizar**

Run: `npx tsc --noEmit`
Expected: errores esperados en `supabase-hydrator.tsx` (rowToReception/mapRouteEvents no
setean los campos nuevos) y en `weighing/page.tsx` (addReception sin campos). Se resuelven
en fases siguientes. NO commitear aún si el árbol no compila; este task se cierra junto con
Task 2.1.

---

## Fase 1 — Helpers puros (TDD)

### Task 1.1: `formatTachoNumber`

**Files:**
- Modify: `src/lib/data/containers.ts`
- Test: `src/__tests__/lib/format-tacho.test.ts` (nuevo)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/__tests__/lib/format-tacho.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatTachoNumber } from '@/lib/data/containers'

describe('formatTachoNumber', () => {
  it('quita el prefijo letra-guion', () => {
    expect(formatTachoNumber('A-001')).toBe('001')
    expect(formatTachoNumber('I-010')).toBe('010')
  })
  it('deja intacto un id sin prefijo', () => {
    expect(formatTachoNumber('001')).toBe('001')
    expect(formatTachoNumber('123')).toBe('123')
  })
  it('tolera vacío', () => {
    expect(formatTachoNumber('')).toBe('')
  })
})
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npx vitest run src/__tests__/lib/format-tacho.test.ts`
Expected: FAIL — `formatTachoNumber is not a function`.

- [ ] **Step 3: Implementar**

Agregar al final de `src/lib/data/containers.ts`:

```typescript
/**
 * Display del número de tacho sin el prefijo de empresa (artefacto histórico de
 * importación). 'A-001' → '001'. Ids sin prefijo se devuelven igual.
 */
export function formatTachoNumber(id: string): string {
  return id.replace(/^[A-Za-z]+-/, '')
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `npx vitest run src/__tests__/lib/format-tacho.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/containers.ts src/__tests__/lib/format-tacho.test.ts
git commit -m "feat(tachos): formatTachoNumber para display sin prefijo"
```

### Task 1.2: `getContainerCurrentCompanyId` (empresa dinámica derivada)

**Files:**
- Modify: `src/lib/data/containers.ts`
- Test: `src/__tests__/lib/containers.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Agregar a `src/__tests__/lib/containers.test.ts` (imports al tope: `getContainerCurrentCompanyId`):

```typescript
import { getContainerCurrentCompanyId } from '@/lib/data/containers'
import type { RouteEvent, TreatmentRun } from '@/lib/types'

function route(partial: Partial<RouteEvent>): RouteEvent {
  return {
    id: 'r', client_id: 'cl', company_id: null, kind: 'anden', slot: '06:30',
    date: '2026-05-29', started_at: '2026-05-29T06:30:00Z', ended_at: null,
    operator_id: 'op', status: 'completed',
    containers_dirty_received: [], containers_clean_delivered: [],
    floor: '', area: '', dock: '', photo_ids: [],
    ...partial,
  }
}

describe('getContainerCurrentCompanyId', () => {
  it('devuelve la empresa del recorrido abierto que recogió el tacho', () => {
    const routes = [route({ id: 'r1', company_id: 'ion', started_at: '2026-05-29T06:00:00Z', containers_dirty_received: ['A-007'] })]
    expect(getContainerCurrentCompanyId('A-007', routes, [], [])).toBe('ion')
  })

  it('null si no hay recorrido que lo haya recogido', () => {
    expect(getContainerCurrentCompanyId('A-007', [], [], [])).toBeNull()
  })

  it('null tras tratamiento completado (ciclo cerrado)', () => {
    const routes = [route({ id: 'r1', company_id: 'ion', started_at: '2026-05-29T06:00:00Z', containers_dirty_received: ['A-007'] })]
    const treatments: TreatmentRun[] = [
      { id: 't1', container_id: 'A-007', started_at: '2026-05-29T10:00:00Z', completed_at: '2026-05-29T10:05:00Z', operator_id: 'op' },
    ]
    expect(getContainerCurrentCompanyId('A-007', routes, treatments, [])).toBeNull()
  })

  it('toma el recorrido más reciente posterior al último tratamiento (ION→Airkem)', () => {
    const routes = [
      route({ id: 'r1', company_id: 'ion', started_at: '2026-05-29T06:00:00Z', containers_dirty_received: ['A-007'] }),
      route({ id: 'r2', company_id: 'airkem', started_at: '2026-05-30T06:00:00Z', containers_dirty_received: ['A-007'] }),
    ]
    const treatments: TreatmentRun[] = [
      { id: 't1', container_id: 'A-007', started_at: '2026-05-29T10:00:00Z', completed_at: '2026-05-29T10:05:00Z', operator_id: 'op' },
    ]
    expect(getContainerCurrentCompanyId('A-007', routes, treatments, [])).toBe('airkem')
  })
})
```

- [ ] **Step 2: Correr (debe fallar)**

Run: `npx vitest run src/__tests__/lib/containers.test.ts`
Expected: FAIL — `getContainerCurrentCompanyId is not a function`.

- [ ] **Step 3: Implementar**

Agregar a `src/lib/data/containers.ts`:

```typescript
/**
 * Empresa actual (dinámica) del tacho = company_id del recorrido más reciente
 * que lo recogió sucio DENTRO del ciclo abierto (posterior al último
 * tratamiento/traslado completado del tacho). Null si no hay recorrido abierto.
 * Implementa la herencia de empresa en pesaje y el reset automático al tratar.
 */
export function getContainerCurrentCompanyId(
  containerId: string,
  routeEvents: RouteEvent[],
  treatmentRuns: TreatmentRun[],
  transfers: ExternalTransfer[],
): string | null {
  // Frontera del ciclo: último tratamiento/traslado COMPLETADO del tacho.
  const completions: number[] = [
    ...treatmentRuns
      .filter((t) => t.container_id === containerId && t.completed_at)
      .map((t) => new Date(t.completed_at as string).getTime()),
    ...transfers
      .filter((t) => t.container_id === containerId && t.transferred_at)
      .map((t) => new Date(t.transferred_at as string).getTime()),
  ]
  const boundary = completions.length ? Math.max(...completions) : -Infinity

  const open = routeEvents
    .filter(
      (r) =>
        r.containers_dirty_received.includes(containerId) &&
        new Date(r.started_at).getTime() > boundary,
    )
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

  return open[0]?.company_id ?? null
}
```

- [ ] **Step 4: Correr (debe pasar)**

Run: `npx vitest run src/__tests__/lib/containers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/containers.ts src/__tests__/lib/containers.test.ts
git commit -m "feat(tachos): getContainerCurrentCompanyId (empresa dinamica derivada)"
```

### Task 1.3: `computeContainerPhase` — tratamiento/traslado completado → clean sin storage

**Files:**
- Modify: `src/lib/data/containers.ts:38-53`
- Test: `src/__tests__/lib/containers.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Agregar a `src/__tests__/lib/containers.test.ts`:

```typescript
import { computeContainerPhase } from '@/lib/data/containers'

describe('computeContainerPhase — tratamiento inmediato', () => {
  const reception = {
    id: 'rec', container_id: 'A-007', weighing_session_id: 's', arrived_at: '2026-05-29T09:00:00Z',
    gross_weight_kg: 40, operator_id: 'op', photo_ids: [], observations: '',
    company_id: 'ion', waste_type: 'infectious' as const, treat_immediately: true,
  }
  it('tratamiento completado sin storage → clean', () => {
    const treatment = { id: 't', container_id: 'A-007', started_at: '2026-05-29T09:01:00Z', completed_at: '2026-05-29T09:01:00Z', operator_id: 'op' }
    expect(computeContainerPhase(['r1'], reception, null, treatment)).toBe('clean')
  })
  it('tratamiento en curso sin storage → treatment', () => {
    const treatment = { id: 't', container_id: 'A-007', started_at: '2026-05-29T09:01:00Z', completed_at: null, operator_id: 'op' }
    expect(computeContainerPhase(['r1'], reception, null, treatment)).toBe('treatment')
  })
})
```

- [ ] **Step 2: Correr (debe fallar)**

Run: `npx vitest run src/__tests__/lib/containers.test.ts -t "tratamiento inmediato"`
Expected: FAIL — hoy devuelve `'weighing'` (no hay storage).

- [ ] **Step 3: Implementar el reordenamiento**

Reemplazar el cuerpo de `computeContainerPhase` (líneas ~44-52) por:

```typescript
  if (!reception && routeEventIds.length === 0) return 'clean'
  if (!reception) return 'route'
  // Un tratamiento/traslado completado cierra el ciclo aunque no haya pasado por
  // cámara fría (caso "tratado inmediatamente"). Se evalúa antes que el storage.
  if (treatmentOrTransfer) {
    if ('completed_at' in treatmentOrTransfer) {
      if (treatmentOrTransfer.completed_at) return 'clean'
    } else if ((treatmentOrTransfer as ExternalTransfer).transferred_at) {
      return 'clean'
    }
  }
  if (!storage) return 'weighing'
  if (!storage.exit_at) return 'cold_storage'
  if (!treatmentOrTransfer) return 'cold_storage'
  if ('completed_at' in treatmentOrTransfer) {
    return treatmentOrTransfer.completed_at ? 'clean' : 'treatment'
  }
  return (treatmentOrTransfer as ExternalTransfer).transferred_at ? 'clean' : 'transfer'
```

- [ ] **Step 4: Correr toda la suite de containers (no romper casos existentes)**

Run: `npx vitest run src/__tests__/lib/containers.test.ts`
Expected: PASS (nuevos + existentes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/containers.ts src/__tests__/lib/containers.test.ts
git commit -m "feat(tachos): tratamiento/traslado completado da clean sin pasar por storage"
```

---

## Fase 2 — Wiring store / hydrator / queries

### Task 2.1: Hydrator — mapear campos nuevos de reception y route_event

**Files:**
- Modify: `src/components/supabase-hydrator.tsx:176-218`

- [ ] **Step 1: Actualizar `rowToReception`**

```typescript
function rowToReception(r: q.ReceptionRow): ContainerReception {
  return {
    id: r.id,
    container_id: r.container_id,
    weighing_session_id: r.weighing_session_id,
    arrived_at: r.arrived_at,
    gross_weight_kg: Number(r.gross_weight_kg),
    operator_id: r.operator_id,
    photo_ids: [],
    observations: r.observations,
    company_id: r.company_id ?? null,
    waste_type: r.waste_type,
    treat_immediately: r.treat_immediately,
  }
}
```

- [ ] **Step 2: Actualizar `mapRouteEvents` (agregar company_id)**

En el objeto que retorna `events.map(...)`, agregar después de `client_id: e.client_id,`:

```typescript
    company_id: e.company_id ?? null,
```

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: ya no hay errores en hydrator/types por los campos de reception/route. Pueden
quedar errores en `weighing/page.tsx` (addReception) y `mock-data.ts` — se resuelven luego.

- [ ] **Step 4: Commit (cierra Task 0.4 + 2.1)**

```bash
git add src/lib/types.ts src/components/supabase-hydrator.tsx
git commit -m "feat: tipos y hidratacion de company_id/waste_type/treat_immediately"
```

### Task 2.2: Query `createTreatmentRun` + hidratar treatment_runs

**Files:**
- Create: `src/lib/supabase/queries/treatment.ts`
- Modify: `src/lib/supabase/queries/index.ts`
- Modify: `src/components/supabase-hydrator.tsx`
- Modify: `src/lib/store.ts` (hydrate ya soporta `treatmentRuns` vía Partial; no requiere cambio de tipo)

- [ ] **Step 1: Crear `queries/treatment.ts`**

```typescript
import type { Tables, TablesInsert } from '../database.types'
import { unwrap, type DB } from './_helpers'

export type TreatmentRunRow = Tables<'treatment_runs'>

export async function listTreatmentRuns(db: DB): Promise<TreatmentRunRow[]> {
  return unwrap(await db.from('treatment_runs').select('*').order('started_at', { ascending: false }))
}

export async function createTreatmentRun(
  db: DB,
  input: TablesInsert<'treatment_runs'>,
): Promise<TreatmentRunRow> {
  return unwrap(await db.from('treatment_runs').insert(input).select().single())
}
```

> Verificar el nombre real de la tabla en `database.types.ts` (`treatment_runs`). Ajustar si
> difiere. Si la tabla no expone `completed_at`/`started_at`/`container_id`/`operator_id`,
> alinear con el esquema real del bootstrap.

- [ ] **Step 2: Exportar desde el índice**

En `src/lib/supabase/queries/index.ts`, agregar:

```typescript
export * from './treatment'
```

- [ ] **Step 3: Hidratar treatment_runs en el hydrator**

En `supabase-hydrator.tsx`, dentro del `Promise.all`, agregar `q.listTreatmentRuns(supabase)` y
mapear el resultado a `TreatmentRun[]` (campos directos) y pasarlo en `hydrate({ ..., treatmentRuns })`.
Código del map:

```typescript
const treatmentRuns = treatmentRunsRaw.map((t) => ({
  id: t.id,
  container_id: t.container_id,
  started_at: t.started_at,
  completed_at: t.completed_at,
  operator_id: t.operator_id,
}))
```

(añadir `treatmentRunsRaw` al destructuring del `Promise.all` y `treatmentRuns` al `hydrate`).

- [ ] **Step 4: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries/treatment.ts src/lib/supabase/queries/index.ts src/components/supabase-hydrator.tsx
git commit -m "feat(supabase): query createTreatmentRun + hidratar treatment_runs"
```

---

## Fase 3 — Pesaje (F1, F2, F3, F4)

### Task 3.1: `WeighingFormState` — tipo de desecho (input), tratado inmediato; quitar yaris-tipo derivado

**Files:**
- Modify: `src/components/register/weighing-form.tsx`

- [ ] **Step 1: Extender el estado del formulario**

En `WeighingFormState` agregar y en `EMPTY_WEIGHING_FORM` inicializar:

```typescript
export interface WeighingFormState {
  container_id: string
  photo_container: string | null
  photo_scale: string | null
  gross_weight: string
  observations: string
  is_yaris_weighing: boolean
  waste_type: WasteType        // input del operador (default infeccioso)
  treat_immediately: boolean   // tratar al finalizar la sesión
}

export const EMPTY_WEIGHING_FORM: WeighingFormState = {
  container_id: '',
  photo_container: null,
  photo_scale: null,
  gross_weight: '',
  observations: '',
  is_yaris_weighing: false,
  waste_type: 'infectious',
  treat_immediately: false,
}
```

- [ ] **Step 2: Reemplazar el badge "Tipo: …" derivado por un selector**

Reemplazar el bloque `{selectedContainer && (...badges...)}` (líneas ~190-207): quitar el badge
de Tipo derivado y dejar Tara/Tamaño/Yaris. Agregar, antes del bloque de Peso bruto, un selector
de tipo de desecho y, debajo, la empresa heredada informativa (prop nueva `inheritedCompanyName`):

```tsx
{/* Tipo de desecho — input del operador (ya no es propiedad del tacho) */}
<div className="space-y-1.5">
  <label className="text-sm font-medium text-foreground">
    Tipo de desecho <span className="text-red-500">*</span>
  </label>
  <Select value={state.waste_type} onValueChange={(v) => onChange({ waste_type: (v ?? 'infectious') as WasteType })}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      {(Object.keys(WASTE_LABELS) as WasteType[]).map((w) => (
        <SelectItem key={w} value={w}>{WASTE_LABELS[w]}</SelectItem>
      ))}
    </SelectContent>
  </Select>
  {inheritedCompanyName && (
    <p className="text-xs text-muted-foreground">Empresa del tacho: <strong>{inheritedCompanyName}</strong></p>
  )}
</div>
```

- [ ] **Step 3: Agregar el check "Tratar inmediatamente"**

Después del bloque de Observaciones, agregar (visible solo si `waste_type === 'infectious'`):

```tsx
{state.waste_type === 'infectious' && (
  <button
    type="button"
    onClick={() => onChange({ treat_immediately: !state.treat_immediately })}
    aria-pressed={state.treat_immediately}
    className={cn(
      'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
      state.treat_immediately ? 'border-accent/40 bg-accent/5' : 'border-border bg-card hover:bg-muted/40',
    )}
  >
    {state.treat_immediately ? <CheckSquare className="h-5 w-5 shrink-0 text-accent" /> : <Square className="h-5 w-5 shrink-0 text-muted-foreground" />}
    <div className="flex-1">
      <p className="text-sm font-semibold text-foreground">Tratar inmediatamente</p>
      <p className="text-xs text-muted-foreground">Al finalizar el pesaje, este tacho salta cámara fría y queda disponible.</p>
    </div>
  </button>
)}
```

- [ ] **Step 4: Agregar la prop `inheritedCompanyName` y mostrar número pelado en los selects**

En `interface Props` agregar `inheritedCompanyName?: string | null`. En la firma del componente
agregar el parámetro. En los `<SelectItem>` de tachos, reemplazar `{c.id}` por
`{formatTachoNumber(c.id)}` (importar `formatTachoNumber` de `@/lib/data/containers`).
Quitar el `· {companyMap[c.company_id]}` (la empresa ya no es permanente del tacho).

- [ ] **Step 5: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: errores esperados en `weighing/page.tsx` (no pasa la prop nueva / no usa los campos);
se resuelven en Task 3.2.

- [ ] **Step 6: Commit (junto con 3.2)** — no commitear hasta que el árbol compile.

### Task 3.2: `weighing/page.tsx` — persistir campos nuevos + empresa heredada + pendientes + bloqueo/escape + tratamiento inmediato

**Files:**
- Modify: `src/app/register/weighing/page.tsx`
- Modify: `src/lib/active-session.ts`

- [ ] **Step 1: `WeighingSessionContext.skipped` en active-session**

En `src/lib/active-session.ts`, dentro de `interface WeighingSessionContext`:

```typescript
export interface WeighingSessionContext {
  type: 'weighing'
  client_id: string
  date: string
  operator_id: string
  weighing_session_id: string
  /** Tachos marcados como ausentes en esta sesión (permiten finalizar; siguen
   *  en la cola para la próxima sesión). Transitorio, no se persiste en BD. */
  skipped?: { container_id: string; note: string }[]
}
```

- [ ] **Step 2: Derivar empresa heredada y pasar campos a createReception**

En `weighing/page.tsx`:
- Importar `getContainerCurrentCompanyId` de `@/lib/data/containers` y `treatmentRuns`,
  `externalTransfers`, `companies`, `addTreatmentRun` del store.
- Calcular la empresa heredada del tacho seleccionado:

```typescript
const inheritedCompanyId = formState.container_id
  ? getContainerCurrentCompanyId(formState.container_id, routeEvents, treatmentRuns, externalTransfers)
  : null
const inheritedCompanyName = inheritedCompanyId
  ? companies.find((c) => c.id === inheritedCompanyId)?.name ?? null
  : null
```

- En `handleCreateReception`, pasar a `q.createReception` y a `addReception` los campos nuevos:

```typescript
const row = await q.createReception(supabase, {
  container_id: formState.container_id,
  weighing_session_id: currentSessionId,
  arrived_at: now,
  gross_weight_kg: gross,
  operator_id: currentProfileId,
  observations: formState.observations,
  company_id: inheritedCompanyId,
  waste_type: formState.waste_type,
  treat_immediately: formState.treat_immediately,
})
```

y en el `addReception({...})` agregar `company_id: inheritedCompanyId, waste_type: formState.waste_type, treat_immediately: formState.treat_immediately`.

- En `handleSaveEdit`, agregar a `q.updateReception` y `updateReception` los campos
  `waste_type: formState.waste_type, treat_immediately: formState.treat_immediately`
  (company_id no se re-deriva en edición; se mantiene).

- En `handleSelectForEdit`, cargar `waste_type: r.waste_type, treat_immediately: r.treat_immediately`
  en el `setFormState`.

- Pasar `inheritedCompanyName={inheritedCompanyName}` al `<WeighingForm>`.

- [ ] **Step 3: Pendientes listados + bloqueo + escape (F1, F2)**

- Calcular pendientes y ausentes:

```typescript
const skipped = activeSession?.context.type === 'weighing' ? (activeSession.context.skipped ?? []) : []
const skippedIds = new Set(skipped.map((s) => s.container_id))
const pendingList = availableContainers
  .map((c) => c.id)
  .filter((id) => !sessionReceptions.some((r) => r.container_id === id))
const pendingNotSkipped = pendingList.filter((id) => !skippedIds.has(id))
```

> Nota: `availableContainers` ya excluye tachos con reception. `pendingList` se mantiene
> como la cola visible; el bloqueo usa `pendingNotSkipped`.

- En el banner de sesión en curso, bajo el contador, renderizar:

```tsx
{pendingList.length > 0 && (
  <p className="text-xs text-muted-foreground mt-2">
    Pendientes por pesar ({pendingNotSkipped.length}):{' '}
    {pendingList.map((id) => (
      <span key={id} className={cn('font-mono', skippedIds.has(id) && 'line-through opacity-60')}>
        {formatTachoNumber(id)}{' '}
        {!skippedIds.has(id) && (
          <button type="button" onClick={() => markAbsent(id)} className="text-[10px] underline">ausente</button>
        )}
      </span>
    ))}
  </p>
)}
```

- Implementar `markAbsent` (guarda en la ActiveSession + IndexedDB):

```typescript
async function markAbsent(containerId: string) {
  if (!activeSession || activeSession.context.type !== 'weighing') return
  const note = window.prompt('Nota (opcional) — por qué este tacho no se pesa:') ?? ''
  const next: ActiveSession = {
    ...activeSession,
    context: {
      ...activeSession.context,
      skipped: [...(activeSession.context.skipped ?? []).filter((s) => s.container_id !== containerId), { container_id: containerId, note }],
    },
  }
  await startSession(next) // put sobreescribe por key
  setActiveSession(next)
}
```

- Cambiar el `disabled` del botón "Finalizar pesaje":

```tsx
disabled={sessionReceptions.length === 0 || pendingNotSkipped.length > 0}
```

- En `ConfirmFinishDialog`, si `pendingNotSkipped.length === 0 && skipped.length > 0`, mostrar
  "N tachos quedaron pendientes para la próxima sesión." (pasar `skippedCount` como prop).

- [ ] **Step 4: Tratamiento inmediato en `handleFinish` (F4)**

En `handleFinish`, reemplazar el `sessionReceptions.forEach(...)` que crea StorageEvent+location
por una versión que ramifica según `treat_immediately`:

```typescript
for (const [idx, r] of sessionReceptions.entries()) {
  if (r.treat_immediately && r.waste_type === 'infectious') {
    // Tratamiento completado de una vez → tacho clean, sin cámara fría
    try {
      const supabase = createClient()
      const tr = await q.createTreatmentRun(supabase, {
        container_id: r.container_id,
        started_at: now,
        completed_at: now,
        operator_id: currentProfileId,
      })
      addTreatmentRun({ id: tr.id, container_id: r.container_id, started_at: now, completed_at: now, operator_id: currentProfileId })
    } catch (err) {
      console.error('[pesaje] tratamiento inmediato falló:', err)
    }
    addLocation({
      id: `loc-${Date.now()}-${idx}`, container_id: r.container_id, reported_at: now,
      operator_id: currentProfileId, location_type: 'treatment', client_id: null,
      floor: null, area: null, notes: 'Tratado al finalizar pesaje',
    })
  } else {
    addStorageEvent({ id: `storage-${Date.now()}-${idx}`, container_id: r.container_id, entry_at: now, exit_at: null, operator_id: currentProfileId, photo_ids: [] })
    addLocation({ id: `loc-${Date.now()}-${idx}`, container_id: r.container_id, reported_at: now, operator_id: currentProfileId, location_type: 'cold_storage', client_id: null, floor: null, area: null, notes: 'Cámara fría (auto tras pesaje)' })
  }
}
```

- [ ] **Step 5: Verificar compilación + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: sin errores.

- [ ] **Step 6: Correr toda la suite**

Run: `npx vitest run`
Expected: PASS (los tests de route-sessions/containers no se rompen).

- [ ] **Step 7: Commit**

```bash
git add src/components/register/weighing-form.tsx src/app/register/weighing/page.tsx src/lib/active-session.ts
git commit -m "feat(pesaje): tipo de desecho input, empresa heredada, pendientes+bloqueo+ausente, tratado inmediato"
```

### Task 3.3: Drawer de sesión — mostrar número pelado

**Files:**
- Modify: `src/components/register/weighing-session-drawer.tsx`

- [ ] **Step 1: Usar `formatTachoNumber` donde muestre `container_id`**

Importar `formatTachoNumber` y reemplazar las ocurrencias de display del id del tacho por
`formatTachoNumber(r.container_id)`.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/register/weighing-session-drawer.tsx
git commit -m "feat(pesaje): drawer muestra numero de tacho sin prefijo"
```

---

## Fase 4 — Activar Tratamiento (F5)

### Task 4.1: Reescribir `treatment/page.tsx` contra Supabase con multi-select

**Files:**
- Modify: `src/app/register/treatment/page.tsx`

- [ ] **Step 1: Calcular candidatos (infeccioso en cámara fría) por fase derivada**

Reescribir el componente para:
- Leer del store `containers, receptions, storageEvents, treatmentRuns, externalTransfers, routeEvents, locations, currentProfileId, addTreatmentRun`.
- Computar, por cada container activo, su fase con `buildContainerWithPhase` (igual patrón que
  `app/containers/page.tsx:27-41`) y su última recepción.
- Candidatos = fase `cold_storage` **y** última recepción `waste_type === 'infectious'`.

```typescript
const candidates = containers
  .filter((c) => c.status === 'active')
  .map((c) => {
    const routeIds = getRouteEventIdsForContainer(routeEvents, c.id)
    const reception = [...receptions].filter((r) => r.container_id === c.id)
      .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0] ?? null
    const storage = [...storageEvents].filter((s) => s.container_id === c.id)
      .sort((a, b) => new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime())[0] ?? null
    const treatment = treatmentRuns.find((t) => t.container_id === c.id && !t.completed_at)
      ?? externalTransfers.find((t) => t.container_id === c.id && !t.transferred_at) ?? null
    const phase = computeContainerPhase(routeIds, reception, storage, treatment)
    return { container: c, reception, storage, phase }
  })
  .filter((x) => x.phase === 'cold_storage' && x.reception?.waste_type === 'infectious')
```

- [ ] **Step 2: UI multi-select + confirmar**

- Lista con checkbox por candidato (mostrar `formatTachoNumber(container.id)` + tamaño).
- Estado `selectedIds: Set<string>`.
- Botón "Enviar N a tratamiento" deshabilitado si vacío.

- [ ] **Step 3: `handleSubmit` — TreatmentRun completado + cerrar storage**

```typescript
async function handleSubmit() {
  if (!currentProfileId || selectedIds.size === 0) return
  const now = new Date().toISOString()
  const supabase = createClient()
  for (const id of selectedIds) {
    try {
      const tr = await q.createTreatmentRun(supabase, {
        container_id: id, started_at: now, completed_at: now, operator_id: currentProfileId,
      })
      addTreatmentRun({ id: tr.id, container_id: id, started_at: now, completed_at: now, operator_id: currentProfileId })
      addLocation({ id: `loc-${Date.now()}-${id}`, container_id: id, reported_at: now, operator_id: currentProfileId, location_type: 'treatment', client_id: null, floor: null, area: null, notes: 'Tratamiento' })
    } catch (err) { console.error('[tratamiento] falló:', err) }
  }
  setDone(true)
}
```

> El cierre del StorageEvent se refleja vía la fase derivada (tratamiento completado → clean),
> así que no es estrictamente necesario tocar `storageEvents` en el store; si se desea exactitud
> histórica, agregar un `updateStorageEvent` con `exit_at` (opcional, fuera de alcance).

- [ ] **Step 4: Verificar compilación + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/register/treatment/page.tsx
git commit -m "feat(tratamiento): activar contra Supabase, multi-select, candidatos cold_storage infeccioso"
```

---

## Fase 5 — Empresa en recorrido (F6)

### Task 5.1: Selector de empresa en recorrido (andén + morgue)

**Files:**
- Modify: `src/app/register/route/anden/[slot]/page.tsx`
- Modify: `src/app/register/route/morgue/page.tsx`
- Modify: `src/components/register/route-form.tsx` (si el selector va en el form)

- [ ] **Step 1: Estado de empresa seleccionada + selector**

En las páginas de recorrido (hoy usan `const client = clients[0]`):
- Agregar estado `const [companyId, setCompanyId] = useState('')`.
- Renderizar un `<Select>` de empresas del cliente (`companies.filter(c => c.client_id === client.id)`),
  mostrando `{c.name}`. Requerido para iniciar/guardar el recorrido.

- [ ] **Step 2: Persistir `company_id` al crear el route_event**

En las llamadas a `q.createRouteEvent` / `addRouteEvent` (donde hoy se pasa `client_id: client.id`),
agregar `company_id: companyId`. Verificar la firma de `createRouteEvent` en
`src/lib/supabase/queries/route-events.ts` — el insert usa `TablesInsert<'route_events'>`, que ya
incluye `company_id` tras regenerar tipos.

- [ ] **Step 3: Verificar compilación + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/register/route/anden/\[slot\]/page.tsx src/app/register/route/morgue/page.tsx src/components/register/route-form.tsx
git commit -m "feat(recorrido): selector de empresa (ION/Airkem) persistido en route_event"
```

---

## Fase 6 — Reportes por empresa registrada (F6)

### Task 6.1: `reports.ts` — seleccionar por empresa registrada con fallback histórico

**Files:**
- Modify: `src/lib/data/reports.ts:120-138`
- Test: `src/__tests__/lib/reports.test.ts`

- [ ] **Step 1: Escribir test que falla**

Agregar a `src/__tests__/lib/reports.test.ts` un caso: una reception con `company_id` = 'ion'
sobre un tacho cuyo `container.company_id` = 'company-airkem' debe aparecer en el reporte de
**ion** (no de airkem); y una reception histórica con `company_id: null` debe caer en el reporte
de la empresa del container (fallback). (Construir el `ReportStoreSlice` mínimo con un día y una
reception con fotos.)

```typescript
// Esqueleto del aserto clave:
const dataIon = buildPhotographicReportData('ion', store, range)
expect(dataIon!.meta.weighingReceptionCount).toBe(1) // la reception con company_id='ion'
const dataAirkem = buildPhotographicReportData('company-airkem', store, range)
expect(dataAirkem!.meta.weighingReceptionCount).toBe(1) // la histórica (fallback)
```

- [ ] **Step 2: Correr (debe fallar)**

Run: `npx vitest run src/__tests__/lib/reports.test.ts`
Expected: FAIL — hoy filtra por `container.company_id` (la de 'ion' no aparecería).

- [ ] **Step 3: Implementar selección por empresa registrada**

Reemplazar el bloque de selección (líneas ~120-138). En vez de `containerIds` derivado de
`container.company_id`, calcular pertenencia por evento:

```typescript
// Helper local: ¿esta reception pertenece a la empresa del reporte?
const recBelongs = (r: ContainerReception): boolean => {
  if (r.company_id) return r.company_id === companyId
  // Fallback histórico: empresa derivada del tacho
  const c = store.containers.find((x) => x.id === r.container_id)
  return c?.company_id === companyId
}
const routeBelongs = (e: RouteEvent): boolean => {
  if (e.company_id) return e.company_id === companyId
  // Fallback histórico: por los tachos que toca, cuya empresa-dueña es companyId
  const ids = [...e.containers_dirty_received, ...e.containers_clean_delivered]
  return ids.some((cid) => store.containers.find((x) => x.id === cid)?.company_id === companyId)
}

const routeEvents = store.routeEvents.filter(
  (r) => r.kind === 'anden' && withinRange(r.started_at, start, end) && routeBelongs(r),
)
const receptions = store.receptions.filter(
  (r) => withinRange(r.arrived_at, start, end) && recBelongs(r),
)

// containerIds: el universo de tachos relevantes para este reporte (para mapear fotos de ruta)
const relevantContainerIds = new Set<string>([
  ...receptions.map((r) => r.container_id),
  ...routeEvents.flatMap((e) => [...e.containers_dirty_received, ...e.containers_clean_delivered]),
])
const containers = store.containers.filter((c) => relevantContainerIds.has(c.id))
const containerIds = relevantContainerIds
const containerMap = new Map(containers.map((c) => [c.id, c]))
```

> El resto de la función (rutaOfContainer, routesByKey, grupos) sigue usando `containerIds`
> y `containerMap`, ahora poblados por evento. Revisar que las referencias internas a
> `containerIds.has(...)` sigan teniendo sentido (sí: filtran fotos de ruta a tachos del reporte).

- [ ] **Step 4: Correr (debe pasar) + suite de reports**

Run: `npx vitest run src/__tests__/lib/reports.test.ts`
Expected: PASS (nuevos + existentes; ajustar fixtures existentes si asumían filtrado por
container.company_id).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/reports.ts src/__tests__/lib/reports.test.ts
git commit -m "feat(reportes): agrupar por empresa registrada (reception/route) con fallback historico"
```

---

## Fase 7 — Desvincular `waste_type` del tacho (F7, cascada)

> Esta fase quita `Container.waste_type` (TS) y la columna DB. Hacerla DESPUÉS de que pesaje
> escriba `reception.waste_type` (Fase 3) para no perder el dato.

### Task 7.1: Lectores de fase — rutear tratamiento vs traslado por la última recepción

**Files:**
- Modify: `src/app/containers/page.tsx:36-37`
- Modify: `src/app/containers/[id]/page.tsx`
- Modify: `src/lib/data/dashboard-metrics.ts` (si usa `waste_type`)

- [ ] **Step 1: Cambiar el criterio treatment vs transfer**

Hoy `app/containers/page.tsx` arma `treatment` buscando tanto treatmentRuns como
externalTransfers sin mirar el tipo. Mantener ese fallback, pero donde el código elija el camino
por tipo (si lo hace), usar la última recepción del tacho: `lastReception?.waste_type`. Buscar
usos de `container.waste_type` (Step de verificación abajo) y reemplazar por el tipo de la última
recepción del tacho (`receptions` más reciente por `arrived_at`), con fallback `'infectious'` si
no hay recepción.

- [ ] **Step 2: Verificar todos los usos de `waste_type` sobre containers**

Run: `npx rg "\.waste_type" src --type ts --type tsx`
Expected: enumerar cada uso. Los que operan sobre un `Container`/`ContainerWithPhase` deben pasar
a usar el tipo de la recepción. Los que operan sobre `ContainerReception` quedan igual.

- [ ] **Step 3: Commit (parcial, sigue 7.2)** — solo si compila.

### Task 7.2: Quitar `waste_type` de `Container` (TS), del form de alta y del filtro de admin/containers

**Files:**
- Modify: `src/lib/types.ts` (interface `Container`)
- Modify: `src/components/admin/container-form.tsx`
- Modify: `src/components/containers/container-filters.tsx` + `app/containers/page.tsx:48`
- Modify: `src/components/supabase-hydrator.tsx:163-174` (rowToContainer)
- Modify: `src/lib/mock-data.ts` + `src/lib/data/historical-data.json`

- [ ] **Step 1: Quitar `waste_type` de la interface `Container`**

Borrar la línea `waste_type: WasteType` de `interface Container` en `types.ts`.

- [ ] **Step 2: Form de alta — quitar el selector de tipo**

En `container-form.tsx`: borrar `WASTE_OPTIONS`, el estado `wasteType`, el bloque del `<Select>`
de tipo, y `waste_type` del objeto `onSubmit`. Ajustar `canSubmit` (sin `wasteType`).

- [ ] **Step 3: Filtro de admin/containers — quitar filtro por tipo**

En `container-filters.tsx` y `app/containers/page.tsx:48`, quitar el filtro por `waste_type`
(la propiedad ya no existe en Container). Si se quiere filtrar por tipo, sería por última
recepción (fuera de alcance — quitar el filtro).

- [ ] **Step 4: Hydrator — quitar `waste_type` de `rowToContainer`**

Quitar `waste_type: r.waste_type` del objeto que arma `rowToContainer`.

- [ ] **Step 5: Mock + historical — mover waste_type a receptions**

- En `mock-data.ts`: quitar `waste_type` de cada container hardcoded; eliminar los 10 tachos ION
  (ver Task 8.3, puede hacerse acá). Asegurar que las `MOCK_RECEPTIONS` traigan `waste_type`.
- En `historical-data.json`: quitar `waste_type` de `containers[]` y, si las `receptions[]` del
  histórico no lo tienen, agregarlo copiándolo del container correspondiente (script o edición).
  El backfill DB ya cubrió Supabase (Task 0.1); esto cubre el seed/mock.

> Si hay un script `scripts/extract-historical-data.py`, ajustarlo para emitir `waste_type` en
> receptions y no en containers, y regenerar `historical-data.json`.

- [ ] **Step 6: Verificar compilación + suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sin errores; tests verdes (ajustar fixtures que seteaban `container.waste_type`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(tachos): desvincular waste_type del tacho (TS + alta + admin + mock/historical)"
```

### Task 7.3: Migración drop `containers.waste_type` + regenerar tipos

**Files:**
- Create: `supabase/migrations/20260529020000_drop_containers_waste_type.sql`
- Modify: `src/lib/supabase/database.types.ts`

- [ ] **Step 1: Escribir la migración**

```sql
-- 2026-05-29: el tipo de desecho ya vive en container_receptions (input de pesaje).
-- El backfill a receptions se hizo en 20260529000000. Se elimina del tacho.
alter table public.containers drop column waste_type;
```

- [ ] **Step 2: Aplicar + regenerar tipos**

Run: `supabase db push && supabase gen types typescript --linked > src/lib/supabase/database.types.ts`
Expected: `containers` ya no tiene `waste_type`; `q.ContainerRow` tampoco.

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores (rowToContainer ya no lee `waste_type` tras Task 7.2).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260529020000_drop_containers_waste_type.sql src/lib/supabase/database.types.ts
git commit -m "feat(db): drop containers.waste_type (tipo vive en la recepcion)"
```

---

## Fase 8 — Rename "envase → tacho" + display + limpieza de mocks

### Task 8.1: Helper de display ya disponible — aplicarlo donde reste

**Files:**
- Modify: `src/components/containers/container-table.tsx`, `app/containers/[id]/page.tsx`,
  `components/dashboard/*`, `app/admin/containers/page.tsx`, `components/register/*`,
  cualquier lugar que muestre `container.id`/`container_id` al usuario.

- [ ] **Step 1: Encontrar usos de display del id**

Run: `npx rg "\.id\}|container_id\}|\{c\.id" src --type tsx -l`
Expected: lista de componentes que muestran ids. En cada uno que sea cara al usuario, envolver con
`formatTachoNumber(...)`. (No tocar `key={...}` ni lógica; solo display.)

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): mostrar numero de tacho sin prefijo en todas las vistas"
```

### Task 8.2: Rename masivo de strings "envase → tacho"

**Files:** ~36 archivos en `src/` con la palabra "envase".

- [ ] **Step 1: Inventariar**

Run: `npx rg -i "envase" src -l`
Expected: ~36 archivos.

- [ ] **Step 2: Reemplazar respetando concordancia**

Reemplazar, case-sensitive, en strings de UI (no en identificadores de código):
- `envases` → `tachos`, `Envases` → `Tachos`
- `envase` → `tacho`, `Envase` → `Tacho`

Hacerlo archivo por archivo revisando que no se toque código (no hay identificadores
`envase` en el código TS, que está en inglés — verificar). Comando asistido por archivo:
`npx rg -i "envase" <archivo>` y editar con cuidado.

- [ ] **Step 3: Verificación de cero ocurrencias en UI**

Run: `npx rg -i "envase" src`
Expected: 0 resultados (o solo comentarios históricos que se decida conservar; idealmente 0).

- [ ] **Step 4: Compilación + lint + suite**

Run: `npx tsc --noEmit && npx next lint && npx vitest run`
Expected: todo verde.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(ui): rename 'envase' -> 'tacho' en toda la app"
```

### Task 8.3: Eliminar los 10 tachos ION mock (si no se hizo en 7.2)

**Files:**
- Modify: `src/lib/mock-data.ts`

- [ ] **Step 1: Quitar los containers `I-001..I-010`**

En `MOCK_CONTAINERS`, borrar el bloque ION hardcoded (líneas con `company-ion`). Mantener
`MOCK_COMPANIES` (ION + Airkem siguen como empresas seleccionables). Ajustar
`MOCK_ROUTE_EVENTS`/`MOCK_RECEPTIONS`/fixtures que referencien `I-0xx`.

- [ ] **Step 2: Compilación + suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: verde (ajustar cualquier test que usara ids ION).

- [ ] **Step 3: Commit**

```bash
git add src/lib/mock-data.ts
git commit -m "chore(mock): eliminar los 10 tachos ION de demo (pool real = 189)"
```

---

## Fase 9 — Vault/docs + verificación final

### Task 9.1: Actualizar vault

**Files:**
- Create: `vault/logs/2026-05-29-pesaje-tratamiento-rename-tacho.md`
- Create: `vault/decisions/2026-05-29-empresa-tipo-dinamicos-tacho.md`
- Modify: `vault/processes/ContainerLifecycle.md`, `vault/processes/WasteTypes.md`
- Modify: `vault/decisions/2026-05-21-estado-envase-derivado.md` (marcar P1 parcial)
- Modify: `vault/_index.md` (estado + fecha)

- [ ] **Step 1: Escribir log + ADR + actualizar procesos e índice**

Documentar: empresa y tipo de desecho dinámicos (derivados de recorrido/recepción, reset al
tratar), tratamiento inmediato, activación de tratamiento, display por número, rename. Convertir
fechas relativas a absolutas. Actualizar la tabla de estado y "Última actualización" en `_index.md`.

- [ ] **Step 2: Commit**

```bash
git add vault/
git commit -m "docs(vault): empresa/tipo dinamicos, tratamiento, rename tacho"
```

### Task 9.2: Verificación end-to-end (build)

- [ ] **Step 1: Build de producción**

Run: `npx next build`
Expected: build OK, sin errores de tipos ni de prerender.

- [ ] **Step 2: Suite completa**

Run: `npx vitest run`
Expected: todo verde.

- [ ] **Step 3: Checklist E2E manual (dispositivo real, anotar en el log)**

  - [ ] Pesaje: pendientes listados por número (001, 006…); "Finalizar" bloqueado hasta pesar
        todos o marcar ausente; el ausente reaparece en la próxima sesión.
  - [ ] Pesaje: tipo de desecho se elige en el form; empresa heredada se muestra informativa.
  - [ ] Tratar inmediatamente → al finalizar, el tacho queda disponible (clean) y sin empresa.
  - [ ] Tratamiento: multi-select de infecciosos en cámara fría → quedan clean.
  - [ ] Recorrido: selector de empresa; el reporte de esa empresa muestra los registros.
  - [ ] Histórico de Airkem intacto en dashboard y reporte.

---

## Notas de ejecución

- **Aplicación de migraciones:** el repo usa `supabase/migrations/`. Si no hay CLI linkeada,
  aplicar el SQL vía el MCP de Supabase contra el proyecto `xqqnthyipkdkwyknbtnw`. Regenerar
  `database.types.ts` tras cada cambio de esquema.
- **`waste_type` enum:** confirmar el nombre del tipo enum en `database.types.ts` antes de la
  migración 0.1 (el `default 'infectious'` debe coincidir con un valor válido del enum).
- **Orden de fases:** 0→3 antes de 7 (no dropear `containers.waste_type` hasta que pesaje escriba
  el tipo en la recepción y los lectores usen la recepción).
