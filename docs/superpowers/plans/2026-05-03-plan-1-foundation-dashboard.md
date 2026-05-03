# Hospimed — Plan 1/4: Foundation + Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Next.js project, define all TypeScript types, create the mock data layer, set up navigation, and build the Dashboard (metrics, active batches tab, completed batches tab) and Batch detail page.

**Architecture:** Next.js 14 App Router with TypeScript. All data lives in a Zustand store populated with mock data — no backend calls yet. Supabase integration is Plan 4. Components are built with Tailwind + shadcn/ui. Tests use Jest + React Testing Library.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Jest, React Testing Library

**Spec:** `docs/superpowers/specs/2026-05-03-hospimed-waste-tracking-design.md`

---

## File map

```
src/
├── app/
│   ├── layout.tsx                        ← root layout with sidebar nav
│   ├── page.tsx                          ← redirect to /dashboard
│   ├── login/page.tsx                    ← login form (no auth logic yet)
│   ├── dashboard/page.tsx                ← dashboard with tabs
│   └── batches/[id]/page.tsx             ← batch detail: list of containers + phase
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx                   ← side navigation
│   │   └── mobile-header.tsx             ← top bar on mobile
│   ├── dashboard/
│   │   ├── metrics-cards.tsx             ← key metrics row
│   │   ├── active-batches-tab.tsx        ← list of active batches
│   │   └── completed-batches-tab.tsx     ← filterable list of completed batches
│   └── batches/
│       └── batch-containers-list.tsx     ← containers in a batch with current phase
├── lib/
│   ├── types.ts                          ← all TypeScript interfaces and enums
│   ├── mock-data.ts                      ← seed data (clients, containers, batches, events)
│   ├── store.ts                          ← Zustand store
│   └── data/
│       ├── batches.ts                    ← batch queries
│       ├── containers.ts                 ← container queries + phase computation
│       └── clients.ts                    ← client queries
└── __tests__/
    ├── lib/
    │   ├── containers.test.ts            ← phase logic, weight calculation
    │   └── batches.test.ts              ← batch queries
    └── components/
        └── metrics-cards.test.tsx        ← metrics computation
```

---

## Task 1: Initialize Next.js project

**Files:**
- Create: project root (current directory)

- [ ] **Step 1: Initialize Next.js with App Router**

Run from `C:\Users\sebastian.castro\Documents\Hospitalar\sistema-hospimed`:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

When prompted: accept all defaults. This creates `src/app/`, `src/app/layout.tsx`, `src/app/page.tsx`, `tailwind.config.ts`, `tsconfig.json`.

- [ ] **Step 2: Verify the project starts**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000`, no errors in terminal.

- [ ] **Step 3: Commit**

```bash
git init
git add .
git commit -m "chore: initialize Next.js 14 project with TypeScript and Tailwind"
```

---

## Task 2: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install zustand idb @react-pdf/renderer
```

- [ ] **Step 2: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 3: Add shadcn components used in this plan**

```bash
npx shadcn@latest add button card tabs badge input select table
```

- [ ] **Step 4: Install test dependencies**

```bash
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest
```

- [ ] **Step 5: Create Jest config**

Create `jest.config.ts`:

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

Create `jest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 7: Verify tests run**

Create `src/__tests__/smoke.test.ts`:

```typescript
describe('smoke', () => {
  it('jest is configured', () => {
    expect(true).toBe(true)
  })
})
```

Run:
```bash
npm test
```

Expected: 1 test passes.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: install zustand, shadcn/ui, idb, react-pdf, jest"
```

---

## Task 3: Define TypeScript types

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/__tests__/lib/types.test.ts`

- [ ] **Step 1: Write type tests first**

Create `src/__tests__/lib/types.test.ts`:

```typescript
import type {
  WasteType,
  ContainerSize,
  ContainerPhase,
  Container,
  Batch,
  ContainerReception,
} from '@/lib/types'

describe('types', () => {
  it('Container id follows client-letter-number format', () => {
    const c: Container = {
      id: 'A-069',
      client_id: 'client-1',
      size_liters: 240,
      tare_weight_kg: 15.5,
      waste_type: 'infectious',
      status: 'active',
      registered_at: '2026-01-01T00:00:00Z',
    }
    expect(c.id).toMatch(/^[A-Z]-\d+$/)
  })

  it('ContainerReception net weight is computable', () => {
    const tare = 15.5
    const gross = 45.2
    const net = gross - tare
    expect(net).toBeCloseTo(29.7)
  })
})
```

- [ ] **Step 2: Run tests — expect failure (types not defined yet)**

```bash
npm test -- --testPathPattern=types
```

Expected: FAIL — "Cannot find module '@/lib/types'"

- [ ] **Step 3: Create `src/lib/types.ts`**

```typescript
// ─── Enums ────────────────────────────────────────────────────────────────────

export type WasteType =
  | 'infectious'          // 1 — Peligroso infeccioso (treated on-site)
  | 'anatomopathological' // 2 — Anatomopatológico (external transfer)
  | 'cytotoxic'           // 3 — Citotóxico (external transfer)
  | 'liquid'              // 4 — Líquidos (external transfer)
  | 'morgue'              // 5 — Morgue (external transfer)

export type ContainerSize = 240 | 750 | 1100

export type ContainerStatus = 'active' | 'decommissioned'

export type BatchStatus = 'active' | 'completed'

export type LocationType =
  | 'client_site'
  | 'plant_storage'
  | 'cold_storage'
  | 'treatment'

export type PhotoEventType =
  | 'exchange'
  | 'weighing'
  | 'storage'
  | 'treatment'
  | 'other'

// Phase of the container in its current lifecycle
export type ContainerPhase =
  | 'exchange'     // delivered clean / collected dirty — in transit to plant
  | 'weighing'     // weighed at plant, waiting for cold storage
  | 'cold_storage' // in cold storage room
  | 'treatment'    // type 1: being treated on-site
  | 'transfer'     // types 2–5: stored temporarily / transferred to external center
  | 'clean'        // cycle complete, available for redeployment

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface ClientLocation {
  floor: string
  area: string
}

export interface Client {
  id: string
  name: string
  code_letter: string // single uppercase letter, prefix for container IDs
  locations: ClientLocation[]
}

export interface Container {
  id: string             // format: '{letter}-{number}', e.g. 'A-069'
  client_id: string
  size_liters: ContainerSize
  tare_weight_kg: number
  waste_type: WasteType
  status: ContainerStatus
  registered_at: string  // ISO 8601 datetime
}

export interface Batch {
  id: string
  client_id: string
  date: string           // ISO 8601 date, e.g. '2026-05-03'
  status: BatchStatus
  container_ids: string[]
}

export interface Photo {
  id: string
  url: string
  event_type: PhotoEventType
  event_id: string
  taken_at: string       // ISO 8601 datetime
  label: string          // e.g. 'PTDP Ciudad Salud 01/03/2026 09:40 PM'
}

export interface ExchangeEvent {
  id: string
  batch_id: string
  timestamp: string
  operator_id: string
  clean_containers_given: string[]    // container IDs
  dirty_containers_received: string[] // container IDs
  location: string
  photo_ids: string[]
}

export interface ContainerReception {
  id: string
  container_id: string
  batch_id: string
  arrived_at: string
  gross_weight_kg: number
  // net_weight_kg is computed: gross_weight_kg - container.tare_weight_kg
  operator_id: string
  photo_ids: string[]
}

export interface StorageEvent {
  id: string
  container_id: string
  batch_id: string
  entry_at: string
  exit_at: string | null
  operator_id: string
  photo_ids: string[]
}

export interface TreatmentRun {
  id: string
  container_id: string
  batch_id: string
  started_at: string
  completed_at: string | null
  operator_id: string
}

export interface ExternalTransfer {
  id: string
  container_id: string
  batch_id: string
  storage_started_at: string
  transferred_at: string | null
  destination: string
  operator_id: string
}

export interface ContainerLocation {
  id: string
  container_id: string
  reported_at: string
  operator_id: string
  location_type: LocationType
  client_id: string | null
  floor: string | null
  area: string | null
  notes: string | null
}

export interface User {
  id: string
  name: string
}

// ─── Derived / view types ─────────────────────────────────────────────────────

export interface ContainerWithPhase extends Container {
  current_phase: ContainerPhase
  current_location: ContainerLocation | null
  latest_net_weight_kg: number | null
}

export interface BatchWithClient extends Batch {
  client: Client
  next_pending_step: ContainerPhase // earliest phase with incomplete containers
  container_count: number
}
```

- [ ] **Step 4: Run type tests — expect pass**

```bash
npm test -- --testPathPattern=types
```

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/__tests__/lib/types.test.ts
git commit -m "feat: define all TypeScript types for Hospimed domain"
```

---

## Task 4: Create mock data

**Files:**
- Create: `src/lib/mock-data.ts`

- [ ] **Step 1: Create mock seed data**

Create `src/lib/mock-data.ts`:

```typescript
import type {
  Client,
  Container,
  Batch,
  ExchangeEvent,
  ContainerReception,
  StorageEvent,
  TreatmentRun,
  ExternalTransfer,
  ContainerLocation,
  User,
  Photo,
} from './types'

export const MOCK_USERS: User[] = [
  { id: 'user-1', name: 'Carlos Méndez' },
  { id: 'user-2', name: 'Ana Torres' },
]

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'client-1',
    name: 'Ciudad de la Salud',
    code_letter: 'A',
    locations: [
      { floor: '1', area: 'Emergencias' },
      { floor: '2', area: 'Pediatría' },
      { floor: '3', area: 'UCI' },
    ],
  },
  {
    id: 'client-2',
    name: 'Agua Dulce',
    code_letter: 'B',
    locations: [
      { floor: '1', area: 'Consulta Externa' },
      { floor: '2', area: 'Cirugía' },
    ],
  },
  {
    id: 'client-3',
    name: 'Hospital Santo Tomás',
    code_letter: 'C',
    locations: [
      { floor: '1', area: 'Urgencias' },
      { floor: '4', area: 'Oncología' },
    ],
  },
]

export const MOCK_CONTAINERS: Container[] = [
  // Client A — Ciudad de la Salud
  { id: 'A-001', client_id: 'client-1', size_liters: 240, tare_weight_kg: 14.2, waste_type: 'infectious', status: 'active', registered_at: '2026-01-15T08:00:00Z' },
  { id: 'A-002', client_id: 'client-1', size_liters: 240, tare_weight_kg: 14.5, waste_type: 'infectious', status: 'active', registered_at: '2026-01-15T08:00:00Z' },
  { id: 'A-003', client_id: 'client-1', size_liters: 750, tare_weight_kg: 38.1, waste_type: 'anatomopathological', status: 'active', registered_at: '2026-01-15T08:00:00Z' },
  { id: 'A-004', client_id: 'client-1', size_liters: 240, tare_weight_kg: 13.9, waste_type: 'cytotoxic', status: 'active', registered_at: '2026-01-20T08:00:00Z' },
  { id: 'A-005', client_id: 'client-1', size_liters: 1100, tare_weight_kg: 62.0, waste_type: 'infectious', status: 'active', registered_at: '2026-02-01T08:00:00Z' },
  // Client B — Agua Dulce
  { id: 'B-001', client_id: 'client-2', size_liters: 240, tare_weight_kg: 14.1, waste_type: 'infectious', status: 'active', registered_at: '2026-01-20T08:00:00Z' },
  { id: 'B-002', client_id: 'client-2', size_liters: 240, tare_weight_kg: 14.3, waste_type: 'morgue', status: 'active', registered_at: '2026-01-20T08:00:00Z' },
  // Client C — Santo Tomás
  { id: 'C-001', client_id: 'client-3', size_liters: 750, tare_weight_kg: 37.8, waste_type: 'infectious', status: 'active', registered_at: '2026-02-10T08:00:00Z' },
  { id: 'C-002', client_id: 'client-3', size_liters: 240, tare_weight_kg: 14.0, waste_type: 'liquid', status: 'active', registered_at: '2026-02-10T08:00:00Z' },
]

export const MOCK_BATCHES: Batch[] = [
  // Active batch — client 1
  { id: 'batch-1', client_id: 'client-1', date: '2026-05-03', status: 'active', container_ids: ['A-001', 'A-002', 'A-003', 'A-004', 'A-005'] },
  // Active batch — client 2
  { id: 'batch-2', client_id: 'client-2', date: '2026-05-03', status: 'active', container_ids: ['B-001', 'B-002'] },
  // Completed batch — client 1 (yesterday)
  { id: 'batch-3', client_id: 'client-1', date: '2026-05-02', status: 'completed', container_ids: ['A-001', 'A-002'] },
  // Completed batch — client 3
  { id: 'batch-4', client_id: 'client-3', date: '2026-04-30', status: 'completed', container_ids: ['C-001', 'C-002'] },
]

export const MOCK_EXCHANGE_EVENTS: ExchangeEvent[] = [
  {
    id: 'exchange-1',
    batch_id: 'batch-1',
    timestamp: '2026-05-03T07:30:00Z',
    operator_id: 'user-1',
    clean_containers_given: ['A-001', 'A-002'],
    dirty_containers_received: ['A-001', 'A-002'],
    location: 'Puerta de Emergencias, piso 1',
    photo_ids: ['photo-1', 'photo-2'],
  },
]

export const MOCK_RECEPTIONS: ContainerReception[] = [
  {
    id: 'reception-1',
    container_id: 'A-001',
    batch_id: 'batch-1',
    arrived_at: '2026-05-03T09:15:00Z',
    gross_weight_kg: 43.7,
    operator_id: 'user-1',
    photo_ids: ['photo-3', 'photo-4'],
  },
  {
    id: 'reception-2',
    container_id: 'A-002',
    batch_id: 'batch-1',
    arrived_at: '2026-05-03T09:20:00Z',
    gross_weight_kg: 38.2,
    operator_id: 'user-1',
    photo_ids: ['photo-5', 'photo-6'],
  },
]

export const MOCK_STORAGE_EVENTS: StorageEvent[] = [
  {
    id: 'storage-1',
    container_id: 'A-001',
    batch_id: 'batch-1',
    entry_at: '2026-05-03T10:00:00Z',
    exit_at: null,
    operator_id: 'user-2',
    photo_ids: ['photo-7'],
  },
]

export const MOCK_TREATMENT_RUNS: TreatmentRun[] = []

export const MOCK_EXTERNAL_TRANSFERS: ExternalTransfer[] = []

export const MOCK_LOCATIONS: ContainerLocation[] = [
  {
    id: 'loc-1',
    container_id: 'A-001',
    reported_at: '2026-05-03T07:30:00Z',
    operator_id: 'user-1',
    location_type: 'client_site',
    client_id: 'client-1',
    floor: '2',
    area: 'Pediatría',
    notes: null,
  },
  {
    id: 'loc-2',
    container_id: 'A-001',
    reported_at: '2026-05-03T09:15:00Z',
    operator_id: 'user-1',
    location_type: 'plant_storage',
    client_id: null,
    floor: null,
    area: null,
    notes: 'Llegó a planta para pesaje',
  },
]

export const MOCK_PHOTOS: Photo[] = [
  { id: 'photo-1', url: 'https://placehold.co/400x300?text=Exchange+Clean', event_type: 'exchange', event_id: 'exchange-1', taken_at: '2026-05-03T07:30:00Z', label: 'PTDP Ciudad Salud 03/05/2026 07:30 AM' },
  { id: 'photo-2', url: 'https://placehold.co/400x300?text=Exchange+Dirty', event_type: 'exchange', event_id: 'exchange-1', taken_at: '2026-05-03T07:32:00Z', label: 'PTDP Ciudad Salud 03/05/2026 07:32 AM' },
  { id: 'photo-3', url: 'https://placehold.co/400x300?text=Container+A-001', event_type: 'weighing', event_id: 'reception-1', taken_at: '2026-05-03T09:15:00Z', label: 'PTDP Ciudad Salud 03/05/2026 09:15 AM' },
  { id: 'photo-4', url: 'https://placehold.co/400x300?text=Scale+43.7kg', event_type: 'weighing', event_id: 'reception-1', taken_at: '2026-05-03T09:16:00Z', label: 'PTDP Ciudad Salud 03/05/2026 09:16 AM' },
  { id: 'photo-5', url: 'https://placehold.co/400x300?text=Container+A-002', event_type: 'weighing', event_id: 'reception-2', taken_at: '2026-05-03T09:20:00Z', label: 'PTDP Ciudad Salud 03/05/2026 09:20 AM' },
  { id: 'photo-6', url: 'https://placehold.co/400x300?text=Scale+38.2kg', event_type: 'weighing', event_id: 'reception-2', taken_at: '2026-05-03T09:21:00Z', label: 'PTDP Ciudad Salud 03/05/2026 09:21 AM' },
  { id: 'photo-7', url: 'https://placehold.co/400x300?text=Cold+Storage', event_type: 'storage', event_id: 'storage-1', taken_at: '2026-05-03T10:00:00Z', label: 'PTDP Ciudad Salud 03/05/2026 10:00 AM' },
]
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/mock-data.ts
git commit -m "feat: add mock seed data (clients, containers, batches, events)"
```

---

## Task 5: Create Zustand store and data access layer

**Files:**
- Create: `src/lib/store.ts`
- Create: `src/lib/data/containers.ts`
- Create: `src/lib/data/batches.ts`
- Create: `src/lib/data/clients.ts`
- Create: `src/__tests__/lib/containers.test.ts`
- Create: `src/__tests__/lib/batches.test.ts`

- [ ] **Step 1: Write container data tests first**

Create `src/__tests__/lib/containers.test.ts`:

```typescript
import {
  computeContainerPhase,
  computeNetWeight,
  getContainerCurrentLocation,
} from '@/lib/data/containers'
import type {
  Container,
  ContainerReception,
  StorageEvent,
  TreatmentRun,
  ExternalTransfer,
  ContainerLocation,
} from '@/lib/types'

const baseContainer: Container = {
  id: 'A-001',
  client_id: 'client-1',
  size_liters: 240,
  tare_weight_kg: 14.2,
  waste_type: 'infectious',
  status: 'active',
  registered_at: '2026-01-01T00:00:00Z',
}

describe('computeContainerPhase', () => {
  it('returns clean when no events exist', () => {
    expect(computeContainerPhase([], null, null, null)).toBe('clean')
  })

  it('returns exchange when only exchange event exists', () => {
    const reception: ContainerReception | null = null
    const storage: StorageEvent | null = null
    const treatment: TreatmentRun | null = null
    expect(computeContainerPhase(['exchange-1'], reception, storage, treatment)).toBe('exchange')
  })

  it('returns weighing when reception exists but no storage', () => {
    const reception: ContainerReception = {
      id: 'r-1', container_id: 'A-001', batch_id: 'b-1',
      arrived_at: '2026-05-03T09:00:00Z', gross_weight_kg: 43.7,
      operator_id: 'user-1', photo_ids: [],
    }
    expect(computeContainerPhase(['exchange-1'], reception, null, null)).toBe('weighing')
  })

  it('returns cold_storage when storage event has no exit', () => {
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
    expect(computeContainerPhase(['exchange-1'], reception, storage, null)).toBe('cold_storage')
  })

  it('returns clean when treatment is completed', () => {
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
    const treatment: TreatmentRun = {
      id: 't-1', container_id: 'A-001', batch_id: 'b-1',
      started_at: '2026-05-03T14:00:00Z', completed_at: '2026-05-03T15:00:00Z',
      operator_id: 'user-1',
    }
    expect(computeContainerPhase(['exchange-1'], reception, storage, treatment)).toBe('clean')
  })
})

describe('computeNetWeight', () => {
  it('returns gross minus tare', () => {
    expect(computeNetWeight(43.7, 14.2)).toBeCloseTo(29.5)
  })
})

describe('getContainerCurrentLocation', () => {
  it('returns null when no locations exist', () => {
    expect(getContainerCurrentLocation([])).toBeNull()
  })

  it('returns the most recent location', () => {
    const locations: ContainerLocation[] = [
      { id: 'loc-1', container_id: 'A-001', reported_at: '2026-05-03T07:00:00Z', operator_id: 'user-1', location_type: 'client_site', client_id: 'client-1', floor: '2', area: 'Pediatría', notes: null },
      { id: 'loc-2', container_id: 'A-001', reported_at: '2026-05-03T09:00:00Z', operator_id: 'user-1', location_type: 'plant_storage', client_id: null, floor: null, area: null, notes: null },
    ]
    const result = getContainerCurrentLocation(locations)
    expect(result?.id).toBe('loc-2')
    expect(result?.location_type).toBe('plant_storage')
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- --testPathPattern=containers
```

Expected: FAIL — "Cannot find module '@/lib/data/containers'"

- [ ] **Step 3: Create `src/lib/data/containers.ts`**

```typescript
import type {
  Container,
  ContainerLocation,
  ContainerPhase,
  ContainerReception,
  ContainerWithPhase,
  StorageEvent,
  TreatmentRun,
  ExternalTransfer,
} from '@/lib/types'

export function computeNetWeight(
  gross_weight_kg: number,
  tare_weight_kg: number
): number {
  return Math.round((gross_weight_kg - tare_weight_kg) * 100) / 100
}

export function getContainerCurrentLocation(
  locations: ContainerLocation[]
): ContainerLocation | null {
  if (locations.length === 0) return null
  return [...locations].sort(
    (a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
  )[0]
}

// Determines which phase a container is currently in.
// exchangeEventIds: IDs of ExchangeEvents where this container appears in dirty_containers_received.
export function computeContainerPhase(
  exchangeEventIds: string[],
  reception: ContainerReception | null,
  storage: StorageEvent | null,
  treatmentOrTransfer: TreatmentRun | ExternalTransfer | null
): ContainerPhase {
  if (!reception && exchangeEventIds.length === 0) return 'clean'
  if (!reception) return 'exchange'
  if (!storage) return 'weighing'
  if (!storage.exit_at) return 'cold_storage'
  if (!treatmentOrTransfer) return 'cold_storage' // exited storage but no treatment yet
  if ('completed_at' in treatmentOrTransfer) {
    // TreatmentRun
    return treatmentOrTransfer.completed_at ? 'clean' : 'treatment'
  }
  // ExternalTransfer
  return (treatmentOrTransfer as ExternalTransfer).transferred_at ? 'clean' : 'transfer'
}

export function buildContainerWithPhase(
  container: Container,
  exchangeEventIds: string[],
  reception: ContainerReception | null,
  storage: StorageEvent | null,
  treatmentOrTransfer: TreatmentRun | ExternalTransfer | null,
  locations: ContainerLocation[]
): ContainerWithPhase {
  return {
    ...container,
    current_phase: computeContainerPhase(exchangeEventIds, reception, storage, treatmentOrTransfer),
    current_location: getContainerCurrentLocation(locations),
    latest_net_weight_kg: reception
      ? computeNetWeight(reception.gross_weight_kg, container.tare_weight_kg)
      : null,
  }
}
```

- [ ] **Step 4: Run container tests — expect pass**

```bash
npm test -- --testPathPattern=containers
```

Expected: PASS — all tests.

- [ ] **Step 5: Write batch tests**

Create `src/__tests__/lib/batches.test.ts`:

```typescript
import { computeNextPendingStep } from '@/lib/data/batches'
import type { ContainerPhase } from '@/lib/types'

describe('computeNextPendingStep', () => {
  it('returns exchange when all containers are clean', () => {
    const phases: ContainerPhase[] = ['clean', 'clean', 'clean']
    expect(computeNextPendingStep(phases)).toBe('exchange')
  })

  it('returns the earliest incomplete phase', () => {
    const phases: ContainerPhase[] = ['cold_storage', 'weighing', 'exchange']
    expect(computeNextPendingStep(phases)).toBe('exchange')
  })

  it('returns clean when all containers are clean', () => {
    const phases: ContainerPhase[] = ['clean', 'clean']
    // All done — next step is exchange (new cycle)
    expect(computeNextPendingStep(phases)).toBe('exchange')
  })
})
```

- [ ] **Step 6: Run batch tests — expect failure**

```bash
npm test -- --testPathPattern=batches
```

Expected: FAIL — "Cannot find module '@/lib/data/batches'"

- [ ] **Step 7: Create `src/lib/data/batches.ts`**

```typescript
import type { ContainerPhase } from '@/lib/types'

const PHASE_ORDER: ContainerPhase[] = [
  'exchange',
  'weighing',
  'cold_storage',
  'treatment',
  'transfer',
  'clean',
]

// Returns the earliest incomplete phase across all containers in a batch.
// "Incomplete" means anything before 'clean'.
export function computeNextPendingStep(phases: ContainerPhase[]): ContainerPhase {
  for (const phase of PHASE_ORDER) {
    if (phase === 'clean') continue
    if (phases.some((p) => p === phase)) return phase
  }
  return 'exchange' // all containers are clean → new cycle starting
}
```

- [ ] **Step 8: Run batch tests — expect pass**

```bash
npm test -- --testPathPattern=batches
```

Expected: PASS.

- [ ] **Step 9: Create Zustand store**

Create `src/lib/store.ts`:

```typescript
import { create } from 'zustand'
import type {
  Client,
  Container,
  Batch,
  ExchangeEvent,
  ContainerReception,
  StorageEvent,
  TreatmentRun,
  ExternalTransfer,
  ContainerLocation,
  User,
  Photo,
} from './types'
import {
  MOCK_CLIENTS,
  MOCK_CONTAINERS,
  MOCK_BATCHES,
  MOCK_EXCHANGE_EVENTS,
  MOCK_RECEPTIONS,
  MOCK_STORAGE_EVENTS,
  MOCK_TREATMENT_RUNS,
  MOCK_EXTERNAL_TRANSFERS,
  MOCK_LOCATIONS,
  MOCK_USERS,
  MOCK_PHOTOS,
} from './mock-data'

interface HospimedStore {
  clients: Client[]
  containers: Container[]
  batches: Batch[]
  exchangeEvents: ExchangeEvent[]
  receptions: ContainerReception[]
  storageEvents: StorageEvent[]
  treatmentRuns: TreatmentRun[]
  externalTransfers: ExternalTransfer[]
  locations: ContainerLocation[]
  users: User[]
  photos: Photo[]

  // Mutations (used by registration flows in Plan 3)
  addReception: (reception: ContainerReception) => void
  addStorageEvent: (event: StorageEvent) => void
  addTreatmentRun: (run: TreatmentRun) => void
  addExternalTransfer: (transfer: ExternalTransfer) => void
  addLocation: (location: ContainerLocation) => void
  addContainer: (container: Container) => void
  updateContainer: (id: string, updates: Partial<Container>) => void
  addClient: (client: Client) => void
  updateBatch: (id: string, updates: Partial<Batch>) => void
  addPhoto: (photo: Photo) => void
}

export const useStore = create<HospimedStore>((set) => ({
  clients: MOCK_CLIENTS,
  containers: MOCK_CONTAINERS,
  batches: MOCK_BATCHES,
  exchangeEvents: MOCK_EXCHANGE_EVENTS,
  receptions: MOCK_RECEPTIONS,
  storageEvents: MOCK_STORAGE_EVENTS,
  treatmentRuns: MOCK_TREATMENT_RUNS,
  externalTransfers: MOCK_EXTERNAL_TRANSFERS,
  locations: MOCK_LOCATIONS,
  users: MOCK_USERS,
  photos: MOCK_PHOTOS,

  addReception: (reception) =>
    set((s) => ({ receptions: [...s.receptions, reception] })),

  addStorageEvent: (event) =>
    set((s) => ({ storageEvents: [...s.storageEvents, event] })),

  addTreatmentRun: (run) =>
    set((s) => ({ treatmentRuns: [...s.treatmentRuns, run] })),

  addExternalTransfer: (transfer) =>
    set((s) => ({ externalTransfers: [...s.externalTransfers, transfer] })),

  addLocation: (location) =>
    set((s) => ({ locations: [...s.locations, location] })),

  addContainer: (container) =>
    set((s) => ({ containers: [...s.containers, container] })),

  updateContainer: (id, updates) =>
    set((s) => ({
      containers: s.containers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  addClient: (client) =>
    set((s) => ({ clients: [...s.clients, client] })),

  updateBatch: (id, updates) =>
    set((s) => ({
      batches: s.batches.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  addPhoto: (photo) =>
    set((s) => ({ photos: [...s.photos, photo] })),
}))
```

- [ ] **Step 10: Create `src/lib/data/clients.ts`**

```typescript
import type { Client } from '@/lib/types'

export function getClientById(clients: Client[], id: string): Client | undefined {
  return clients.find((c) => c.id === id)
}

export function getClientByCodeLetter(clients: Client[], letter: string): Client | undefined {
  return clients.find((c) => c.code_letter === letter.toUpperCase())
}
```

- [ ] **Step 11: Run all tests**

```bash
npm test
```

Expected: PASS — all tests.

- [ ] **Step 12: Commit**

```bash
git add src/lib/store.ts src/lib/data/ src/__tests__/lib/
git commit -m "feat: add Zustand store and data access layer with tests"
```

---

## Task 6: App layout and navigation

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/mobile-header.tsx`

- [ ] **Step 1: Create sidebar navigation**

Create `src/components/layout/sidebar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ClipboardList, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/containers', label: 'Envases', icon: Package },
  { href: '/register/exchange', label: 'Registrar', icon: ClipboardList },
  { href: '/admin/containers', label: 'Admin', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-56 flex-col border-r bg-white h-screen sticky top-0">
      <div className="p-4 border-b">
        <span className="font-bold text-lg text-slate-800">Hospimed</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Create mobile header**

Create `src/components/layout/mobile-header.tsx`:

```tsx
'use client'

import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/containers': 'Envases',
  '/register/exchange': 'Registrar Intercambio',
  '/register/weighing': 'Registrar Pesaje',
  '/register/storage': 'Registrar Cámara Fría',
  '/register/treatment': 'Registrar Tratamiento',
  '/register/transfer': 'Registrar Traslado',
  '/register/location': 'Reportar Ubicación',
  '/admin/containers': 'Administrar Envases',
  '/admin/clients': 'Administrar Clientes',
}

export function MobileHeader() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? 'Hospimed'

  return (
    <header className="md:hidden flex items-center h-14 border-b bg-white px-4 sticky top-0 z-10">
      <span className="font-semibold text-slate-800">{title}</span>
    </header>
  )
}
```

- [ ] **Step 3: Install lucide-react**

```bash
npm install lucide-react
```

- [ ] **Step 4: Update root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Hospimed — Trazabilidad',
  description: 'Sistema de trazabilidad de desechos clínicos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <div className="flex min-h-screen bg-slate-50">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <MobileHeader />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Root page redirects to dashboard**

Replace `src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 6: Verify layout renders**

```bash
npm run dev
```

Navigate to `http://localhost:3000`. Expected: sidebar on desktop, redirects to `/dashboard` (404 for now is fine).

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/components/layout/
git commit -m "feat: add app layout with sidebar and mobile header"
```

---

## Task 7: Login page

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Create login page**

Create `src/app/login/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // Auth logic will be added when Supabase is integrated (Plan 4)
    setTimeout(() => router.push('/dashboard'), 500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Hospimed</CardTitle>
          <p className="text-sm text-slate-500 mt-1">Trazabilidad de Desechos Clínicos</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Correo electrónico
              </label>
              <Input id="email" type="email" placeholder="operador@hospimed.com" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input id="password" type="password" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify login renders**

Navigate to `http://localhost:3000/login`. Expected: form with email/password, clicking submit redirects to `/dashboard`.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/
git commit -m "feat: add login page (no auth yet — Supabase in Plan 4)"
```

---

## Task 8: Dashboard — metrics cards

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/components/dashboard/metrics-cards.tsx`
- Create: `src/__tests__/components/metrics-cards.test.tsx`

- [ ] **Step 1: Write metrics test first**

Create `src/__tests__/components/metrics-cards.test.tsx`:

```typescript
import { computeDashboardMetrics } from '@/components/dashboard/metrics-cards'
import { MOCK_CONTAINERS, MOCK_BATCHES, MOCK_STORAGE_EVENTS, MOCK_TREATMENT_RUNS } from '@/lib/mock-data'

describe('computeDashboardMetrics', () => {
  it('counts active batches', () => {
    const metrics = computeDashboardMetrics(MOCK_BATCHES, MOCK_CONTAINERS, MOCK_STORAGE_EVENTS, MOCK_TREATMENT_RUNS)
    expect(metrics.activeBatches).toBe(2) // batch-1 and batch-2
  })

  it('counts containers in active batches', () => {
    const metrics = computeDashboardMetrics(MOCK_BATCHES, MOCK_CONTAINERS, MOCK_STORAGE_EVENTS, MOCK_TREATMENT_RUNS)
    // batch-1 has 5 containers, batch-2 has 2 containers
    expect(metrics.containersInCirculation).toBe(7)
  })

  it('counts containers in cold storage', () => {
    const metrics = computeDashboardMetrics(MOCK_BATCHES, MOCK_CONTAINERS, MOCK_STORAGE_EVENTS, MOCK_TREATMENT_RUNS)
    // storage-1 has no exit_at, so 1 container in cold storage
    expect(metrics.containersInStorage).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- --testPathPattern=metrics-cards
```

Expected: FAIL.

- [ ] **Step 3: Create metrics cards component**

Create `src/components/dashboard/metrics-cards.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  const containersInStorage = storageEvents.filter(
    (s) => s.exit_at === null
  ).length

  const containersInTreatment = treatmentRuns.filter(
    (t) => t.completed_at === null
  ).length

  return {
    activeBatches: activeBatches.length,
    containersInCirculation: containerIdsInActiveBatches.size,
    containersInStorage,
    containersInTreatment,
  }
}

interface Props {
  metrics: DashboardMetrics
}

export function MetricsCards({ metrics }: Props) {
  const cards = [
    { label: 'Lotes activos', value: metrics.activeBatches },
    { label: 'Envases en circulación', value: metrics.containersInCirculation },
    { label: 'En cámara fría', value: metrics.containersInStorage },
    { label: 'En tratamiento', value: metrics.containersInTreatment },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(({ label, value }) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-800">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run metrics tests — expect pass**

```bash
npm test -- --testPathPattern=metrics-cards
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/metrics-cards.tsx src/__tests__/components/metrics-cards.test.tsx
git commit -m "feat: add dashboard metrics cards with tests"
```

---

## Task 9: Dashboard — active batches tab

**Files:**
- Create: `src/components/dashboard/active-batches-tab.tsx`

- [ ] **Step 1: Create active batches tab**

Create `src/components/dashboard/active-batches-tab.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import type { BatchWithClient, ContainerPhase } from '@/lib/types'

const PHASE_LABELS: Record<ContainerPhase, string> = {
  exchange: 'Intercambio pendiente',
  weighing: 'Pesaje pendiente',
  cold_storage: 'Cámara fría',
  treatment: 'En tratamiento',
  transfer: 'Traslado pendiente',
  clean: 'Completo',
}

const PHASE_COLORS: Record<ContainerPhase, string> = {
  exchange: 'bg-blue-100 text-blue-700',
  weighing: 'bg-yellow-100 text-yellow-700',
  cold_storage: 'bg-cyan-100 text-cyan-700',
  treatment: 'bg-purple-100 text-purple-700',
  transfer: 'bg-orange-100 text-orange-700',
  clean: 'bg-green-100 text-green-700',
}

interface Props {
  batches: BatchWithClient[]
}

export function ActiveBatchesTab({ batches }: Props) {
  if (batches.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        No hay lotes activos hoy.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => (
        <div
          key={batch.id}
          className="flex items-center justify-between p-4 bg-white rounded-lg border hover:border-slate-300 transition-colors"
        >
          <div className="space-y-1">
            <p className="font-medium text-slate-800">{batch.client.name}</p>
            <p className="text-sm text-slate-500">
              {batch.container_count} envases · {batch.date}
            </p>
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${PHASE_COLORS[batch.next_pending_step]}`}
            >
              {PHASE_LABELS[batch.next_pending_step]}
            </span>
          </div>
          <Link href={`/batches/${batch.id}`}>
            <Button variant="ghost" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/active-batches-tab.tsx
git commit -m "feat: add active batches tab component"
```

---

## Task 10: Dashboard — completed batches tab and dashboard page

**Files:**
- Create: `src/components/dashboard/completed-batches-tab.tsx`
- Create: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Create completed batches tab**

Create `src/components/dashboard/completed-batches-tab.tsx`:

```tsx
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText } from 'lucide-react'
import type { BatchWithClient, WasteType } from '@/lib/types'

const WASTE_TYPE_LABELS: Record<WasteType, string> = {
  infectious: 'Infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

interface Props {
  batches: BatchWithClient[]
  clients: { id: string; name: string }[]
}

export function CompletedBatchesTab({ batches, clients }: Props) {
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filtered = useMemo(() => {
    return batches.filter((b) => {
      if (clientFilter !== 'all' && b.client_id !== clientFilter) return false
      if (dateFrom && b.date < dateFrom) return false
      if (dateTo && b.date > dateTo) return false
      return true
    })
  }, [batches, clientFilter, dateFrom, dateTo])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-44"
          placeholder="Desde"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-44"
          placeholder="Hasta"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          No hay lotes completados con esos filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((batch) => (
            <div
              key={batch.id}
              className="flex items-center justify-between p-4 bg-white rounded-lg border"
            >
              <div className="space-y-1">
                <p className="font-medium text-slate-800">{batch.client.name}</p>
                <p className="text-sm text-slate-500">
                  {batch.container_count} envases · {batch.date}
                </p>
              </div>
              <Link href={`/batches/${batch.id}/report`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Generar reporte
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create dashboard page**

Create `src/app/dashboard/page.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MetricsCards, computeDashboardMetrics } from '@/components/dashboard/metrics-cards'
import { ActiveBatchesTab } from '@/components/dashboard/active-batches-tab'
import { CompletedBatchesTab } from '@/components/dashboard/completed-batches-tab'
import { useStore } from '@/lib/store'
import { computeNextPendingStep } from '@/lib/data/batches'
import { computeContainerPhase } from '@/lib/data/containers'
import type { BatchWithClient } from '@/lib/types'

export default function DashboardPage() {
  const {
    batches, clients, containers, storageEvents, treatmentRuns,
    exchangeEvents, receptions, externalTransfers,
  } = useStore()

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
    [batches, clients, containers, exchangeEvents, receptions, storageEvents, treatmentRuns, externalTransfers]
  )

  const completedBatches = useMemo(
    () => batches.filter((b) => b.status === 'completed').map(enrichBatch),
    [batches, clients, containers, exchangeEvents, receptions, storageEvents, treatmentRuns, externalTransfers]
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
      <MetricsCards metrics={metrics} />
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Lotes activos ({activeBatches.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Lotes completados ({completedBatches.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <ActiveBatchesTab batches={activeBatches} />
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          <CompletedBatchesTab
            batches={completedBatches}
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 3: Add Tabs to shadcn if not already added**

```bash
npx shadcn@latest add tabs
```

- [ ] **Step 4: Verify dashboard works in browser**

```bash
npm run dev
```

Navigate to `http://localhost:3000/dashboard`. Expected:
- 4 metric cards with numbers
- Two tabs: "Lotes activos (2)" and "Lotes completados (2)"
- Active tab shows batch cards with client name, container count, and pending phase badge
- Completed tab shows filter controls and batch list with "Generar reporte" button

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: PASS — all tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/ src/components/dashboard/
git commit -m "feat: complete dashboard with metrics, active and completed batch tabs"
```

---

## Task 11: Batch detail page

**Files:**
- Create: `src/app/batches/[id]/page.tsx`
- Create: `src/components/batches/batch-containers-list.tsx`

- [ ] **Step 1: Create batch containers list component**

Create `src/components/batches/batch-containers-list.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import type { ContainerWithPhase, ContainerPhase } from '@/lib/types'

const PHASE_LABELS: Record<ContainerPhase, string> = {
  exchange: 'Intercambio',
  weighing: 'Pesaje',
  cold_storage: 'Cámara fría',
  treatment: 'Tratamiento',
  transfer: 'Traslado',
  clean: 'Limpio',
}

const PHASE_VARIANTS: Record<ContainerPhase, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  exchange: 'default',
  weighing: 'secondary',
  cold_storage: 'secondary',
  treatment: 'default',
  transfer: 'default',
  clean: 'outline',
}

const WASTE_TYPE_LABELS: Record<string, string> = {
  infectious: 'Infeccioso',
  anatomopathological: 'Anatomopat.',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

interface Props {
  containers: ContainerWithPhase[]
}

export function BatchContainersList({ containers }: Props) {
  return (
    <div className="space-y-2">
      {containers.map((container) => (
        <Link
          key={container.id}
          href={`/containers/${container.id}`}
          className="flex items-center justify-between p-4 bg-white rounded-lg border hover:border-slate-300 transition-colors"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-slate-800">{container.id}</span>
              <Badge variant={PHASE_VARIANTS[container.current_phase]}>
                {PHASE_LABELS[container.current_phase]}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              {WASTE_TYPE_LABELS[container.waste_type]} · {container.size_liters}L
              {container.latest_net_weight_kg !== null && (
                <> · <strong>{container.latest_net_weight_kg} kg netos</strong></>
              )}
            </p>
            {container.current_location && (
              <p className="text-xs text-slate-400">
                {container.current_location.location_type === 'client_site'
                  ? `Piso ${container.current_location.floor} — ${container.current_location.area}`
                  : container.current_location.location_type}
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create batch detail page**

Create `src/app/batches/[id]/page.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BatchContainersList } from '@/components/batches/batch-containers-list'
import { useStore } from '@/lib/store'
import { buildContainerWithPhase } from '@/lib/data/containers'
import type { ContainerWithPhase } from '@/lib/types'

interface Props {
  params: { id: string }
}

export default function BatchDetailPage({ params }: Props) {
  const {
    batches, clients, containers, exchangeEvents,
    receptions, storageEvents, treatmentRuns, externalTransfers, locations,
  } = useStore()

  const batch = batches.find((b) => b.id === params.id)
  if (!batch) notFound()

  const client = clients.find((c) => c.id === batch.client_id)!

  const batchContainers: ContainerWithPhase[] = useMemo(() => {
    return batch.container_ids
      .map((cid) => {
        const container = containers.find((c) => c.id === cid)
        if (!container) return null

        const exchangeIds = exchangeEvents
          .filter((e) => e.dirty_containers_received.includes(cid) && e.batch_id === batch.id)
          .map((e) => e.id)
        const reception = receptions.find((r) => r.container_id === cid && r.batch_id === batch.id) ?? null
        const storage = storageEvents.find((s) => s.container_id === cid && s.batch_id === batch.id) ?? null
        const treatment = treatmentRuns.find((t) => t.container_id === cid && t.batch_id === batch.id)
          ?? externalTransfers.find((t) => t.container_id === cid && t.batch_id === batch.id)
          ?? null
        const containerLocations = locations.filter((l) => l.container_id === cid)

        return buildContainerWithPhase(container, exchangeIds, reception, storage, treatment, containerLocations)
      })
      .filter((c): c is ContainerWithPhase => c !== null)
  }, [batch, containers, exchangeEvents, receptions, storageEvents, treatmentRuns, externalTransfers, locations])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{client.name}</h1>
          <p className="text-sm text-slate-500">Lote {batch.date} · {batchContainers.length} envases</p>
        </div>
      </div>
      <BatchContainersList containers={batchContainers} />
    </div>
  )
}
```

- [ ] **Step 3: Verify batch detail in browser**

Navigate to `http://localhost:3000/batches/batch-1`. Expected:
- Header: "Ciudad de la Salud" · "Lote 2026-05-03 · 5 envases"
- List of 5 containers with ID, phase badge, waste type, size, and weight (if available)
- Each row links to `/containers/[id]` (404 for now is fine)

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/batches/ src/components/batches/
git commit -m "feat: add batch detail page with container list and phase badges"
```

---

## Verification checklist — Plan 1 complete

Run these checks before handing off to Plan 2:

- [ ] `npm test` — all tests pass
- [ ] `npm run build` — no TypeScript or build errors

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] Browser check — navigate through the full flow:
  1. `/login` → form renders, submit redirects to `/dashboard`
  2. `/dashboard` → metrics cards show numbers, both tabs work, filters on completed tab work
  3. `/dashboard` → click a batch in "Lotes activos" → `/batches/batch-1` renders with container list

- [ ] Final commit

```bash
git add .
git commit -m "chore: Plan 1 complete — foundation, data layer, dashboard, batch detail"
```
