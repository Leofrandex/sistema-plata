# Dashboard & Containers UI Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulir UX del Dashboard y del Inventario de Envases: filtros con labels, filas de envase totalmente clickeables, dashboard de lotes unificado a ancho completo, y refresh visual del dashboard apegado al branding Hospimed.

**Architecture:** Refactor focalizado a 4 archivos UI existentes + creación de 4 componentes en `src/components/dashboard/` para tarjeta de lote unificada, segmented control de estado, filtros de completados y hero. No se introducen dependencias nuevas. Se reutilizan tokens del design system (`bg-primary`, `bg-accent`, `bg-secondary`, `ring-foreground/10`, `text-muted-foreground`).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 3, shadcn + base-ui (Select), lucide-react. Sin tests nuevos (UI cosmética; no hay tests UI existentes en estos archivos).

---

## File Structure

**Modify:**
- `src/components/containers/container-filters.tsx` — labels visibles + ícono de búsqueda + grid responsive
- `src/components/containers/container-table.tsx` — fila completa clickeable con `useRouter().push()`
- `src/components/dashboard/metrics-cards.tsx` — KPI cards con ícono + acento de color + decoración blur
- `src/app/dashboard/page.tsx` — reemplazar Tabs por SegmentedToggle + grid de tarjetas a ancho completo + hero

**Create:**
- `src/components/dashboard/batch-card.tsx` — tarjeta unificada de lote (variant `'active' | 'completed'`)
- `src/components/dashboard/batch-status-toggle.tsx` — segmented control con contadores
- `src/components/dashboard/completed-batches-filters.tsx` — filtros (cliente + rango fechas) con labels
- `src/components/dashboard/dashboard-hero.tsx` — encabezado decorativo con saludo, fecha y blobs blur

**Delete:**
- `src/components/dashboard/active-batches-tab.tsx`
- `src/components/dashboard/completed-batches-tab.tsx`

---

## Task 1: Filtros del Inventario con labels

**Files:**
- Modify: `src/components/containers/container-filters.tsx` (reemplazo total)

- [ ] **Step 1: Reemplazar el componente entero**

Reemplaza el contenido completo de `src/components/containers/container-filters.tsx` con:

```tsx
'use client'

import { useId } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Client, WasteType, ContainerSize } from '@/lib/types'

const WASTE_TYPE_OPTIONS: { value: WasteType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'infectious', label: 'Infeccioso' },
  { value: 'anatomopathological', label: 'Anatomopatológico' },
  { value: 'cytotoxic', label: 'Citotóxico' },
  { value: 'liquid', label: 'Líquidos' },
  { value: 'morgue', label: 'Morgue' },
]

const SIZE_OPTIONS: { value: ContainerSize | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los tamaños' },
  { value: 240, label: '240 L' },
  { value: 750, label: '750 L' },
  { value: 1100, label: '1100 L' },
]

export interface ContainerFilters {
  search: string
  clientId: string
  wasteType: WasteType | 'all'
  size: ContainerSize | 'all'
}

interface Props {
  filters: ContainerFilters
  clients: Client[]
  onChange: (filters: ContainerFilters) => void
}

const labelClass = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

export function ContainerFilters({ filters, clients, onChange }: Props) {
  const searchId = useId()

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={searchId} className={labelClass}>Buscar envase</label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchId}
            placeholder="Ej: A-069"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Cliente</span>
        <Select
          value={filters.clientId}
          onValueChange={(v) => onChange({ ...filters, clientId: v ?? 'all' })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Tipo de desecho</span>
        <Select
          value={String(filters.wasteType)}
          onValueChange={(v) => onChange({ ...filters, wasteType: (v ?? 'all') as WasteType | 'all' })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tipo de desecho" />
          </SelectTrigger>
          <SelectContent>
            {WASTE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Tamaño</span>
        <Select
          value={String(filters.size)}
          onValueChange={(v) => onChange({ ...filters, size: (!v || v === 'all') ? 'all' : (Number(v) as ContainerSize) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tamaño" />
          </SelectTrigger>
          <SelectContent>
            {SIZE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores nuevos en `container-filters.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/containers/container-filters.tsx
git commit -m "feat(containers): agregar labels visibles a filtros del inventario"
```

---

## Task 2: Filas de envase totalmente clickeables

**Files:**
- Modify: `src/components/containers/container-table.tsx` (reemplazo total)

- [ ] **Step 1: Reemplazar el componente entero**

Estrategia: usar `useRouter().push()` en `onClick` de la fila con `cursor-pointer`, `focus-visible:ring`, `tabIndex=0`, `role="link"` y `onKeyDown` para Enter/Space. El `<Link>` interno del serial se preserva con `e.stopPropagation()` para no disparar dos navegaciones.

```tsx
'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { ContainerWithPhase, ContainerPhase } from '@/lib/types'

const PHASE_LABELS: Record<ContainerPhase, string> = {
  exchange: 'Intercambio',
  weighing: 'Pesaje',
  cold_storage: 'Cámara fría',
  treatment: 'Tratamiento',
  transfer: 'Traslado',
  clean: 'Limpio',
}

const WASTE_LABELS: Record<string, string> = {
  infectious: 'Infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

interface Props {
  containers: ContainerWithPhase[]
  clients: { id: string; name: string }[]
}

export function ContainerTable({ containers, clients }: Props) {
  const router = useRouter()
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  if (containers.length === 0) {
    return (
      <div className="rounded-xl bg-card p-12 text-center text-muted-foreground ring-1 ring-foreground/10">
        No se encontraron envases.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Envase</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Tamaño</th>
            <th className="px-4 py-3">Fase actual</th>
            <th className="px-4 py-3">Ubicación actual</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {containers.map((c) => {
            const loc = c.current_location
            const locationText = loc
              ? loc.location_type === 'client_site'
                ? `${clientMap[loc.client_id ?? ''] ?? ''} · Piso ${loc.floor} — ${loc.area}`
                : loc.location_type.replace('_', ' ')
              : '—'
            const href = `/containers/${c.id}`

            return (
              <tr
                key={c.id}
                tabIndex={0}
                role="link"
                aria-label={`Ver envase ${c.id}`}
                onClick={() => router.push(href)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
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
                    {c.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground/80">{clientMap[c.client_id] ?? '—'}</td>
                <td className="px-4 py-3 text-foreground/80">{WASTE_LABELS[c.waste_type]}</td>
                <td className="px-4 py-3 text-foreground/80">{c.size_liters} L</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{PHASE_LABELS[c.current_phase]}</Badge>
                </td>
                <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">{locationText}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores nuevos en `container-table.tsx`.

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev` y abrir `http://localhost:3000/containers`
Expected: click en cualquier celda navega a `/containers/[id]`. Tab muestra ring de focus; Enter/Space activan navegación. El serial sigue siendo link (color accent en hover).

- [ ] **Step 4: Commit**

```bash
git add src/components/containers/container-table.tsx
git commit -m "feat(containers): toda la fila del envase es clickeable"
```

---

## Task 3: Crear `BatchStatusToggle` (segmented control)

**Files:**
- Create: `src/components/dashboard/batch-status-toggle.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client'

import { cn } from '@/lib/utils'

export type BatchStatusValue = 'active' | 'completed'

interface Props {
  value: BatchStatusValue
  onChange: (value: BatchStatusValue) => void
  activeCount: number
  completedCount: number
}

export function BatchStatusToggle({ value, onChange, activeCount, completedCount }: Props) {
  const options: { value: BatchStatusValue; label: string; count: number; dotClass: string }[] = [
    { value: 'active', label: 'Lotes activos', count: activeCount, dotClass: 'bg-accent' },
    { value: 'completed', label: 'Lotes completados', count: completedCount, dotClass: 'bg-emerald-500' },
  ]

  return (
    <div
      role="tablist"
      aria-label="Estado de lotes"
      className="inline-flex w-full items-center gap-1 rounded-xl bg-muted p-1 ring-1 ring-foreground/10 sm:w-auto"
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'group relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all sm:flex-initial',
              selected
                ? 'bg-card text-foreground shadow-sm ring-1 ring-foreground/10'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className={cn('size-2 rounded-full transition-opacity', opt.dotClass, selected ? 'opacity-100' : 'opacity-50')} />
            <span>{opt.label}</span>
            <span
              className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                selected ? 'bg-accent text-accent-foreground' : 'bg-foreground/10 text-foreground/70'
              )}
            >
              {opt.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/batch-status-toggle.tsx
git commit -m "feat(dashboard): nuevo BatchStatusToggle (segmented control)"
```

---

## Task 4: Crear `BatchCard` unificada

**Files:**
- Create: `src/components/dashboard/batch-card.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client'

import Link from 'next/link'
import { ArrowRight, FileText, Building2, Package, Calendar, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BatchWithClient, ContainerPhase } from '@/lib/types'

const PHASE_LABELS: Record<ContainerPhase, string> = {
  exchange: 'Intercambio pendiente',
  weighing: 'Pesaje pendiente',
  cold_storage: 'Cámara fría',
  treatment: 'En tratamiento',
  transfer: 'Traslado pendiente',
  clean: 'Completo',
}

const PHASE_ACCENT: Record<ContainerPhase, { dot: string; pill: string; bar: string }> = {
  exchange:     { dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700',       bar: 'from-blue-400/40    to-blue-400/0' },
  weighing:     { dot: 'bg-amber-500',   pill: 'bg-amber-50 text-amber-700',     bar: 'from-amber-400/40   to-amber-400/0' },
  cold_storage: { dot: 'bg-cyan-500',    pill: 'bg-cyan-50 text-cyan-700',       bar: 'from-cyan-400/40    to-cyan-400/0' },
  treatment:    { dot: 'bg-violet-500',  pill: 'bg-violet-50 text-violet-700',   bar: 'from-violet-400/40  to-violet-400/0' },
  transfer:     { dot: 'bg-orange-500',  pill: 'bg-orange-50 text-orange-700',   bar: 'from-orange-400/40  to-orange-400/0' },
  clean:        { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700', bar: 'from-emerald-400/40 to-emerald-400/0' },
}

interface Props {
  batch: BatchWithClient
  variant: 'active' | 'completed'
}

export function BatchCard({ batch, variant }: Props) {
  const isActive = variant === 'active'
  const accent = PHASE_ACCENT[batch.next_pending_step]
  const href = isActive ? `/batches/${batch.id}` : `/batches/${batch.id}/report`
  const ctaLabel = isActive ? 'Ver lote' : 'Generar reporte'
  const CtaIcon = isActive ? ArrowRight : FileText

  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className={cn('h-1 w-full bg-gradient-to-r', isActive ? accent.bar : 'from-emerald-400/50 to-emerald-400/0')} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-primary/10">
              <Building2 className="size-4" />
            </span>
            <span className="truncate">{batch.client.name}</span>
          </div>
          {isActive ? (
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', accent.pill)}>
              <span className={cn('size-1.5 rounded-full', accent.dot)} />
              {PHASE_LABELS[batch.next_pending_step]}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="size-3" />
              Completo
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Package className="size-3.5" />
            {batch.container_count} {batch.container_count === 1 ? 'envase' : 'envases'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            {batch.date}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-end pt-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors group-hover:text-accent/80">
            {ctaLabel}
            <CtaIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/batch-card.tsx
git commit -m "feat(dashboard): nueva BatchCard unificada (active/completed)"
```

---

## Task 5: Crear `CompletedBatchesFilters`

**Files:**
- Create: `src/components/dashboard/completed-batches-filters.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client'

import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  clients: { id: string; name: string }[]
  clientFilter: string
  dateFrom: string
  dateTo: string
  onClientChange: (id: string) => void
  onDateFromChange: (date: string) => void
  onDateToChange: (date: string) => void
}

const labelClass = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

export function CompletedBatchesFilters({
  clients, clientFilter, dateFrom, dateTo,
  onClientChange, onDateFromChange, onDateToChange,
}: Props) {
  const fromId = useId()
  const toId = useId()

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Cliente</span>
        <Select value={clientFilter} onValueChange={(v) => onClientChange(v ?? 'all')}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={fromId} className={labelClass}>Desde</label>
        <Input
          id={fromId}
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={toId} className={labelClass}>Hasta</label>
        <Input
          id={toId}
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/completed-batches-filters.tsx
git commit -m "feat(dashboard): filtros de lotes completados con labels"
```

---

## Task 6: Crear `DashboardHero`

**Files:**
- Create: `src/components/dashboard/dashboard-hero.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client'

import { useMemo } from 'react'

function getGreeting(date: Date): string {
  const h = date.getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const FORMATTER = new Intl.DateTimeFormat('es-PA', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function DashboardHero() {
  const { greeting, dateLabel } = useMemo(() => {
    const now = new Date()
    return {
      greeting: getGreeting(now),
      dateLabel: FORMATTER.format(now),
    }
  }, [])

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent p-6 text-primary-foreground ring-1 ring-foreground/10 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-accent/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-secondary/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-4 right-6 size-24 rounded-full border border-primary-foreground/15" />
      <div aria-hidden className="pointer-events-none absolute top-10 right-12 size-12 rounded-full border border-primary-foreground/10" />

      <div className="relative flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
          Dashboard
        </span>
        <h1 className="text-2xl font-bold sm:text-3xl">{greeting}</h1>
        <p className="text-sm text-primary-foreground/80 first-letter:uppercase">
          {dateLabel}
        </p>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/dashboard-hero.tsx
git commit -m "feat(dashboard): hero con saludo y formas decorativas"
```

---

## Task 7: Renovar `MetricsCards`

**Files:**
- Modify: `src/components/dashboard/metrics-cards.tsx` (reemplazo total — preserva `computeDashboardMetrics`)

- [ ] **Step 1: Reemplazar el componente entero**

```tsx
import { Boxes, Layers, Snowflake, Flame, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Batch, Container, StorageEvent, TreatmentRun } from '@/lib/types'

interface DashboardMetrics {
  activeBatches: number
  containersInCirculation: number
  containersInStorage: number
  containersInTreatment: number
}

export function computeDashboardMetrics(
  batches: Batch[],
  containers: Container[],
  storageEvents: StorageEvent[],
  treatmentRuns: TreatmentRun[]
): DashboardMetrics {
  const activeBatches = batches.filter((b) => b.status === 'active')
  const containerIdsInActiveBatches = new Set(
    activeBatches.flatMap((b) => b.container_ids)
  )
  const containersInStorage = storageEvents.filter((s) => s.exit_at === null).length
  const containersInTreatment = treatmentRuns.filter((t) => t.completed_at === null).length

  return {
    activeBatches: activeBatches.length,
    containersInCirculation: containerIdsInActiveBatches.size,
    containersInStorage,
    containersInTreatment,
  }
}

interface CardSpec {
  key: keyof DashboardMetrics
  label: string
  icon: LucideIcon
  iconBg: string
  iconText: string
  decoration: string
}

const CARDS: CardSpec[] = [
  { key: 'activeBatches',           label: 'Lotes activos',          icon: Layers,    iconBg: 'bg-accent/10',  iconText: 'text-accent',     decoration: 'from-accent/15    to-accent/0' },
  { key: 'containersInCirculation', label: 'Envases en circulación', icon: Boxes,     iconBg: 'bg-primary/10', iconText: 'text-primary',    decoration: 'from-primary/15   to-primary/0' },
  { key: 'containersInStorage',     label: 'En cámara fría',         icon: Snowflake, iconBg: 'bg-cyan-100',   iconText: 'text-cyan-700',   decoration: 'from-cyan-200/40  to-cyan-200/0' },
  { key: 'containersInTreatment',   label: 'En tratamiento',         icon: Flame,     iconBg: 'bg-violet-100', iconText: 'text-violet-700', decoration: 'from-violet-200/40 to-violet-200/0' },
]

interface Props {
  metrics: DashboardMetrics
}

export function MetricsCards({ metrics }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {CARDS.map(({ key, label, icon: Icon, iconBg, iconText, decoration }) => (
        <div
          key={key}
          className="group relative overflow-hidden rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div aria-hidden className={cn('pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br blur-2xl', decoration)} />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <span className={cn('flex size-9 items-center justify-center rounded-lg ring-1 ring-foreground/5', iconBg, iconText)}>
                <Icon className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-bold tabular-nums text-foreground">{metrics[key]}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/metrics-cards.tsx
git commit -m "feat(dashboard): KPI cards con íconos, acentos y decoración blur"
```

---

## Task 8: Reescribir `dashboard/page.tsx` (toggle + grid de tarjetas a ancho completo)

**Files:**
- Modify: `src/app/dashboard/page.tsx` (reemplazo total)

- [ ] **Step 1: Reemplazar el archivo entero**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { MetricsCards, computeDashboardMetrics } from '@/components/dashboard/metrics-cards'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { BatchStatusToggle, type BatchStatusValue } from '@/components/dashboard/batch-status-toggle'
import { BatchCard } from '@/components/dashboard/batch-card'
import { CompletedBatchesFilters } from '@/components/dashboard/completed-batches-filters'
import { useStore } from '@/lib/store'
import { computeNextPendingStep } from '@/lib/data/batches'
import { computeContainerPhase } from '@/lib/data/containers'
import type { BatchWithClient } from '@/lib/types'

export default function DashboardPage() {
  const {
    batches, clients, containers, storageEvents, treatmentRuns,
    exchangeEvents, receptions, externalTransfers,
  } = useStore()

  const [statusView, setStatusView] = useState<BatchStatusValue>('active')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const metrics = useMemo(
    () => computeDashboardMetrics(batches, containers, storageEvents, treatmentRuns),
    [batches, containers, storageEvents, treatmentRuns]
  )

  const enrichBatch = (batch: typeof batches[0]): BatchWithClient => {
    const client = clients.find((c) => c.id === batch.client_id)!
    const batchContainers = containers.filter((c) => batch.container_ids.includes(c.id))
    const phases = batchContainers.map((container) => {
      const exchangeIds = exchangeEvents
        .filter((e) => e.dirty_containers_received.includes(container.id) && e.batch_id === batch.id)
        .map((e) => e.id)
      const reception = receptions.find((r) => r.container_id === container.id && r.batch_id === batch.id) ?? null
      const storage = storageEvents.find((s) => s.container_id === container.id && s.batch_id === batch.id) ?? null
      const treatment = treatmentRuns.find((t) => t.container_id === container.id && t.batch_id === batch.id)
        ?? externalTransfers.find((t) => t.container_id === container.id && t.batch_id === batch.id)
        ?? null
      return computeContainerPhase(exchangeIds, reception, storage, treatment)
    })
    return {
      ...batch,
      client,
      next_pending_step: computeNextPendingStep(phases),
      container_count: batch.container_ids.length,
    }
  }

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status === 'active').map(enrichBatch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [batches, clients, containers, exchangeEvents, receptions, storageEvents, treatmentRuns, externalTransfers]
  )

  const completedBatches = useMemo(
    () => batches.filter((b) => b.status === 'completed').map(enrichBatch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [batches, clients, containers, exchangeEvents, receptions, storageEvents, treatmentRuns, externalTransfers]
  )

  const completedFiltered = useMemo(
    () => completedBatches.filter((b) => {
      if (clientFilter !== 'all' && b.client_id !== clientFilter) return false
      if (dateFrom && b.date < dateFrom) return false
      if (dateTo && b.date > dateTo) return false
      return true
    }),
    [completedBatches, clientFilter, dateFrom, dateTo]
  )

  const visible = statusView === 'active' ? activeBatches : completedFiltered
  const emptyText = statusView === 'active'
    ? 'No hay lotes activos hoy.'
    : 'No hay lotes completados con esos filtros.'

  return (
    <div className="space-y-6">
      <DashboardHero />
      <MetricsCards metrics={metrics} />

      <section className="space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Lotes</h2>
            <p className="text-sm text-muted-foreground">
              Accede al detalle del lote o al reporte final.
            </p>
          </div>
          <BatchStatusToggle
            value={statusView}
            onChange={setStatusView}
            activeCount={activeBatches.length}
            completedCount={completedBatches.length}
          />
        </header>

        {statusView === 'completed' && (
          <CompletedBatchesFilters
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            clientFilter={clientFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onClientChange={setClientFilter}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
          />
        )}

        {visible.length === 0 ? (
          <div className="rounded-xl bg-card p-12 text-center text-muted-foreground ring-1 ring-foreground/10">
            {emptyText}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((batch) => (
              <BatchCard key={batch.id} batch={batch} variant={statusView} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores nuevos en `dashboard/page.tsx`.

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev` y abrir `http://localhost:3000/dashboard`
Expected:
1. Hero con saludo + fecha en español, gradient navy → accent.
2. KPI cards con íconos coloreados.
3. Toggle "Lotes activos / Lotes completados" en una fila propia con contadores.
4. Tarjetas de lote en grid de 1/2/3/4 columnas según ancho.
5. "Lotes completados" muestra filtros con labels (Cliente, Desde, Hasta).
6. Cada tarjeta es clickeable: activos → `/batches/[id]`, completados → `/batches/[id]/report`.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): toggle unificado + grid de tarjetas a ancho completo"
```

---

## Task 9: Eliminar componentes obsoletos

**Files:**
- Delete: `src/components/dashboard/active-batches-tab.tsx`
- Delete: `src/components/dashboard/completed-batches-tab.tsx`

- [ ] **Step 1: Verificar que ya no se importen**

Run (PowerShell): `Get-ChildItem -Recurse src -Include *.tsx,*.ts | Select-String "active-batches-tab|completed-batches-tab|ActiveBatchesTab|CompletedBatchesTab"`
Expected: cero matches (Task 8 ya removió los imports).

- [ ] **Step 2: Eliminar archivos**

```powershell
Remove-Item src/components/dashboard/active-batches-tab.tsx
Remove-Item src/components/dashboard/completed-batches-tab.tsx
```

- [ ] **Step 3: Verificar build**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add -A src/components/dashboard/
git commit -m "chore(dashboard): eliminar tabs antiguas reemplazadas por BatchCard"
```

---

## Task 10: Crear log de cambios y actualizar índice

**Files:**
- Create: `vault/logs/2026-05-04-dashboard-containers-polish.md`
- Modify: `vault/_index.md` (sección "Notas del último procesamiento")

- [ ] **Step 1: Crear el log**

```markdown
---
title: Dashboard & Containers UI Polish
tags:
  - log
  - dashboard
  - containers
  - ui
date: 2026-05-04
---

# 2026-05-04 — Dashboard & Containers UI Polish

## Qué cambió

### Inventario de Envases (`/containers`)
- Filtros con labels visibles (Buscar envase, Cliente, Tipo de desecho, Tamaño) en grid responsive
- Ícono de búsqueda dentro del input
- Toda la fila de la tabla es clickeable (cursor pointer + ring de focus + Enter/Space)

### Dashboard (`/dashboard`)
- Hero decorativo con saludo + fecha en español
- KPI cards con íconos, acentos de color y blur sutil
- Tabs reemplazadas por `BatchStatusToggle` (segmented control) con contadores
- Diseño unificado de lote con `BatchCard` (variant `active` | `completed`)
- Grid responsive de 1/2/3/4 columnas — usa todo el ancho disponible
- Filtros de completados con labels (Cliente, Desde, Hasta)

## Archivos creados
- `src/components/dashboard/batch-card.tsx`
- `src/components/dashboard/batch-status-toggle.tsx`
- `src/components/dashboard/completed-batches-filters.tsx`
- `src/components/dashboard/dashboard-hero.tsx`

## Archivos modificados
- `src/components/containers/container-filters.tsx`
- `src/components/containers/container-table.tsx`
- `src/components/dashboard/metrics-cards.tsx`
- `src/app/dashboard/page.tsx`

## Archivos eliminados
- `src/components/dashboard/active-batches-tab.tsx`
- `src/components/dashboard/completed-batches-tab.tsx`

## Por qué
- El dashboard se sentía "muerto" y desperdiciaba ancho disponible.
- Activos y completados tenían diseños distintos sin razón funcional.
- Filtros sin labels obligaban al usuario a leer placeholders.
- Click solo en el serial no aprovechaba el target completo de la fila.
```

- [ ] **Step 2: Actualizar `vault/_index.md`**

En `vault/_index.md`, en la sección "Notas del último procesamiento", agregar al inicio:

```markdown
**2026-05-04** — Polish de Dashboard y Inventario de Envases.
Filas de envase clickeables en su totalidad, filtros con labels, dashboard de lotes unificado a ancho completo, hero decorativo y KPI cards renovadas.
Log: `logs/2026-05-04-dashboard-containers-polish.md`.
```

Y actualizar el campo `updated:` del frontmatter a `2026-05-04`.

- [ ] **Step 3: Commit**

```bash
git add vault/logs/2026-05-04-dashboard-containers-polish.md vault/_index.md
git commit -m "docs(vault): log del polish de dashboard y envases"
```

---

## Self-Review

**Spec coverage:**
- ✅ Click en toda la tarjeta del envase → Task 2
- ✅ Filtros con nombre (tipo de desecho, tamaño, cliente) → Tasks 1, 5
- ✅ Tarjetas de lotes activos/completados con diseño unificado → Task 4
- ✅ Selector en una fila propia, lotes ocupando todo el ancho debajo → Tasks 3, 8
- ✅ Avivar diseño con formas, colores, efectos visuales acorde al branding → Tasks 4, 6, 7

**Placeholder scan:** Sin TODOs, TBDs ni "implement later". Todos los pasos contienen el código completo.

**Type consistency:**
- `BatchStatusValue = 'active' | 'completed'` definido en Task 3, importado en Task 8.
- `BatchCard` recibe `{ batch, variant }` con `variant: 'active' | 'completed'` consistente con el state `statusView` en Task 8.
- `CompletedBatchesFilters` callbacks `onClientChange` / `onDateFromChange` / `onDateToChange` consistentes con los handlers del Task 8.
- `computeDashboardMetrics` preserva firma exacta en Task 7.
