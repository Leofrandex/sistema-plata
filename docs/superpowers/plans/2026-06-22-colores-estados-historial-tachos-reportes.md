# Colores de estados, historial, tab de tachos y reportes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolorear los 4 estados de circulación, reorganizar el historial de recorridos, enriquecer el tab de Tachos (filtros + tiempo en fase + fases del dashboard) y corregir las fotos en los reportes (sin firmas, peso arriba / tacho abajo).

**Architecture:** La lógica pura (helpers de circulación, derivación de empresa, contenido de fotos del reporte) se implementa con TDD en `src/lib/data/`. Las vistas cliente (historial, tab de tachos, documento PDF) consumen esos helpers y se verifican con `next build` + E2E manual, siguiendo el patrón del repo (lógica testeada con jest, páginas cliente verificadas por build).

**Tech Stack:** Next.js (App Router), TypeScript, Zustand store, `@react-pdf/renderer`, Jest.

## Global Constraints

- Sin migraciones de base de datos.
- El tipo `Photo` del app NO expone `role`; las firmas se excluyen por `RouteEvent.signature_photo_id`.
- Orden determinista de `ContainerReception.photo_ids`: **índice 0 = tacho, índice 1 = balanza/peso**.
- Fuente única de color de los 4 estados: `BUCKET_DEFINITIONS` en `src/lib/data/dashboard-metrics.ts`.
- Tests jest en `src/__tests__/...`. Correr: `npm run test:jest`. Build: `npm run build`.
- Contadores del historial: por tarjeta (no resumen global).
- "Tiempo en fase": formato `Xd Yh` / `Xh Ym` / `Xm`; refresco cada 60s (no por segundo).

---

### Task 1: Recolorear estados + helpers de color/label

**Files:**
- Modify: `src/lib/data/dashboard-metrics.ts:27-32` (colores) y añadir helpers tras `BUCKET_DEFINITIONS`.
- Test: `src/__tests__/lib/dashboard-metrics.test.ts`

**Interfaces:**
- Consumes: `BUCKET_DEFINITIONS`, `CirculationBucket` (ya existen).
- Produces:
  - `circulationColor(bucket: CirculationBucket): string`
  - `circulationLabel(bucket: CirculationBucket): string`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `src/__tests__/lib/dashboard-metrics.test.ts`:

```ts
import { circulationColor, circulationLabel } from '@/lib/data/dashboard-metrics'

describe('circulationColor / circulationLabel', () => {
  it('devuelve los colores nuevos por estado', () => {
    expect(circulationColor('en_planta')).toBe('#16A34A')
    expect(circulationColor('en_cliente')).toBe('#F97316')
    expect(circulationColor('pendiente_pesar')).toBe('#94A3B8')
    expect(circulationColor('pendiente_tratar')).toBe('#DC2626')
  })
  it('devuelve el label en español por estado', () => {
    expect(circulationLabel('en_planta')).toBe('En planta')
    expect(circulationLabel('pendiente_tratar')).toBe('Pendiente por tratar')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm run test:jest -- dashboard-metrics`
Expected: FAIL — `circulationColor`/`circulationLabel` no existen (o colores viejos).

- [ ] **Step 3: Implementar el cambio**

En `src/lib/data/dashboard-metrics.ts`, reemplazar el array `BUCKET_DEFINITIONS` (líneas 27-32) por:

```ts
const BUCKET_DEFINITIONS: Array<{ key: CirculationBucket; label: string; color: string }> = [
  { key: 'en_planta',        label: 'En planta',           color: '#16A34A' }, // verde
  { key: 'en_cliente',       label: 'En cliente',          color: '#F97316' }, // naranja
  { key: 'pendiente_pesar',  label: 'Pendiente por pesar', color: '#94A3B8' }, // gris
  { key: 'pendiente_tratar', label: 'Pendiente por tratar', color: '#DC2626' }, // rojo
]

const BUCKET_BY_KEY = new Map(BUCKET_DEFINITIONS.map((d) => [d.key, d]))

/** Color hex del estado de circulación (mismo que usa el dashboard). */
export function circulationColor(bucket: CirculationBucket): string {
  return BUCKET_BY_KEY.get(bucket)!.color
}

/** Label en español del estado de circulación. */
export function circulationLabel(bucket: CirculationBucket): string {
  return BUCKET_BY_KEY.get(bucket)!.label
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm run test:jest -- dashboard-metrics`
Expected: PASS (incluyendo los tests existentes de `computeCirculationBreakdown`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/dashboard-metrics.ts src/__tests__/lib/dashboard-metrics.test.ts
git commit -m "feat(estados): recolorear los 4 estados de circulación + helpers color/label"
```

---

### Task 2: `computeCirculationStatus` + `formatDuration`

**Files:**
- Modify: `src/lib/data/dashboard-metrics.ts` (refactor de `computeCirculationBucket`, añadir `computeCirculationStatus`, `formatDuration`).
- Test: `src/__tests__/lib/dashboard-metrics.test.ts`

**Interfaces:**
- Consumes: `CirculationTimelineSlice`, `CirculationBucket` (ya existen).
- Produces:
  - `interface CirculationStatus { bucket: CirculationBucket; sinceMs: number | null }`
  - `computeCirculationStatus(container: Container, store: CirculationTimelineSlice): CirculationStatus`
  - `formatDuration(ms: number): string`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/__tests__/lib/dashboard-metrics.test.ts`:

```ts
import { computeCirculationStatus, formatDuration } from '@/lib/data/dashboard-metrics'

describe('computeCirculationStatus', () => {
  const cont: Container = {
    id: '001', size_liters: 240, tare_weight_kg: 14, status: 'active',
    registered_at: '2026-01-01T00:00:00Z',
  }
  const base = { routeEvents: [] as RouteEvent[], receptions: [] as ContainerReception[], treatmentRuns: [] as TreatmentRun[], externalTransfers: [] as ExternalTransfer[] }

  it('sin eventos → en_planta y sinceMs null', () => {
    expect(computeCirculationStatus(cont, base)).toEqual({ bucket: 'en_planta', sinceMs: null })
  })

  it('pesado → pendiente_tratar y sinceMs = arrived_at de la recepción', () => {
    const receptions: ContainerReception[] = [{
      id: 'rec', container_id: '001', weighing_session_id: 's', arrived_at: '2026-06-11T09:00:00Z',
      gross_weight_kg: 40, operator_id: 'op', photo_ids: [], observations: '',
    }]
    const res = computeCirculationStatus(cont, { ...base, receptions })
    expect(res.bucket).toBe('pendiente_tratar')
    expect(res.sinceMs).toBe(new Date('2026-06-11T09:00:00Z').getTime())
  })
})

describe('formatDuration', () => {
  it('días y horas', () => {
    expect(formatDuration((3 * 24 + 4) * 3600_000)).toBe('3d 4h')
  })
  it('horas y minutos', () => {
    expect(formatDuration((5 * 3600 + 20 * 60) * 1000)).toBe('5h 20m')
  })
  it('solo minutos', () => {
    expect(formatDuration(12 * 60_000)).toBe('12m')
  })
  it('segundos → 0m', () => {
    expect(formatDuration(30_000)).toBe('0m')
  })
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm run test:jest -- dashboard-metrics`
Expected: FAIL — funciones no definidas.

- [ ] **Step 3: Implementar**

En `src/lib/data/dashboard-metrics.ts`, reemplazar la función `computeCirculationBucket` (líneas 56-93) por:

```ts
export interface CirculationStatus {
  bucket: CirculationBucket
  /** epoch ms del evento que dejó el tacho en este estado; null si no hay eventos. */
  sinceMs: number | null
}

/**
 * Clasifica un tacho y devuelve además cuándo entró a ese estado.
 * Recorridos y recepciones anulados (voided_at) se ignoran. Spec 2026-06-17.
 */
export function computeCirculationStatus(
  container: Container,
  store: CirculationTimelineSlice,
): CirculationStatus {
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
  const sinceMs = latest === -Infinity ? null : latest
  let bucket: CirculationBucket
  if (latest === -Infinity) bucket = 'en_planta'
  else if (latest === closed) bucket = 'en_planta'
  else if (latest === reception) bucket = 'pendiente_tratar'
  else if (latest === dirtyReceived) bucket = 'pendiente_pesar'
  else bucket = 'en_cliente'

  return { bucket, sinceMs }
}

/** Clasificación de circulación (compatibilidad: solo el bucket). */
export function computeCirculationBucket(
  container: Container,
  store: CirculationTimelineSlice,
): CirculationBucket {
  return computeCirculationStatus(container, store).bucket
}

/** Formatea una duración en ms como "Xd Yh" / "Xh Ym" / "Xm". */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  const days = Math.floor(totalMin / (60 * 24))
  const hours = Math.floor((totalMin % (60 * 24)) / 60)
  const minutes = totalMin % 60
  if (days >= 1) return `${days}d ${hours}h`
  if (hours >= 1) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npm run test:jest -- dashboard-metrics`
Expected: PASS (los tests existentes de `computeCirculationBucket` siguen verdes porque delega en `computeCirculationStatus`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/dashboard-metrics.ts src/__tests__/lib/dashboard-metrics.test.ts
git commit -m "feat(tachos): computeCirculationStatus (con sinceMs) + formatDuration"
```

---

### Task 3: Derivar la empresa actual del tacho

**Files:**
- Modify: `src/lib/data/containers.ts` (añadir `deriveContainerCompanyId`).
- Test: `src/__tests__/lib/containers.test.ts`

**Interfaces:**
- Consumes: tipos `RouteEvent`, `ContainerReception` de `@/lib/types`.
- Produces: `deriveContainerCompanyId(containerId: string, routeEvents: RouteEvent[], receptions: ContainerReception[]): string | null`

- [ ] **Step 1: Escribir el test que falla**

Añadir a `src/__tests__/lib/containers.test.ts` (importar `deriveContainerCompanyId` desde `@/lib/data/containers` y los tipos necesarios):

```ts
import { deriveContainerCompanyId } from '@/lib/data/containers'
import type { RouteEvent, ContainerReception } from '@/lib/types'

describe('deriveContainerCompanyId', () => {
  const route = (over: Partial<RouteEvent>): RouteEvent => ({
    id: 'r', client_id: 'cl', company_id: 'company-ion', kind: 'anden', slot: '06:30',
    date: '2026-06-10', started_at: '2026-06-10T06:30:00Z', ended_at: null,
    operator_id: 'op', status: 'completed',
    containers_dirty_received: [], containers_clean_delivered: [], area: '', photo_ids: [], ...over,
  })
  const rec = (over: Partial<ContainerReception>): ContainerReception => ({
    id: 'rec', container_id: '001', weighing_session_id: 's', arrived_at: '2026-06-11T09:00:00Z',
    gross_weight_kg: 40, operator_id: 'op', photo_ids: [], observations: '', ...over,
  })

  it('sin registros → null', () => {
    expect(deriveContainerCompanyId('001', [], [])).toBeNull()
  })

  it('gana el registro más reciente con company_id', () => {
    const routes = [route({ id: 'r1', started_at: '2026-06-10T06:30:00Z', company_id: 'company-airkem', containers_dirty_received: ['001'] })]
    const recs = [rec({ id: 'rec1', arrived_at: '2026-06-12T09:00:00Z', company_id: 'company-ion' })]
    expect(deriveContainerCompanyId('001', routes, recs)).toBe('company-ion')
  })

  it('ignora registros anulados y sin company_id', () => {
    const routes = [route({ id: 'r1', started_at: '2026-06-13T06:30:00Z', company_id: 'company-airkem', containers_clean_delivered: ['001'] })]
    const recs = [rec({ id: 'rec1', arrived_at: '2026-06-14T09:00:00Z', company_id: 'company-ion', voided_at: '2026-06-15T00:00:00Z' })]
    expect(deriveContainerCompanyId('001', routes, recs)).toBe('company-airkem')
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm run test:jest -- containers`
Expected: FAIL — `deriveContainerCompanyId` no existe.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/data/containers.ts` (al final del archivo; importar tipos si no están ya importados):

```ts
import type { RouteEvent, ContainerReception } from '@/lib/types'

/**
 * Empresa "actual" de un tacho: la del registro NO anulado más reciente que lo
 * referencia (recepción por arrived_at, recorrido por started_at), considerando
 * solo registros con company_id. Devuelve null si ninguno aplica.
 * La empresa es del registro, no del tacho (decisions/2026-06-10-empresa-por-registro).
 */
export function deriveContainerCompanyId(
  containerId: string,
  routeEvents: RouteEvent[],
  receptions: ContainerReception[],
): string | null {
  let bestTs = -Infinity
  let bestCompany: string | null = null

  for (const r of receptions) {
    if (r.voided_at) continue
    if (r.container_id !== containerId) continue
    if (!r.company_id) continue
    const ts = new Date(r.arrived_at).getTime()
    if (ts > bestTs) { bestTs = ts; bestCompany = r.company_id }
  }
  for (const e of routeEvents) {
    if (e.voided_at) continue
    if (!e.company_id) continue
    if (!e.containers_dirty_received.includes(containerId) && !e.containers_clean_delivered.includes(containerId)) continue
    const ts = new Date(e.started_at).getTime()
    if (ts > bestTs) { bestTs = ts; bestCompany = e.company_id }
  }
  return bestCompany
}
```

Nota: si `containers.ts` ya importa `RouteEvent`/`ContainerReception`, no dupliques el import — añade los nombres al import existente.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm run test:jest -- containers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/containers.ts src/__tests__/lib/containers.test.ts
git commit -m "feat(tachos): deriveContainerCompanyId (empresa del registro más reciente)"
```

---

### Task 4: Historial de recorridos — dos líneas + contadores

**Files:**
- Modify: `src/components/history/route-history.tsx:117-119`

**Interfaces:**
- Consumes: `formatTachoNumber` (ya importado), `RouteEvent.containers_clean_delivered`, `containers_dirty_received`.
- Produces: (cambio presentacional, sin API nueva).

- [ ] **Step 1: Implementar el cambio**

En `src/components/history/route-history.tsx`, reemplazar el bloque de la línea única (líneas 117-119):

```tsx
                <p className="text-xs text-muted-foreground mt-1">
                  Sucios: {ev.containers_dirty_received.map(formatTachoNumber).join(', ') || '—'} · Limpios: {ev.containers_clean_delivered.map(formatTachoNumber).join(', ') || '—'}
                </p>
```

por dos líneas con contador, limpios (verde) arriba y sucios (rojo) abajo:

```tsx
                <p className="text-xs mt-1 font-medium text-green-700">
                  Limpios ({ev.containers_clean_delivered.length}): {ev.containers_clean_delivered.map(formatTachoNumber).join(', ') || '—'}
                </p>
                <p className="text-xs font-medium text-red-700">
                  Sucios ({ev.containers_dirty_received.length}): {ev.containers_dirty_received.map(formatTachoNumber).join(', ') || '—'}
                </p>
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK, sin errores de TypeScript/ESLint.

- [ ] **Step 3: Verificación manual**

Abrir `/register/route` → pestaña Historial. Confirmar: cada tarjeta muestra `Limpios (N): …` en verde y debajo `Sucios (N): …` en rojo, con los contadores correctos.

- [ ] **Step 4: Commit**

```bash
git add src/components/history/route-history.tsx
git commit -m "feat(historial): limpios/sucios en líneas separadas con contador por recorrido"
```

---

### Task 5: Tab de Tachos — filtros, fase del dashboard y tiempo en fase

**Files:**
- Modify: `src/components/containers/container-filters.tsx` (interfaz + 2 selects nuevos)
- Modify: `src/components/containers/container-table.tsx` (columnas Fase/Tiempo en fase, tipo `TachoRow`)
- Modify: `src/app/containers/page.tsx` (view-model + filtros + props)

**Interfaces:**
- Consumes: `circulationColor`, `circulationLabel`, `computeCirculationStatus`, `formatDuration` (Tasks 1-2); `deriveContainerCompanyId` (Task 3); `CirculationBucket` de `@/lib/data/dashboard-metrics`.
- Produces:
  - `interface ContainerFilters { search: string; size: ContainerSize | 'all'; company: string | 'all'; phase: CirculationBucket | 'all' }`
  - `interface TachoRow { id: string; size_liters: ContainerSize; bucket: CirculationBucket; sinceMs: number | null; company_id: string | null }` (exportada desde `container-table.tsx`)
  - `ContainerTable` props: `{ rows: TachoRow[]; now: number }`
  - `ContainerFilters` props: `{ filters: ContainerFilters; onChange: (f: ContainerFilters) => void; companies: { id: string; name: string }[] }`

Esta tarea es un único entregable coherente: los tres archivos solo compilan juntos. Se verifica con `npm run build` + E2E manual.

- [ ] **Step 1: Reescribir `container-filters.tsx`**

Reemplazar el contenido completo de `src/components/containers/container-filters.tsx` por:

```tsx
'use client'

import { useId } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { circulationLabel } from '@/lib/data/dashboard-metrics'
import type { CirculationBucket } from '@/lib/data/dashboard-metrics'
import type { ContainerSize } from '@/lib/types'

const SIZE_OPTIONS: { value: ContainerSize | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los tamaños' },
  { value: 240, label: '240 L' },
  { value: 750, label: '750 L' },
  { value: 1100, label: '1100 L' },
]

const PHASE_OPTIONS: { value: CirculationBucket; label: string }[] = [
  { value: 'en_planta', label: circulationLabel('en_planta') },
  { value: 'en_cliente', label: circulationLabel('en_cliente') },
  { value: 'pendiente_pesar', label: circulationLabel('pendiente_pesar') },
  { value: 'pendiente_tratar', label: circulationLabel('pendiente_tratar') },
]

export interface ContainerFilters {
  search: string
  size: ContainerSize | 'all'
  company: string | 'all'
  phase: CirculationBucket | 'all'
}

interface Props {
  filters: ContainerFilters
  onChange: (filters: ContainerFilters) => void
  companies: { id: string; name: string }[]
}

const labelClass = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

export function ContainerFilters({ filters, onChange, companies }: Props) {
  const searchId = useId()
  const sizeLabelId = useId()
  const companyLabelId = useId()
  const phaseLabelId = useId()

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={searchId} className={labelClass}>Buscar tacho</label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchId}
            placeholder="Ej: I-001"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={sizeLabelId} className={labelClass}>Tamaño</span>
        <Select
          value={String(filters.size)}
          onValueChange={(v) => onChange({ ...filters, size: (!v || v === 'all') ? 'all' : (Number(v) as ContainerSize) })}
        >
          <SelectTrigger aria-labelledby={sizeLabelId} className="w-full">
            <SelectValue placeholder="Tamaño" />
          </SelectTrigger>
          <SelectContent>
            {SIZE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={companyLabelId} className={labelClass}>Empresa</span>
        <Select
          value={filters.company}
          onValueChange={(v) => onChange({ ...filters, company: (!v ? 'all' : v) })}
        >
          <SelectTrigger aria-labelledby={companyLabelId} className="w-full">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            {companies.map((co) => (
              <SelectItem key={co.id} value={co.id}>{co.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={phaseLabelId} className={labelClass}>Fase</span>
        <Select
          value={filters.phase}
          onValueChange={(v) => onChange({ ...filters, phase: (!v ? 'all' : (v as CirculationBucket)) })}
        >
          <SelectTrigger aria-labelledby={phaseLabelId} className="w-full">
            <SelectValue placeholder="Fase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las fases</SelectItem>
            {PHASE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Reescribir `container-table.tsx`**

Reemplazar el contenido completo de `src/components/containers/container-table.tsx` por:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { circulationColor, circulationLabel, formatDuration } from '@/lib/data/dashboard-metrics'
import type { CirculationBucket } from '@/lib/data/dashboard-metrics'
import type { ContainerSize } from '@/lib/types'
import { formatTachoNumber } from '@/lib/data/containers'

export interface TachoRow {
  id: string
  size_liters: ContainerSize
  bucket: CirculationBucket
  sinceMs: number | null
  company_id: string | null
}

interface Props {
  rows: TachoRow[]
  now: number
}

export function ContainerTable({ rows, now }: Props) {
  const router = useRouter()

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-card p-12 text-center text-muted-foreground ring-1 ring-foreground/10">
        No se encontraron tachos.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Tacho</th>
            <th className="px-4 py-3">Tamaño</th>
            <th className="px-4 py-3">Fase</th>
            <th className="px-4 py-3">Tiempo en fase</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((c) => {
            const href = `/containers/${c.id}`
            const tiempo = c.sinceMs == null ? '—' : formatDuration(Math.max(0, now - c.sinceMs))
            return (
              <tr
                key={c.id}
                tabIndex={0}
                aria-label={`Ver tacho ${formatTachoNumber(c.id)}`}
                onClick={() => {
                  if (typeof window !== 'undefined' && window.getSelection()?.toString()) return
                  router.push(href)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    router.push(href)
                  }
                }}
                className="cursor-pointer transition-colors outline-none hover:bg-accent/5 focus-visible:bg-accent/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <td className="px-4 py-3">
                  <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono font-semibold text-accent hover:underline"
                  >
                    {formatTachoNumber(c.id)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground/80">{c.size_liters} L</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full" style={{ backgroundColor: circulationColor(c.bucket) }} />
                    {circulationLabel(c.bucket)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{tiempo}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Reescribir `containers/page.tsx`**

Reemplazar el contenido completo de `src/app/containers/page.tsx` por:

```tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { ContainerFilters } from '@/components/containers/container-filters'
import { ContainerTable, type TachoRow } from '@/components/containers/container-table'
import { useStore } from '@/lib/store'
import { deriveContainerCompanyId } from '@/lib/data/containers'
import { computeCirculationStatus } from '@/lib/data/dashboard-metrics'
import type { ContainerFilters as Filters } from '@/components/containers/container-filters'

const DEFAULT_FILTERS: Filters = {
  search: '',
  size: 'all',
  company: 'all',
  phase: 'all',
}

export default function ContainersPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [now, setNow] = useState(() => Date.now())
  const {
    containers, companies, routeEvents, receptions, treatmentRuns, externalTransfers,
  } = useStore()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const rows: TachoRow[] = useMemo(() => {
    const timeline = { routeEvents, receptions, treatmentRuns, externalTransfers }
    return containers
      .filter((c) => c.status === 'active')
      .map((container) => {
        const { bucket, sinceMs } = computeCirculationStatus(container, timeline)
        return {
          id: container.id,
          size_liters: container.size_liters,
          bucket,
          sinceMs,
          company_id: deriveContainerCompanyId(container.id, routeEvents, receptions),
        }
      })
  }, [containers, routeEvents, receptions, treatmentRuns, externalTransfers])

  const filtered = useMemo(() => {
    return rows.filter((c) => {
      if (filters.search && !c.id.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.size !== 'all' && c.size_liters !== filters.size) return false
      if (filters.company !== 'all' && c.company_id !== filters.company) return false
      if (filters.phase !== 'all' && c.bucket !== filters.phase) return false
      return true
    })
  }, [rows, filters])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Inventario de Tachos</h1>
        <span className="text-sm text-slate-500">{filtered.length} tachos</span>
      </div>
      <ContainerFilters
        filters={filters}
        onChange={setFilters}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      />
      <ContainerTable rows={filtered} now={now} />
    </div>
  )
}
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build OK. Si TypeScript marca que `getRouteEventIdsForContainer`/`buildContainerWithPhase` quedaron sin uso, es esperado (ya no se importan aquí); no deben quedar imports muertos en `page.tsx`.

- [ ] **Step 5: Correr toda la suite**

Run: `npm run test:jest`
Expected: PASS (los helpers nuevos ya están testeados; esta tarea no cambia lógica testeada).

- [ ] **Step 6: Verificación manual**

Abrir `/containers`. Confirmar: 4 filtros (Buscar, Tamaño, Empresa, Fase). Columnas: Tacho · Tamaño · Fase · Tiempo en fase. La columna Fase muestra uno de los 4 estados con su punto de color (verde/naranja/gris/rojo). "Tiempo en fase" muestra `Xd Yh`/`Xh Ym`/`Xm` o `—`. Filtrar por empresa y por fase reduce la lista correctamente. Click en una fila navega a `/containers/{id}`.

- [ ] **Step 7: Commit**

```bash
git add src/components/containers/container-filters.tsx src/components/containers/container-table.tsx src/app/containers/page.tsx
git commit -m "feat(tachos): filtros empresa/fase, fase = estados del dashboard, columna tiempo en fase"
```

---

### Task 6: Reportes — excluir firmas + parear peso/tacho (lógica)

**Files:**
- Modify: `src/lib/data/reports.ts` (interfaz `WeighingPair`, campo `pairs`, `weighingGroupContent`, skip de firma en `routePhotoEntries`)
- Test: `src/__tests__/lib/reports.test.ts`

**Interfaces:**
- Consumes: `ReportPhotoGroup`, `ReportPhotoEntry`, `Photo`, `ContainerReception` (ya existen).
- Produces:
  - `interface WeighingPair { container_id: string; container: Container | null; scale: Photo | null; tacho: Photo | null }`
  - `ReportPhotoGroup` gana `pairs?: WeighingPair[]`
  - El campo `pairs` se llena para grupos `stage: 'weighing'`; `scale = photo_ids[1]`, `tacho = photo_ids[0]`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/__tests__/lib/reports.test.ts` (dentro del `describe('buildPhotographicReportData (por empresa)')`, reutiliza `ionStore`/`range` ya definidos):

```ts
  it('pares de pesaje: scale = photo_ids[1], tacho = photo_ids[0]', () => {
    const data = buildPhotographicReportData('company-ion', ionStore, range)!
    const wGroup = data.days[0].groups.find((g) => g.stage === 'weighing' && g.pairs)!
    expect(wGroup.pairs).toBeDefined()
    // reception-ion-1: photo_ids ['photo-ion-w1-1' (tacho), 'photo-ion-w1-2' (peso)]
    expect(wGroup.pairs![0].tacho!.id).toBe('photo-ion-w1-1')
    expect(wGroup.pairs![0].scale!.id).toBe('photo-ion-w1-2')
    // El conteo de fotos de pesaje no cambia
    expect(data.meta.weighingPhotoCount).toBe(4)
  })

  it('excluye la foto de firma del recorrido (signature_photo_id)', () => {
    const withSig: ReportStoreSlice = {
      ...ionStore,
      routeEvents: ionStore.routeEvents.map((e) =>
        e.id === 'route-ion-1'
          ? { ...e, photo_ids: [...e.photo_ids, 'photo-ion-sig'], signature_photo_id: 'photo-ion-sig' }
          : e,
      ),
      photos: [
        ...ionStore.photos,
        { id: 'photo-ion-sig', url: 'https://placehold.co/400x300?text=SIG', event_type: 'route' as const, event_id: 'route-ion-1', taken_at: '2026-05-17T07:45:00-05:00', label: 'Firma' },
      ],
    }
    const data = buildPhotographicReportData('company-ion', withSig, range)!
    const allPhotoIds = data.days.flatMap((d) => d.groups).flatMap((g) => g.photos).map((e) => e.photo.id)
    expect(allPhotoIds).not.toContain('photo-ion-sig')
    // sigue contando solo las 5 fotos de ruta reales (no la firma)
    expect(data.meta.routePhotoCount).toBe(5)
  })
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm run test:jest -- reports`
Expected: FAIL — `g.pairs` indefinido y la firma aún aparece.

- [ ] **Step 3: Implementar en `reports.ts`**

1) Añadir la interfaz y el campo `pairs`. Tras la definición de `ReportPhotoEntry` (líneas 13-20), añadir:

```ts
/** Par peso/tacho de un pesaje, para render columnar en el reporte. */
export interface WeighingPair {
  container_id: string
  container: Container | null
  scale: Photo | null   // foto del peso/balanza (photo_ids[1])
  tacho: Photo | null   // foto del tacho (photo_ids[0])
}
```

En `interface ReportPhotoGroup` (líneas 22-27), añadir el campo opcional:

```ts
export interface ReportPhotoGroup {
  label: string
  stage: 'route' | 'weighing'
  photos: ReportPhotoEntry[]
  pairs?: WeighingPair[]   // solo en grupos de pesaje
}
```

2) En `routePhotoEntries` (líneas 188-206), saltar la firma. Dentro del `for (const photoId of ev.photo_ids)`, añadir como primera línea del cuerpo:

```ts
      for (const photoId of ev.photo_ids) {
        if (photoId === ev.signature_photo_id) continue
        const photo = photoMap.get(photoId)
        if (!photo) continue
        ...
```

3) Reemplazar la función `weighingPhotoEntries` (líneas 208-228) por `weighingGroupContent`:

```ts
  function weighingGroupContent(recs: ContainerReception[]): { pairs: WeighingPair[]; photos: ReportPhotoEntry[] } {
    const sorted = [...recs].sort(
      (a, b) => new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime(),
    )
    const pairs: WeighingPair[] = []
    const photos: ReportPhotoEntry[] = []
    for (const rec of sorted) {
      const container = containerMap.get(rec.container_id) ?? null
      const tacho = rec.photo_ids[0] ? photoMap.get(rec.photo_ids[0]) ?? null : null
      const scale = rec.photo_ids[1] ? photoMap.get(rec.photo_ids[1]) ?? null : null
      if (!tacho && !scale) continue
      pairs.push({ container_id: rec.container_id, container, scale, tacho })
      if (scale) photos.push({ photo: scale, container_id: rec.container_id, container, taken_at: scale.taken_at, comment: '' })
      if (tacho) photos.push({ photo: tacho, container_id: rec.container_id, container, taken_at: tacho.taken_at, comment: '' })
    }
    return { pairs, photos }
  }
```

4) Actualizar las dos llamadas que construían grupos de pesaje.

En el grupo de pesaje por ruta (líneas 255-259), reemplazar por:

```ts
    const rutaWeighing = weighingGroupContent(receptionsByRuta.get(key) ?? [])
    pushGroup(date, {
      label: `Pesaje — ${def.ordinal} ruta`,
      stage: 'weighing',
      photos: rutaWeighing.photos,
      pairs: rutaWeighing.pairs,
    })
```

En el grupo de pesajes huérfanos (líneas 270-276), reemplazar por:

```ts
  for (const [date, recs] of orphanByDate) {
    const orphanWeighing = weighingGroupContent(recs)
    pushGroup(date, {
      label: 'Pesaje',
      stage: 'weighing',
      photos: orphanWeighing.photos,
      pairs: orphanWeighing.pairs,
    })
  }
```

Nota: el conteo de `weighingPhotoCount` (líneas 282-289) sigue usando `g.photos.length` y permanece correcto.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npm run test:jest -- reports`
Expected: PASS (incluidos los tests existentes: orden de grupos, voided, huérfanos, conteos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/reports.ts src/__tests__/lib/reports.test.ts
git commit -m "feat(reportes): excluir firma del recorrido y parear fotos de pesaje (peso/tacho)"
```

---

### Task 7: Reportes — render columnar peso arriba / tacho abajo

**Files:**
- Modify: `src/components/reports/photographic-report-document.tsx`

**Interfaces:**
- Consumes: `WeighingPair`, `ReportPhotoGroup.pairs` (Task 6); `chunk` (ya importado).
- Produces: (cambio de render PDF, sin API nueva).

- [ ] **Step 1: Implementar el render**

En `src/components/reports/photographic-report-document.tsx`:

1) Actualizar imports (línea 6) para incluir `WeighingPair`:

```tsx
import type { PhotographicReportData, ReportDay, ReportPhotoEntry, WeighingPair } from '@/lib/data/reports'
```

2) Añadir la constante de pares por cuadro (junto a la línea 8):

```tsx
const PHOTOS_PER_CUADRO = 8 // 4 columnas × 2 filas (recorrido)
const PAIRS_PER_CUADRO = 4  // 4 pesajes por bloque (peso arriba / tacho abajo)
const CUADROS_PER_PAGE = 4 // 2 × 2
```

3) Reemplazar la interfaz `Cuadro` y `buildCuadros` (líneas 149-164) por:

```tsx
interface Cuadro {
  label: string
  stage: 'route' | 'weighing'
  photos?: ReportPhotoEntry[]
  pairs?: WeighingPair[]
}

/** Convierte los grupos de un día en cuadros (recorrido: 8 fotos; pesaje: 4 pares). */
function buildCuadros(day: ReportDay): Cuadro[] {
  const cuadros: Cuadro[] = []
  for (const group of day.groups) {
    if (group.stage === 'weighing' && group.pairs) {
      const parts = chunk(group.pairs, PAIRS_PER_CUADRO)
      parts.forEach((pairs, i) => {
        cuadros.push({ label: i === 0 ? group.label : `${group.label} (cont.)`, stage: 'weighing', pairs })
      })
    } else {
      const parts = chunk(group.photos, PHOTOS_PER_CUADRO)
      parts.forEach((photos, i) => {
        cuadros.push({ label: i === 0 ? group.label : `${group.label} (cont.)`, stage: 'route', photos })
      })
    }
  }
  return cuadros
}
```

4) Reemplazar `CuadroView` (líneas 208-228) por un dispatcher + la vista de pesaje:

```tsx
function CuadroView({ cuadro }: { cuadro: Cuadro }) {
  return (
    <View style={styles.cuadro} wrap={false}>
      <Text style={styles.cuadroHeader}>{cuadro.label}</Text>
      <View style={styles.photoGrid}>
        {cuadro.stage === 'weighing'
          ? (cuadro.pairs ?? []).map((pair, i) => (
              <View key={`${pair.container_id}-${i}`} style={styles.photoCell}>
                <View style={[styles.photoBox, { marginBottom: 2 }]}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  {pair.scale && <Image src={pair.scale.url} style={styles.photo} />}
                </View>
                <View style={styles.photoBox}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  {pair.tacho && <Image src={pair.tacho.url} style={styles.photo} />}
                </View>
              </View>
            ))
          : (cuadro.photos ?? []).map((entry) => (
              <View key={entry.photo.id} style={styles.photoCell}>
                <View style={styles.photoBox}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={entry.photo.url} style={styles.photo} />
                </View>
              </View>
            ))}
      </View>
      <View style={styles.comentario}>
        <Text style={styles.comentarioLabel}>Comentario:</Text>
        <Text style={styles.comentarioText}>{cuadro.label}</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Verificación manual**

Abrir `/reports`, generar un PDF de una empresa con pesajes y firmas en el rango. Confirmar: (a) no aparecen las fotos de firma de los recorridos; (b) en los cuadros de "Pesaje", cada columna tiene la foto del peso arriba y la del tacho justo debajo, 4 pesajes por cuadro; (c) los cuadros de "Recorrido" siguen mostrando la grilla de fotos normal.

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/photographic-report-document.tsx
git commit -m "feat(reportes): render columnar de pesaje (peso arriba / tacho abajo)"
```

---

## Verificación final

- [ ] `npm run test:jest` → toda la suite en verde.
- [ ] `npm run build` → OK.
- [ ] E2E manual: dashboard (colores nuevos), historial (2 líneas + contadores), tab tachos (4 filtros + fase con color + tiempo en fase), reporte PDF (sin firmas, peso/tacho pareados).
- [ ] Actualizar el vault: `logs/2026-06-22-colores-historial-tachos-reportes.md` y la fila/estado en `vault/_index.md`.

## Notas de cierre del vault

Al terminar (regla CLAUDE.md): crear el log del cambio en `vault/logs/` documentando el **por qué** (no el qué, que ya está aquí) y actualizar `vault/_index.md`. Decisión de diseño a registrar si se considera no obvia: el tab de Tachos ahora usa los 4 estados de circulación del dashboard en vez de las 6 fases internas (`ContainerPhase`), que siguen vivas solo en la página de detalle del tacho.
```
