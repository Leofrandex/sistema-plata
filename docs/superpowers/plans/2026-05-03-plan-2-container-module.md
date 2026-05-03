# Hospimed — Plan 2/4: Container Module

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Container Inventory page (list + search + filters) and the Container Detail page ("CRM del envase": lifeline progress bar, location history, time-in-phase metrics, photo gallery per phase, basic container info).

**Prerequisites:** Plan 1 complete. All types, mock data, Zustand store, and data access functions exist.

**Architecture:** Two new routes (`/containers` and `/containers/[id]`). Container phase logic already lives in `src/lib/data/containers.ts`. Components read from the Zustand store directly.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Zustand (existing store)

---

## File map

```
src/
├── app/
│   └── containers/
│       ├── page.tsx                          ← inventory: search + filters + table
│       └── [id]/page.tsx                     ← container detail / CRM
├── components/
│   └── containers/
│       ├── container-filters.tsx             ← client / waste type / size filter controls
│       ├── container-table.tsx               ← table with current location column
│       ├── container-lifeline.tsx            ← progress bar with phase markers
│       ├── phase-metrics.tsx                 ← time-in-phase cards
│       ├── location-history.tsx              ← ordered list of location reports
│       └── phase-photo-gallery.tsx           ← photos grouped by phase
└── __tests__/
    └── components/
        ├── container-lifeline.test.tsx
        └── phase-metrics.test.tsx
```

---

## Task 1: Container inventory page

**Files:**
- Create: `src/components/containers/container-filters.tsx`
- Create: `src/components/containers/container-table.tsx`
- Create: `src/app/containers/page.tsx`

- [ ] **Step 1: Create filter controls component**

Create `src/components/containers/container-filters.tsx`:

```tsx
'use client'

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

export function ContainerFilters({ filters, clients, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder="Buscar por número (ej: A-069)"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="w-56"
      />
      <Select
        value={filters.clientId}
        onValueChange={(v) => onChange({ ...filters, clientId: v })}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Todos los clientes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los clientes</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(filters.wasteType)}
        onValueChange={(v) => onChange({ ...filters, wasteType: v as WasteType | 'all' })}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Tipo de desecho" />
        </SelectTrigger>
        <SelectContent>
          {WASTE_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(filters.size)}
        onValueChange={(v) => onChange({ ...filters, size: v === 'all' ? 'all' : (Number(v) as ContainerSize) })}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Tamaño" />
        </SelectTrigger>
        <SelectContent>
          {SIZE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

- [ ] **Step 2: Create container table component**

Create `src/components/containers/container-table.tsx`:

```tsx
'use client'

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
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  if (containers.length === 0) {
    return <div className="text-center py-12 text-slate-400">No se encontraron envases.</div>
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-slate-500 text-left">
            <th className="px-4 py-3 font-medium">Envase</th>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Tamaño</th>
            <th className="px-4 py-3 font-medium">Fase actual</th>
            <th className="px-4 py-3 font-medium">Ubicación actual</th>
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

            return (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/containers/${c.id}`}
                    className="font-mono font-semibold text-blue-600 hover:underline"
                  >
                    {c.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{clientMap[c.client_id] ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{WASTE_LABELS[c.waste_type]}</td>
                <td className="px-4 py-3 text-slate-600">{c.size_liters} L</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{PHASE_LABELS[c.current_phase]}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{locationText}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Create container inventory page**

Create `src/app/containers/page.tsx`:

```tsx
'use client'

import { useState, useMemo } from 'react'
import { ContainerFilters } from '@/components/containers/container-filters'
import { ContainerTable } from '@/components/containers/container-table'
import { useStore } from '@/lib/store'
import { buildContainerWithPhase } from '@/lib/data/containers'
import type { ContainerFilters as Filters, ContainerSize, WasteType } from '@/components/containers/container-filters'
import type { ContainerWithPhase } from '@/lib/types'

const DEFAULT_FILTERS: Filters = {
  search: '',
  clientId: 'all',
  wasteType: 'all',
  size: 'all',
}

export default function ContainersPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const {
    containers, clients, exchangeEvents, receptions,
    storageEvents, treatmentRuns, externalTransfers, locations,
  } = useStore()

  const allContainersWithPhase: ContainerWithPhase[] = useMemo(() => {
    return containers
      .filter((c) => c.status === 'active')
      .map((container) => {
        const exchangeIds = exchangeEvents
          .filter((e) => e.dirty_containers_received.includes(container.id))
          .map((e) => e.id)
        const reception = [...receptions]
          .filter((r) => r.container_id === container.id)
          .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0] ?? null
        const storage = [...storageEvents]
          .filter((s) => s.container_id === container.id)
          .sort((a, b) => new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime())[0] ?? null
        const treatment = treatmentRuns.find((t) => t.container_id === container.id && !t.completed_at)
          ?? externalTransfers.find((t) => t.container_id === container.id && !t.transferred_at)
          ?? null
        const containerLocations = locations.filter((l) => l.container_id === container.id)
        return buildContainerWithPhase(container, exchangeIds, reception, storage, treatment, containerLocations)
      })
  }, [containers, exchangeEvents, receptions, storageEvents, treatmentRuns, externalTransfers, locations])

  const filtered = useMemo(() => {
    return allContainersWithPhase.filter((c) => {
      if (filters.search && !c.id.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.clientId !== 'all' && c.client_id !== filters.clientId) return false
      if (filters.wasteType !== 'all' && c.waste_type !== filters.wasteType) return false
      if (filters.size !== 'all' && c.size_liters !== filters.size) return false
      return true
    })
  }, [allContainersWithPhase, filters])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Inventario de Envases</h1>
        <span className="text-sm text-slate-500">{filtered.length} envases</span>
      </div>
      <ContainerFilters
        filters={filters}
        clients={clients}
        onChange={setFilters}
      />
      <ContainerTable
        containers={filtered}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify container inventory in browser**

```bash
npm run dev
```

Navigate to `http://localhost:3000/containers`. Expected:
- Table showing all active containers with ID, client, type, size, phase, and location
- Search by container number works
- Filters by client, waste type, and size work

- [ ] **Step 5: Commit**

```bash
git add src/app/containers/page.tsx src/components/containers/container-filters.tsx src/components/containers/container-table.tsx
git commit -m "feat: add container inventory page with search and filters"
```

---

## Task 2: Container lifeline component

**Files:**
- Create: `src/components/containers/container-lifeline.tsx`
- Create: `src/__tests__/components/container-lifeline.test.tsx`

- [ ] **Step 1: Write lifeline tests first**

Create `src/__tests__/components/container-lifeline.test.tsx`:

```typescript
import { getPhaseIndex, PHASES } from '@/components/containers/container-lifeline'
import type { ContainerPhase } from '@/lib/types'

describe('getPhaseIndex', () => {
  it('returns 0 for exchange', () => {
    expect(getPhaseIndex('exchange')).toBe(0)
  })

  it('returns the correct index for cold_storage', () => {
    expect(getPhaseIndex('cold_storage')).toBe(2)
  })

  it('returns last index for clean', () => {
    expect(getPhaseIndex('clean')).toBe(PHASES.length - 1)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- --testPathPattern=container-lifeline
```

Expected: FAIL.

- [ ] **Step 3: Create container lifeline component**

Create `src/components/containers/container-lifeline.tsx`:

```tsx
import type { ContainerPhase } from '@/lib/types'

export const PHASES: { key: ContainerPhase; label: string }[] = [
  { key: 'exchange', label: 'Intercambio' },
  { key: 'weighing', label: 'Pesaje' },
  { key: 'cold_storage', label: 'Cámara fría' },
  { key: 'treatment', label: 'Tratamiento' },
  { key: 'clean', label: 'Limpio' },
]

// For containers types 2-5, 'treatment' is replaced by 'transfer'
const TRANSFER_PHASES: { key: ContainerPhase; label: string }[] = [
  { key: 'exchange', label: 'Intercambio' },
  { key: 'weighing', label: 'Pesaje' },
  { key: 'cold_storage', label: 'Cámara fría' },
  { key: 'transfer', label: 'Traslado' },
  { key: 'clean', label: 'Limpio' },
]

export function getPhaseIndex(phase: ContainerPhase): number {
  const idx = PHASES.findIndex((p) => p.key === phase)
  return idx >= 0 ? idx : PHASES.length - 1
}

interface Props {
  currentPhase: ContainerPhase
  wasteType: string // determines treatment vs transfer
}

export function ContainerLifeline({ currentPhase, wasteType }: Props) {
  const phases = wasteType === 'infectious' ? PHASES : TRANSFER_PHASES
  const currentIndex = phases.findIndex((p) => p.key === currentPhase)
  const activeIndex = currentIndex >= 0 ? currentIndex : phases.length - 1

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="relative h-2 bg-slate-200 rounded-full mb-6">
        <div
          className="absolute h-2 bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${(activeIndex / (phases.length - 1)) * 100}%` }}
        />
        {/* Phase dots */}
        {phases.map((phase, idx) => {
          const isCompleted = idx < activeIndex
          const isCurrent = idx === activeIndex
          return (
            <div
              key={phase.key}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${(idx / (phases.length - 1)) * 100}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 ${
                  isCompleted
                    ? 'bg-blue-500 border-blue-500'
                    : isCurrent
                    ? 'bg-white border-blue-500 ring-2 ring-blue-200'
                    : 'bg-white border-slate-300'
                }`}
              />
            </div>
          )
        })}
      </div>
      {/* Phase labels */}
      <div className="flex justify-between">
        {phases.map((phase, idx) => {
          const isCompleted = idx < activeIndex
          const isCurrent = idx === activeIndex
          return (
            <div
              key={phase.key}
              className={`text-xs text-center flex-1 ${
                isCurrent
                  ? 'font-semibold text-blue-600'
                  : isCompleted
                  ? 'text-slate-500'
                  : 'text-slate-300'
              }`}
            >
              {phase.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run lifeline tests — expect pass**

```bash
npm test -- --testPathPattern=container-lifeline
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/containers/container-lifeline.tsx src/__tests__/components/container-lifeline.test.tsx
git commit -m "feat: add container lifeline progress bar with tests"
```

---

## Task 3: Phase metrics component

**Files:**
- Create: `src/components/containers/phase-metrics.tsx`
- Create: `src/__tests__/components/phase-metrics.test.tsx`

- [ ] **Step 1: Write phase metrics tests**

Create `src/__tests__/components/phase-metrics.test.tsx`:

```typescript
import { computePhaseMetrics } from '@/components/containers/phase-metrics'
import type { ContainerReception, StorageEvent } from '@/lib/types'

describe('computePhaseMetrics', () => {
  it('returns null duration when phase has no end time', () => {
    const reception: ContainerReception = {
      id: 'r-1', container_id: 'A-001', batch_id: 'b-1',
      arrived_at: '2026-05-03T09:00:00Z', gross_weight_kg: 43.7,
      operator_id: 'user-1', photo_ids: [],
    }
    const storage: StorageEvent = {
      id: 's-1', container_id: 'A-001', batch_id: 'b-1',
      entry_at: '2026-05-03T10:00:00Z', exit_at: null,
      operator_id: 'user-1', photo_ids: [],
    }
    const metrics = computePhaseMetrics(reception, storage, null)
    // cold_storage is ongoing
    expect(metrics.coldStorageDurationHours).toBeNull()
    // weighing took 1 hour (09:00 to 10:00)
    expect(metrics.weighingDurationHours).toBeCloseTo(1)
  })

  it('returns duration when storage is complete', () => {
    const reception: ContainerReception = {
      id: 'r-1', container_id: 'A-001', batch_id: 'b-1',
      arrived_at: '2026-05-03T09:00:00Z', gross_weight_kg: 43.7,
      operator_id: 'user-1', photo_ids: [],
    }
    const storage: StorageEvent = {
      id: 's-1', container_id: 'A-001', batch_id: 'b-1',
      entry_at: '2026-05-03T10:00:00Z', exit_at: '2026-05-03T14:00:00Z',
      operator_id: 'user-1', photo_ids: [],
    }
    const metrics = computePhaseMetrics(reception, storage, null)
    expect(metrics.coldStorageDurationHours).toBeCloseTo(4)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- --testPathPattern=phase-metrics
```

Expected: FAIL.

- [ ] **Step 3: Create phase metrics component**

Create `src/components/containers/phase-metrics.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ContainerReception, StorageEvent, TreatmentRun, ExternalTransfer } from '@/lib/types'

interface PhaseMetrics {
  weighingDurationHours: number | null    // time from reception to storage entry
  coldStorageDurationHours: number | null // time from storage entry to exit
  treatmentDurationHours: number | null   // time from treatment start to end
}

export function computePhaseMetrics(
  reception: ContainerReception | null,
  storage: StorageEvent | null,
  treatmentOrTransfer: TreatmentRun | ExternalTransfer | null
): PhaseMetrics {
  const hoursBetween = (start: string, end: string | null): number | null => {
    if (!end) return null
    return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60)
  }

  return {
    weighingDurationHours: reception && storage
      ? hoursBetween(reception.arrived_at, storage.entry_at)
      : null,
    coldStorageDurationHours: storage
      ? hoursBetween(storage.entry_at, storage.exit_at)
      : null,
    treatmentDurationHours: treatmentOrTransfer
      ? (() => {
          if ('started_at' in treatmentOrTransfer) {
            return hoursBetween(treatmentOrTransfer.started_at, treatmentOrTransfer.completed_at)
          }
          return hoursBetween(
            (treatmentOrTransfer as ExternalTransfer).storage_started_at,
            (treatmentOrTransfer as ExternalTransfer).transferred_at
          )
        })()
      : null,
  }
}

function formatHours(hours: number | null): string {
  if (hours === null) return 'En curso'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  return `${hours.toFixed(1)} h`
}

interface Props {
  reception: ContainerReception | null
  storage: StorageEvent | null
  treatmentOrTransfer: TreatmentRun | ExternalTransfer | null
}

export function PhaseMetrics({ reception, storage, treatmentOrTransfer }: Props) {
  const metrics = computePhaseMetrics(reception, storage, treatmentOrTransfer)

  const cards = [
    { label: 'Pesaje → Cámara fría', value: metrics.weighingDurationHours },
    { label: 'Tiempo en cámara fría', value: metrics.coldStorageDurationHours },
    { label: 'Tratamiento / Traslado', value: metrics.treatmentDurationHours },
  ].filter(({ value }, idx) => {
    // Only show cards for phases that have data or are in progress
    if (idx === 0 && !reception) return false
    if (idx === 1 && !storage) return false
    if (idx === 2 && !treatmentOrTransfer) return false
    return true
  })

  if (cards.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-600 mb-3">Tiempo por fase</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(({ label, value }) => (
          <Card key={label} className="border-slate-100">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-slate-500">{label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-xl font-semibold text-slate-800">{formatHours(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run phase metrics tests — expect pass**

```bash
npm test -- --testPathPattern=phase-metrics
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/containers/phase-metrics.tsx src/__tests__/components/phase-metrics.test.tsx
git commit -m "feat: add phase duration metrics component with tests"
```

---

## Task 4: Location history and photo gallery components

**Files:**
- Create: `src/components/containers/location-history.tsx`
- Create: `src/components/containers/phase-photo-gallery.tsx`

- [ ] **Step 1: Create location history component**

Create `src/components/containers/location-history.tsx`:

```tsx
import { MapPin } from 'lucide-react'
import type { ContainerLocation } from '@/lib/types'

const LOCATION_TYPE_LABELS: Record<string, string> = {
  client_site: 'Instalación del cliente',
  plant_storage: 'Planta — almacén',
  cold_storage: 'Planta — cámara fría',
  treatment: 'Planta — tratamiento',
}

interface Props {
  locations: ContainerLocation[]
  clientNames: Record<string, string> // clientId → name
}

export function LocationHistory({ locations, clientNames }: Props) {
  const sorted = [...locations].sort(
    (a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
  )

  if (sorted.length === 0) {
    return <p className="text-sm text-slate-400">Sin registros de ubicación.</p>
  }

  return (
    <ol className="relative border-l border-slate-200 space-y-4 ml-2">
      {sorted.map((loc, idx) => {
        const isLatest = idx === 0
        const detail =
          loc.location_type === 'client_site'
            ? [clientNames[loc.client_id ?? ''], `Piso ${loc.floor}`, loc.area]
                .filter(Boolean)
                .join(' · ')
            : LOCATION_TYPE_LABELS[loc.location_type] ?? loc.location_type

        return (
          <li key={loc.id} className="pl-4">
            <div
              className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border ${
                isLatest ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'
              }`}
            />
            <p className={`text-sm font-medium ${isLatest ? 'text-blue-700' : 'text-slate-700'}`}>
              {detail}
              {isLatest && (
                <span className="ml-2 text-xs font-normal bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                  Actual
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(loc.reported_at).toLocaleString('es-PA')}
              {loc.notes && <> · {loc.notes}</>}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
```

- [ ] **Step 2: Create phase photo gallery component**

Create `src/components/containers/phase-photo-gallery.tsx`:

```tsx
import Image from 'next/image'
import type { Photo, PhotoEventType } from '@/lib/types'

const SECTION_LABELS: Record<PhotoEventType, string> = {
  exchange: 'Intercambio en punto de encuentro',
  weighing: 'Pesaje en planta',
  storage: 'Cámara fría',
  treatment: 'Tratamiento',
  other: 'Otros',
}

interface Props {
  photos: Photo[]
}

export function PhasePhotoGallery({ photos }: Props) {
  if (photos.length === 0) {
    return <p className="text-sm text-slate-400">Sin registro fotográfico.</p>
  }

  // Group by event_type
  const grouped = photos.reduce<Record<string, Photo[]>>((acc, photo) => {
    const key = photo.event_type
    if (!acc[key]) acc[key] = []
    acc[key].push(photo)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {(Object.entries(grouped) as [PhotoEventType, Photo[]][]).map(([eventType, eventPhotos]) => (
        <div key={eventType}>
          <h4 className="text-sm font-semibold text-slate-600 mb-3">
            {SECTION_LABELS[eventType]}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {eventPhotos.map((photo) => (
              <div key={photo.id} className="space-y-1">
                <div className="relative aspect-[4/3] rounded-lg overflow-hidden border bg-slate-100">
                  <Image
                    src={photo.url}
                    alt={photo.label}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>
                <p className="text-xs text-slate-400 truncate">{photo.label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Allow external image domains in Next.js config**

In `next.config.ts` (or `next.config.js`), add:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 4: Commit**

```bash
git add src/components/containers/location-history.tsx src/components/containers/phase-photo-gallery.tsx next.config.ts
git commit -m "feat: add location history timeline and phase photo gallery"
```

---

## Task 5: Container detail page ("CRM del envase")

**Files:**
- Create: `src/app/containers/[id]/page.tsx`

- [ ] **Step 1: Create container detail page**

Create `src/app/containers/[id]/page.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContainerLifeline } from '@/components/containers/container-lifeline'
import { PhaseMetrics } from '@/components/containers/phase-metrics'
import { LocationHistory } from '@/components/containers/location-history'
import { PhasePhotoGallery } from '@/components/containers/phase-photo-gallery'
import { useStore } from '@/lib/store'
import { buildContainerWithPhase } from '@/lib/data/containers'

const WASTE_TYPE_LABELS: Record<string, string> = {
  infectious: 'Peligroso infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

interface Props {
  params: { id: string }
}

export default function ContainerDetailPage({ params }: Props) {
  const {
    containers, clients, exchangeEvents, receptions,
    storageEvents, treatmentRuns, externalTransfers, locations, photos,
  } = useStore()

  const container = containers.find((c) => c.id === params.id)
  if (!container) notFound()

  const client = clients.find((c) => c.id === container.client_id)!

  const exchangeIds = exchangeEvents
    .filter((e) => e.dirty_containers_received.includes(container.id))
    .map((e) => e.id)

  const reception = useMemo(() => {
    return [...receptions]
      .filter((r) => r.container_id === container.id)
      .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0] ?? null
  }, [receptions, container.id])

  const storage = useMemo(() => {
    return [...storageEvents]
      .filter((s) => s.container_id === container.id)
      .sort((a, b) => new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime())[0] ?? null
  }, [storageEvents, container.id])

  const treatment = useMemo(() => {
    return treatmentRuns.find((t) => t.container_id === container.id)
      ?? externalTransfers.find((t) => t.container_id === container.id)
      ?? null
  }, [treatmentRuns, externalTransfers, container.id])

  const containerLocations = useMemo(
    () => locations.filter((l) => l.container_id === container.id),
    [locations, container.id]
  )

  const containerWithPhase = buildContainerWithPhase(
    container, exchangeIds, reception, storage, treatment, containerLocations
  )

  // Collect all photo IDs for this container across all events
  const containerPhotoIds = [
    ...(exchangeEvents.flatMap((e) => {
      if (e.dirty_containers_received.includes(container.id) || e.clean_containers_given.includes(container.id)) {
        return e.photo_ids
      }
      return []
    })),
    ...(reception?.photo_ids ?? []),
    ...(storage?.photo_ids ?? []),
  ]
  const containerPhotos = photos.filter((p) => containerPhotoIds.includes(p.id))

  const clientNameMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/containers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-800">{container.id}</h1>
          <p className="text-sm text-slate-500">{client.name}</p>
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-600">Información del envase</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Número</dt>
              <dd className="font-mono font-semibold">{container.id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Cliente</dt>
              <dd className="font-medium">{client.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tipo de desecho</dt>
              <dd className="font-medium">{WASTE_TYPE_LABELS[container.waste_type]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tamaño</dt>
              <dd className="font-medium">{container.size_liters} L</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tara</dt>
              <dd className="font-medium">{container.tare_weight_kg} kg</dd>
            </div>
            {containerWithPhase.latest_net_weight_kg !== null && (
              <div>
                <dt className="text-slate-500">Peso neto (último lote)</dt>
                <dd className="font-semibold text-slate-800">{containerWithPhase.latest_net_weight_kg} kg</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Lifeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-600">Línea de vida</CardTitle>
        </CardHeader>
        <CardContent>
          <ContainerLifeline
            currentPhase={containerWithPhase.current_phase}
            wasteType={container.waste_type}
          />
        </CardContent>
      </Card>

      {/* Phase metrics */}
      <PhaseMetrics
        reception={reception}
        storage={storage}
        treatmentOrTransfer={treatment}
      />

      {/* Location history */}
      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-3">Historial de ubicaciones</h3>
        <LocationHistory locations={containerLocations} clientNames={clientNameMap} />
      </div>

      {/* Photo gallery */}
      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-3">Registro fotográfico</h3>
        <PhasePhotoGallery photos={containerPhotos} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify container detail in browser**

Navigate to `http://localhost:3000/containers/A-001`. Expected:
- Header: "A-001 · Ciudad de la Salud"
- Basic info card with all fields
- Lifeline progress bar showing current phase (should be `cold_storage` based on mock data)
- Phase metrics cards showing weighing duration
- Location history timeline showing 2 entries (client site → plant storage)
- Photo gallery showing photos grouped by phase

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: PASS — all tests.

- [ ] **Step 4: Commit**

```bash
git add src/app/containers/ src/components/containers/
git commit -m "feat: complete container detail page with lifeline, metrics, locations, photos"
```

---

## Verification checklist — Plan 2 complete

- [ ] `npm test` — all tests pass
- [ ] `npm run build` — no TypeScript or build errors

```bash
npm run build
```

- [ ] Browser check:
  1. `/containers` → table with 9 containers, all filters work, search by `A-0` narrows results
  2. `/containers/A-001` → full detail page: lifeline at `cold_storage`, 2 location entries, photos in weighing section
  3. `/containers/B-001` → clean container with no events (phase = `clean`, no metrics, no photos)
  4. Click container row in `/batches/batch-1` → navigates correctly to container detail

- [ ] Final commit

```bash
git add .
git commit -m "chore: Plan 2 complete — container inventory and detail pages"
```
