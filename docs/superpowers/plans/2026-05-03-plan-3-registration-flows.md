# Hospimed — Plan 3/4: Registration Flows

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all six mobile-first registration flows: exchange (intercambio), weighing (pesaje), cold storage (cámara fría), treatment (tratamiento — waste type 1), external transfer (traslado externo — types 2–5), and location reporting. Each flow is a step-by-step wizard: select container → confirm data → capture photos → enter measurements → confirm/save.

**Prerequisites:** Plans 1 and 2 complete. All types, store, and data access functions exist.

**Architecture:** Each registration route is a self-contained client component with local step state. On submission it calls the appropriate Zustand store action (no network call yet). Photos are captured via `<input type="file" capture="environment">`. Shared wizard UI lives in reusable components.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Zustand (existing store)

---

## File map

```
src/
├── app/
│   └── register/
│       ├── exchange/page.tsx         ← intercambio en punto de encuentro
│       ├── weighing/page.tsx         ← pesaje en planta
│       ├── storage/page.tsx          ← entrada a cámara fría
│       ├── treatment/page.tsx        ← tratamiento (solo tipo 1)
│       ├── transfer/page.tsx         ← traslado externo (tipos 2–5)
│       └── location/page.tsx         ← reporte de ubicación
├── components/
│   └── register/
│       ├── container-selector.tsx    ← search + confirm container
│       ├── photo-capture.tsx         ← file input with camera capture + preview
│       ├── step-indicator.tsx        ← "Paso 1 de 3" progress indicator
│       └── success-screen.tsx        ← confirmation screen after save
└── __tests__/
    └── components/
        └── container-selector.test.tsx
```

---

## Task 1: Shared registration components

**Files:**
- Create: `src/components/register/step-indicator.tsx`
- Create: `src/components/register/photo-capture.tsx`
- Create: `src/components/register/success-screen.tsx`
- Create: `src/components/register/container-selector.tsx`
- Create: `src/__tests__/components/container-selector.test.tsx`

- [ ] **Step 1: Create step indicator**

Create `src/components/register/step-indicator.tsx`:

```tsx
interface Props {
  current: number  // 1-based
  total: number
  labels?: string[]
}

export function StepIndicator({ current, total, labels }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < current ? 'bg-blue-500' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Paso {current} de {total}
        {labels?.[current - 1] && <> — {labels[current - 1]}</>}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Create success screen**

Create `src/components/register/success-screen.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  title: string
  containerId: string
  onRegisterAnother: () => void
}

export function SuccessScreen({ title, containerId, onRegisterAnother }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
      <CheckCircle className="h-16 w-16 text-green-500" />
      <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
      <p className="text-slate-500">Envase {containerId} registrado correctamente.</p>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button onClick={onRegisterAnother}>Registrar otro envase</Button>
        <Link href={`/containers/${containerId}`}>
          <Button variant="outline" className="w-full">Ver envase</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="ghost" className="w-full">Ir al dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write container selector tests**

Create `src/__tests__/components/container-selector.test.tsx`:

```typescript
import { filterContainers } from '@/components/register/container-selector'
import type { Container } from '@/lib/types'

const containers: Container[] = [
  { id: 'A-001', client_id: 'client-1', size_liters: 240, tare_weight_kg: 14.2, waste_type: 'infectious', status: 'active', registered_at: '2026-01-01T00:00:00Z' },
  { id: 'A-002', client_id: 'client-1', size_liters: 240, tare_weight_kg: 14.5, waste_type: 'infectious', status: 'active', registered_at: '2026-01-01T00:00:00Z' },
  { id: 'B-001', client_id: 'client-2', size_liters: 240, tare_weight_kg: 14.1, waste_type: 'infectious', status: 'active', registered_at: '2026-01-01T00:00:00Z' },
  { id: 'A-999', client_id: 'client-1', size_liters: 240, tare_weight_kg: 14.0, waste_type: 'infectious', status: 'decommissioned', registered_at: '2026-01-01T00:00:00Z' },
]

describe('filterContainers', () => {
  it('returns only active containers matching search', () => {
    const result = filterContainers(containers, 'A-0')
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual(['A-001', 'A-002'])
  })

  it('excludes decommissioned containers', () => {
    const result = filterContainers(containers, 'A-999')
    expect(result).toHaveLength(0)
  })

  it('returns empty array when no match', () => {
    const result = filterContainers(containers, 'Z-999')
    expect(result).toHaveLength(0)
  })

  it('returns all active containers when search is empty', () => {
    const result = filterContainers(containers, '')
    expect(result).toHaveLength(3)
  })
})
```

- [ ] **Step 4: Run selector tests — expect failure**

```bash
npm test -- --testPathPattern=container-selector
```

Expected: FAIL.

- [ ] **Step 5: Create container selector component**

Create `src/components/register/container-selector.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Container, Client } from '@/lib/types'

export function filterContainers(containers: Container[], search: string): Container[] {
  const active = containers.filter((c) => c.status === 'active')
  if (!search.trim()) return active
  return active.filter((c) => c.id.toLowerCase().includes(search.toLowerCase()))
}

const WASTE_LABELS: Record<string, string> = {
  infectious: 'Infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

interface Props {
  containers: Container[]
  clients: Client[]
  onSelect: (container: Container) => void
}

export function ContainerSelector({ containers, clients, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  const results = filterContainers(containers, search).slice(0, 8)

  return (
    <div className="space-y-3">
      <Input
        placeholder="Número de envase (ej: A-069)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
        className="text-lg h-12"
      />
      {search.length > 0 && (
        <div className="space-y-2">
          {results.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">
              No se encontró ningún envase activo con ese número.
            </p>
          )}
          {results.map((container) => (
            <button
              key={container.id}
              onClick={() => onSelect(container)}
              className="w-full text-left p-4 rounded-lg border hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <p className="font-mono font-semibold text-slate-800">{container.id}</p>
              <p className="text-sm text-slate-500">
                {clientMap[container.client_id]} · {WASTE_LABELS[container.waste_type]} · {container.size_liters}L
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Run selector tests — expect pass**

```bash
npm test -- --testPathPattern=container-selector
```

Expected: PASS.

- [ ] **Step 7: Create photo capture component**

Create `src/components/register/photo-capture.tsx`:

```tsx
'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  label: string           // e.g. "Foto del envase (número visible)"
  required?: boolean
  onCapture: (dataUrl: string) => void
  onRemove: () => void
  preview: string | null  // base64 data URL or null
}

export function PhotoCapture({ label, required, onCapture, onRemove, preview }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onCapture(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {preview ? (
        <div className="relative">
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden border bg-slate-100">
            <Image src={preview} alt="Foto capturada" fill className="object-cover" sizes="100vw" />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={() => {
              onRemove()
              if (inputRef.current) inputRef.current.value = ''
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full aspect-[4/3] rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-500 transition-colors"
        >
          <Camera className="h-8 w-8" />
          <span className="text-sm">Tomar foto</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
```

- [ ] **Step 8: Run all tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/register/
git commit -m "feat: add shared registration components (selector, photo capture, steps, success)"
```

---

## Task 2: Weighing registration flow

**Files:**
- Create: `src/app/register/weighing/page.tsx`

The weighing flow is the most common operation — we build it first as the reference implementation for all other flows.

- [ ] **Step 1: Create weighing registration page**

Create `src/app/register/weighing/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { PhotoCapture } from '@/components/register/photo-capture'
import { SuccessScreen } from '@/components/register/success-screen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useStore } from '@/lib/store'
import { computeNetWeight } from '@/lib/data/containers'
import type { Container, ContainerReception, Photo } from '@/lib/types'

const STEPS = ['Seleccionar envase', 'Fotos', 'Peso']

type Step = 1 | 2 | 3

export default function WeighingPage() {
  const { containers, clients, addReception, addPhoto } = useStore()

  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<Container | null>(null)
  const [photoContainer, setPhotoContainer] = useState<string | null>(null) // data URL
  const [photoScale, setPhotoScale] = useState<string | null>(null)         // data URL
  const [grossWeight, setGrossWeight] = useState('')
  const [done, setDone] = useState(false)

  function handleSelect(container: Container) {
    setSelected(container)
    setStep(2)
  }

  function handlePhotosNext() {
    if (!photoContainer || !photoScale) return
    setStep(3)
  }

  function handleSubmit() {
    if (!selected || !photoContainer || !photoScale || !grossWeight) return

    const now = new Date().toISOString()
    const batchId = 'batch-1' // In Plan 4 (Supabase), this resolves from the active batch for the container's client

    const receptionId = `reception-${Date.now()}`
    const photo1Id = `photo-${Date.now()}-1`
    const photo2Id = `photo-${Date.now()}-2`
    const clientName = clients.find((c) => c.id === selected.client_id)?.name ?? ''
    const label = `PTDP ${clientName} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`

    const photo1: Photo = {
      id: photo1Id,
      url: photoContainer,
      event_type: 'weighing',
      event_id: receptionId,
      taken_at: now,
      label,
    }
    const photo2: Photo = {
      id: photo2Id,
      url: photoScale,
      event_type: 'weighing',
      event_id: receptionId,
      taken_at: now,
      label,
    }

    const reception: ContainerReception = {
      id: receptionId,
      container_id: selected.id,
      batch_id: batchId,
      arrived_at: now,
      gross_weight_kg: parseFloat(grossWeight),
      operator_id: 'user-1',
      photo_ids: [photo1Id, photo2Id],
    }

    addPhoto(photo1)
    addPhoto(photo2)
    addReception(reception)
    setDone(true)
  }

  function reset() {
    setStep(1)
    setSelected(null)
    setPhotoContainer(null)
    setPhotoScale(null)
    setGrossWeight('')
    setDone(false)
  }

  if (done && selected) {
    return <SuccessScreen title="Pesaje registrado" containerId={selected.id} onRegisterAnother={reset} />
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Registrar Pesaje</h1>
        <div className="mt-3">
          <StepIndicator current={step} total={3} labels={STEPS} />
        </div>
      </div>

      {step === 1 && (
        <ContainerSelector
          containers={containers}
          clients={clients}
          onSelect={handleSelect}
        />
      )}

      {step === 2 && selected && (
        <div className="space-y-6">
          {/* Confirm selected container */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="font-mono font-semibold text-blue-800">{selected.id}</p>
              <p className="text-sm text-blue-600">
                {clients.find((c) => c.id === selected.client_id)?.name} · Tara: {selected.tare_weight_kg} kg
              </p>
            </CardContent>
          </Card>

          <PhotoCapture
            label="Foto del envase (número visible)"
            required
            preview={photoContainer}
            onCapture={setPhotoContainer}
            onRemove={() => setPhotoContainer(null)}
          />
          <PhotoCapture
            label="Foto de la balanza (peso visible)"
            required
            preview={photoScale}
            onCapture={setPhotoScale}
            onRemove={() => setPhotoScale(null)}
          />

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
            <Button
              onClick={handlePhotosNext}
              disabled={!photoContainer || !photoScale}
              className="flex-1"
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 3 && selected && (
        <div className="space-y-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="font-mono font-semibold text-blue-800">{selected.id}</p>
              <p className="text-sm text-blue-600">Tara: {selected.tare_weight_kg} kg</p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Peso bruto (kg) <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={grossWeight}
              onChange={(e) => setGrossWeight(e.target.value)}
              placeholder="Ej: 43.7"
              className="text-lg h-12"
              autoFocus
            />
            {grossWeight && parseFloat(grossWeight) > selected.tare_weight_kg && (
              <p className="text-sm text-slate-600">
                Peso neto estimado:{' '}
                <strong>{computeNetWeight(parseFloat(grossWeight), selected.tare_weight_kg)} kg</strong>
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Atrás</Button>
            <Button
              onClick={handleSubmit}
              disabled={!grossWeight || parseFloat(grossWeight) <= selected.tare_weight_kg}
              className="flex-1"
            >
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify weighing flow in browser (mobile view)**

```bash
npm run dev
```

Open DevTools → toggle mobile view (375px). Navigate to `http://localhost:3000/register/weighing`. Expected:
1. Step 1: type "A-" → see container list → tap A-001 → moves to step 2
2. Step 2: two photo capture areas, "Continuar" disabled until both photos added → tap each area → file picker opens → select any image → preview appears → "Continuar" enables → tap → step 3
3. Step 3: enter gross weight (e.g. 43.7) → net weight shows (29.5 kg) → tap "Guardar" → success screen

- [ ] **Step 3: Commit**

```bash
git add src/app/register/weighing/
git commit -m "feat: add weighing registration flow (select → photos → weight)"
```

---

## Task 3: Cold storage registration flow

**Files:**
- Create: `src/app/register/storage/page.tsx`

- [ ] **Step 1: Create cold storage registration page**

Create `src/app/register/storage/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { PhotoCapture } from '@/components/register/photo-capture'
import { SuccessScreen } from '@/components/register/success-screen'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useStore } from '@/lib/store'
import type { Container, StorageEvent, Photo } from '@/lib/types'

const STEPS = ['Seleccionar envase', 'Foto']

type Step = 1 | 2

export default function StoragePage() {
  const { containers, clients, addStorageEvent, addPhoto, addLocation } = useStore()

  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<Container | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function handleSelect(container: Container) {
    setSelected(container)
    setStep(2)
  }

  function handleSubmit() {
    if (!selected || !photo) return

    const now = new Date().toISOString()
    const batchId = 'batch-1' // resolved from active batch in Plan 4
    const eventId = `storage-${Date.now()}`
    const photoId = `photo-${Date.now()}`
    const clientName = clients.find((c) => c.id === selected.client_id)?.name ?? ''
    const label = `PTDP ${clientName} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`

    const newPhoto: Photo = {
      id: photoId,
      url: photo,
      event_type: 'storage',
      event_id: eventId,
      taken_at: now,
      label,
    }

    const storageEvent: StorageEvent = {
      id: eventId,
      container_id: selected.id,
      batch_id: batchId,
      entry_at: now,
      exit_at: null,
      operator_id: 'user-1',
      photo_ids: [photoId],
    }

    addPhoto(newPhoto)
    addStorageEvent(storageEvent)

    // Auto-register location as cold_storage
    addLocation({
      id: `loc-${Date.now()}`,
      container_id: selected.id,
      reported_at: now,
      operator_id: 'user-1',
      location_type: 'cold_storage',
      client_id: null,
      floor: null,
      area: null,
      notes: null,
    })

    setDone(true)
  }

  function reset() {
    setStep(1)
    setSelected(null)
    setPhoto(null)
    setDone(false)
  }

  if (done && selected) {
    return <SuccessScreen title="Entrada a cámara fría registrada" containerId={selected.id} onRegisterAnother={reset} />
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Registrar Cámara Fría</h1>
        <div className="mt-3">
          <StepIndicator current={step} total={2} labels={STEPS} />
        </div>
      </div>

      {step === 1 && (
        <ContainerSelector containers={containers} clients={clients} onSelect={handleSelect} />
      )}

      {step === 2 && selected && (
        <div className="space-y-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="font-mono font-semibold text-blue-800">{selected.id}</p>
              <p className="text-sm text-blue-600">
                {clients.find((c) => c.id === selected.client_id)?.name}
              </p>
            </CardContent>
          </Card>

          <PhotoCapture
            label="Foto del envase en cámara fría"
            required
            preview={photo}
            onCapture={setPhoto}
            onRemove={() => setPhoto(null)}
          />

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
            <Button onClick={handleSubmit} disabled={!photo} className="flex-1">
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/register/storage/
git commit -m "feat: add cold storage registration flow"
```

---

## Task 4: Exchange registration flow

**Files:**
- Create: `src/app/register/exchange/page.tsx`

The exchange flow registers a batch of containers at once (multiple containers per exchange event).

- [ ] **Step 1: Create exchange registration page**

Create `src/app/register/exchange/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { PhotoCapture } from '@/components/register/photo-capture'
import { SuccessScreen } from '@/components/register/success-screen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStore } from '@/lib/store'
import type { Container, ExchangeEvent, ContainerLocation, Photo } from '@/lib/types'

const STEPS = ['Seleccionar envases', 'Ubicación + fotos']

type Step = 1 | 2

export default function ExchangePage() {
  const { containers, clients, exchangeEvents, addLocation } = useStore()

  const [step, setStep] = useState<Step>(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [clientSiteId, setClientSiteId] = useState('')
  const [floor, setFloor] = useState('')
  const [area, setArea] = useState('')
  const [photoClean, setPhotoClean] = useState<string | null>(null)
  const [photoDirty, setPhotoDirty] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const { addExchangeEvent, addLocation: storeAddLocation } = useStore()

  function handleContainerSelect(container: Container) {
    if (!selectedIds.includes(container.id)) {
      setSelectedIds((prev) => [...prev, container.id])
    }
  }

  function removeContainer(id: string) {
    setSelectedIds((prev) => prev.filter((cid) => cid !== id))
  }

  function handleSubmit() {
    if (!photoClean || !photoDirty || selectedIds.length === 0) return

    const now = new Date().toISOString()
    const batchId = 'batch-1'
    const eventId = `exchange-${Date.now()}`
    const photo1Id = `photo-${Date.now()}-clean`
    const photo2Id = `photo-${Date.now()}-dirty`
    const clientName = clients.find((c) => c.id === clients[0].id)?.name ?? ''
    const label = `PTDP ${clientName} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`

    // Add photos to store
    useStore.getState().addPhoto({
      id: photo1Id, url: photoClean, event_type: 'exchange',
      event_id: eventId, taken_at: now, label,
    })
    useStore.getState().addPhoto({
      id: photo2Id, url: photoDirty, event_type: 'exchange',
      event_id: eventId, taken_at: now, label,
    })

    // Register location for each container
    selectedIds.forEach((cid, idx) => {
      useStore.getState().addLocation({
        id: `loc-${Date.now()}-${idx}`,
        container_id: cid,
        reported_at: now,
        operator_id: 'user-1',
        location_type: clientSiteId ? 'client_site' : 'plant_storage',
        client_id: clientSiteId || null,
        floor: floor || null,
        area: area || null,
        notes: location || null,
      })
    })

    setDone(true)
  }

  function reset() {
    setStep(1)
    setSelectedIds([])
    setLocation('')
    setClientSiteId('')
    setFloor('')
    setArea('')
    setPhotoClean(null)
    setPhotoDirty(null)
    setDone(false)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <div className="text-4xl">✓</div>
        <h2 className="text-xl font-semibold">Intercambio registrado</h2>
        <p className="text-slate-500">{selectedIds.length} envases registrados.</p>
        <Button onClick={reset}>Registrar otro intercambio</Button>
      </div>
    )
  }

  const selectedContainers = containers.filter((c) => selectedIds.includes(c.id))

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Registrar Intercambio</h1>
        <div className="mt-3">
          <StepIndicator current={step} total={2} labels={STEPS} />
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <ContainerSelector containers={containers} clients={clients} onSelect={handleContainerSelect} />

          {selectedIds.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Envases seleccionados:</p>
              <div className="flex flex-wrap gap-2">
                {selectedContainers.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1">
                    <span className="font-mono">{c.id}</span>
                    <button onClick={() => removeContainer(c.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Button onClick={() => setStep(2)} className="w-full mt-2">
                Continuar con {selectedIds.length} envase{selectedIds.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {/* Location */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Ubicación donde quedan los envases</p>
            <Select value={clientSiteId} onValueChange={setClientSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="Cliente / instalación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Sin asignar a cliente —</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientSiteId && (
              <>
                <Input
                  placeholder="Piso (ej: 2)"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                />
                <Input
                  placeholder="Área / sala (ej: Pediatría)"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                />
              </>
            )}
            <Input
              placeholder="Punto de encuentro o notas (opcional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <PhotoCapture
            label="Foto de envases limpios entregados"
            required
            preview={photoClean}
            onCapture={setPhotoClean}
            onRemove={() => setPhotoClean(null)}
          />
          <PhotoCapture
            label="Foto de envases sucios recibidos"
            required
            preview={photoDirty}
            onCapture={setPhotoDirty}
            onRemove={() => setPhotoDirty(null)}
          />

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
            <Button
              onClick={handleSubmit}
              disabled={!photoClean || !photoDirty}
              className="flex-1"
            >
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add `addExchangeEvent` action to store**

In `src/lib/store.ts`, add to the interface and implementation:

```typescript
// In interface:
addExchangeEvent: (event: ExchangeEvent) => void

// In create():
addExchangeEvent: (event) =>
  set((s) => ({ exchangeEvents: [...s.exchangeEvents, event] })),
```

Import `ExchangeEvent` at the top of `store.ts` (it should already be imported).

- [ ] **Step 3: Commit**

```bash
git add src/app/register/exchange/ src/lib/store.ts
git commit -m "feat: add exchange registration flow with multi-container selection and location"
```

---

## Task 5: Treatment and external transfer flows

**Files:**
- Create: `src/app/register/treatment/page.tsx`
- Create: `src/app/register/transfer/page.tsx`

- [ ] **Step 1: Create treatment registration page (waste type 1 only)**

Create `src/app/register/treatment/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { SuccessScreen } from '@/components/register/success-screen'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useStore } from '@/lib/store'
import type { Container, TreatmentRun } from '@/lib/types'

const STEPS = ['Seleccionar envase', 'Confirmar inicio']

type Step = 1 | 2

export default function TreatmentPage() {
  const { containers, clients, addTreatmentRun } = useStore()

  // Only show type 1 (infectious) containers
  const infectiousContainers = containers.filter((c) => c.waste_type === 'infectious')

  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<Container | null>(null)
  const [done, setDone] = useState(false)

  function handleSelect(container: Container) {
    setSelected(container)
    setStep(2)
  }

  function handleSubmit() {
    if (!selected) return

    const run: TreatmentRun = {
      id: `treatment-${Date.now()}`,
      container_id: selected.id,
      batch_id: 'batch-1',
      started_at: new Date().toISOString(),
      completed_at: null,
      operator_id: 'user-1',
    }

    addTreatmentRun(run)
    setDone(true)
  }

  function reset() {
    setStep(1)
    setSelected(null)
    setDone(false)
  }

  if (done && selected) {
    return <SuccessScreen title="Tratamiento iniciado" containerId={selected.id} onRegisterAnother={reset} />
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Iniciar Tratamiento</h1>
        <p className="text-sm text-slate-500 mt-1">Solo envases de desecho infeccioso (tipo 1)</p>
        <div className="mt-3">
          <StepIndicator current={step} total={2} labels={STEPS} />
        </div>
      </div>

      {step === 1 && (
        <ContainerSelector containers={infectiousContainers} clients={clients} onSelect={handleSelect} />
      )}

      {step === 2 && selected && (
        <div className="space-y-6">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-4">
              <p className="font-mono font-semibold text-yellow-800">{selected.id}</p>
              <p className="text-sm text-yellow-700">
                {clients.find((c) => c.id === selected.client_id)?.name} · Infeccioso
              </p>
              <p className="text-sm font-medium text-yellow-800 mt-2">
                ¿Confirmar inicio de tratamiento a las{' '}
                {new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}?
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
            <Button onClick={handleSubmit} className="flex-1">Confirmar inicio</Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create external transfer registration page (types 2–5)**

Create `src/app/register/transfer/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { SuccessScreen } from '@/components/register/success-screen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useStore } from '@/lib/store'
import type { Container, ExternalTransfer } from '@/lib/types'

const STEPS = ['Seleccionar envase', 'Destino']

type Step = 1 | 2

export default function TransferPage() {
  const { containers, clients, addExternalTransfer } = useStore()

  // Only non-infectious containers
  const nonInfectiousContainers = containers.filter((c) => c.waste_type !== 'infectious')

  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<Container | null>(null)
  const [destination, setDestination] = useState('')
  const [done, setDone] = useState(false)

  function handleSelect(container: Container) {
    setSelected(container)
    setStep(2)
  }

  function handleSubmit() {
    if (!selected || !destination.trim()) return

    const transfer: ExternalTransfer = {
      id: `transfer-${Date.now()}`,
      container_id: selected.id,
      batch_id: 'batch-1',
      storage_started_at: new Date().toISOString(),
      transferred_at: null,
      destination: destination.trim(),
      operator_id: 'user-1',
    }

    addExternalTransfer(transfer)
    setDone(true)
  }

  function reset() {
    setStep(1)
    setSelected(null)
    setDestination('')
    setDone(false)
  }

  if (done && selected) {
    return <SuccessScreen title="Traslado registrado" containerId={selected.id} onRegisterAnother={reset} />
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Registrar Traslado Externo</h1>
        <p className="text-sm text-slate-500 mt-1">Tipos 2–5 (anatomopatológico, citotóxico, líquidos, morgue)</p>
        <div className="mt-3">
          <StepIndicator current={step} total={2} labels={STEPS} />
        </div>
      </div>

      {step === 1 && (
        <ContainerSelector containers={nonInfectiousContainers} clients={clients} onSelect={handleSelect} />
      )}

      {step === 2 && selected && (
        <div className="space-y-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="font-mono font-semibold text-blue-800">{selected.id}</p>
              <p className="text-sm text-blue-600">
                {clients.find((c) => c.id === selected.client_id)?.name}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Centro externo de destino <span className="text-red-500">*</span>
            </label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Nombre del centro externo"
              className="h-12"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
            <Button onClick={handleSubmit} disabled={!destination.trim()} className="flex-1">
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/register/treatment/ src/app/register/transfer/
git commit -m "feat: add treatment and external transfer registration flows"
```

---

## Task 6: Location reporting flow

**Files:**
- Create: `src/app/register/location/page.tsx`

- [ ] **Step 1: Create location reporting page**

Create `src/app/register/location/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { SuccessScreen } from '@/components/register/success-screen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useStore } from '@/lib/store'
import type { Container, ContainerLocation, LocationType } from '@/lib/types'

const STEPS = ['Seleccionar envase', 'Registrar ubicación']

const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string }[] = [
  { value: 'client_site', label: 'Instalación del cliente' },
  { value: 'plant_storage', label: 'Planta — almacén' },
  { value: 'cold_storage', label: 'Planta — cámara fría' },
  { value: 'treatment', label: 'Planta — tratamiento' },
]

type Step = 1 | 2

export default function LocationPage() {
  const { containers, clients, addLocation } = useStore()

  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<Container | null>(null)
  const [locationType, setLocationType] = useState<LocationType>('client_site')
  const [clientId, setClientId] = useState('')
  const [floor, setFloor] = useState('')
  const [area, setArea] = useState('')
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState(false)

  function handleSelect(container: Container) {
    setSelected(container)
    setClientId(container.client_id) // default to container's own client
    setStep(2)
  }

  function handleSubmit() {
    if (!selected) return

    const location: ContainerLocation = {
      id: `loc-${Date.now()}`,
      container_id: selected.id,
      reported_at: new Date().toISOString(),
      operator_id: 'user-1',
      location_type: locationType,
      client_id: locationType === 'client_site' ? clientId || null : null,
      floor: floor || null,
      area: area || null,
      notes: notes || null,
    }

    addLocation(location)
    setDone(true)
  }

  function reset() {
    setStep(1)
    setSelected(null)
    setLocationType('client_site')
    setClientId('')
    setFloor('')
    setArea('')
    setNotes('')
    setDone(false)
  }

  if (done && selected) {
    return <SuccessScreen title="Ubicación registrada" containerId={selected.id} onRegisterAnother={reset} />
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Reportar Ubicación</h1>
        <div className="mt-3">
          <StepIndicator current={step} total={2} labels={STEPS} />
        </div>
      </div>

      {step === 1 && (
        <ContainerSelector containers={containers} clients={clients} onSelect={handleSelect} />
      )}

      {step === 2 && selected && (
        <div className="space-y-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="font-mono font-semibold text-blue-800">{selected.id}</p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Tipo de ubicación</label>
            <Select value={locationType} onValueChange={(v) => setLocationType(v as LocationType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {locationType === 'client_site' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Cliente</label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Piso (ej: 2)"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
              />
              <Input
                placeholder="Área / sala (ej: Pediatría)"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </>
          )}

          <Input
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
            <Button onClick={handleSubmit} className="flex-1">Guardar ubicación</Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/register/location/
git commit -m "feat: add location reporting flow"
```

---

## Task 7: Add navigation links for registration flows

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

The sidebar currently only links to `/register/exchange`. Add a submenu or dropdown for all registration flows.

- [ ] **Step 1: Update sidebar with registration submenu**

Replace `src/components/layout/sidebar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Settings, ChevronDown, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const REGISTER_LINKS = [
  { href: '/register/exchange', label: 'Intercambio' },
  { href: '/register/weighing', label: 'Pesaje' },
  { href: '/register/storage', label: 'Cámara fría' },
  { href: '/register/treatment', label: 'Tratamiento' },
  { href: '/register/transfer', label: 'Traslado externo' },
  { href: '/register/location', label: 'Ubicación' },
]

const TOP_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/containers', label: 'Envases', icon: Package },
  { href: '/admin/containers', label: 'Admin', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [registerOpen, setRegisterOpen] = useState(pathname.startsWith('/register'))

  return (
    <aside className="hidden md:flex w-56 flex-col border-r bg-white h-screen sticky top-0">
      <div className="p-4 border-b">
        <span className="font-bold text-lg text-slate-800">Hospimed</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {TOP_NAV.map(({ href, label, icon: Icon }) => (
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

        {/* Register submenu */}
        <div>
          <button
            onClick={() => setRegisterOpen((o) => !o)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname.startsWith('/register')
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <ClipboardList className="h-4 w-4" />
            <span className="flex-1 text-left">Registrar</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', registerOpen && 'rotate-180')} />
          </button>
          {registerOpen && (
            <div className="ml-7 mt-1 space-y-0.5">
              {REGISTER_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'block px-3 py-1.5 rounded-md text-sm transition-colors',
                    pathname === href
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add registration submenu to sidebar"
```

---

## Verification checklist — Plan 3 complete

- [ ] `npm test` — all tests pass
- [ ] `npm run build` — no TypeScript or build errors

```bash
npm run build
```

- [ ] Browser check (mobile view, 375px):
  1. `/register/weighing` → full 3-step flow works, after save container appears with weighing phase in `/containers`
  2. `/register/storage` → 2-step flow, after save container shows cold_storage phase
  3. `/register/exchange` → multi-container selection works, location fields appear
  4. `/register/treatment` → only infectious containers appear
  5. `/register/transfer` → only non-infectious containers appear
  6. `/register/location` → client_site shows floor/area fields, other types don't

- [ ] Final commit

```bash
git add .
git commit -m "chore: Plan 3 complete — all six registration flows"
```
