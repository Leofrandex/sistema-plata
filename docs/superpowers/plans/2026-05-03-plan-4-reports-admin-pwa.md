# Hospimed — Plan 4/4: Reports + Admin + PWA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build PDF report generation (one click per batch, one page per container), Admin CRUD pages for containers and clients, and Progressive Web App (PWA) offline support with IndexedDB sync queue.

**Prerequisites:** Plans 1–3 complete.

**Architecture:**
- Reports: `@react-pdf/renderer` generates the PDF in the browser from batch data. Layout adapts to the Hospimed template once the user shares it.
- Admin: simple form-based CRUD pages reading/writing the Zustand store.
- PWA: `next-pwa` installs a service worker that caches the app shell. An IndexedDB queue (`idb`) stores events registered offline and syncs them when connection is restored.

**Tech Stack:** Next.js 14, TypeScript, Tailwind, shadcn/ui, `@react-pdf/renderer`, `next-pwa`, `idb`, Zustand

---

## File map

```
src/
├── app/
│   ├── batches/[id]/report/page.tsx          ← PDF preview + download
│   ├── admin/
│   │   ├── containers/page.tsx               ← container list + add form
│   │   └── clients/page.tsx                  ← client list + add form
├── components/
│   ├── reports/
│   │   ├── batch-report-document.tsx         ← react-pdf Document component
│   │   └── report-preview.tsx                ← iframe preview + download button
│   └── admin/
│       ├── container-form.tsx                ← add/edit container fields
│       └── client-form.tsx                   ← add/edit client fields
├── lib/
│   └── offline-queue.ts                      ← IndexedDB queue logic
├── hooks/
│   └── use-offline-sync.ts                   ← hook: enqueue + sync on reconnect
└── __tests__/
    └── lib/
        └── offline-queue.test.ts
```

---

## Task 1: PDF report generation

**Files:**
- Create: `src/components/reports/batch-report-document.tsx`
- Create: `src/components/reports/report-preview.tsx`
- Create: `src/app/batches/[id]/report/page.tsx`

- [ ] **Step 1: Verify @react-pdf/renderer is installed**

```bash
npm list @react-pdf/renderer
```

Expected: shows version (installed in Plan 1). If missing: `npm install @react-pdf/renderer`.

- [ ] **Step 2: Create the PDF Document component**

Create `src/components/reports/batch-report-document.tsx`:

```tsx
import {
  Document, Page, Text, View, Image, StyleSheet, Font,
} from '@react-pdf/renderer'
import type { Batch, Client, Container, ContainerReception, StorageEvent, ExchangeEvent, Photo } from '@/lib/types'

// Note: replace with actual Hospimed logo path once available
// For now uses a text header

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  coverPage: {
    padding: 48,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  coverTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    color: '#0f172a',
  },
  coverSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    color: '#475569',
  },
  coverMeta: {
    fontSize: 11,
    textAlign: 'center',
    color: '#64748b',
    marginTop: 4,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    borderBottom: '0.5 solid #e2e8f0',
    paddingBottom: 3,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
  },
  labelValue: {
    flex: 1,
  },
  label: {
    fontSize: 8,
    color: '#94a3b8',
    marginBottom: 1,
  },
  value: {
    fontSize: 10,
    color: '#0f172a',
    fontFamily: 'Helvetica-Bold',
  },
  photoRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  photoBox: {
    width: '48%',
  },
  photo: {
    width: '100%',
    aspectRatio: '4/3',
    borderRadius: 4,
    objectFit: 'cover',
  },
  photoLabel: {
    fontSize: 7,
    color: '#94a3b8',
    marginTop: 2,
    textAlign: 'center',
  },
  divider: {
    borderBottom: '0.5 solid #e2e8f0',
    marginVertical: 12,
  },
  summaryTable: {
    borderTop: '0.5 solid #e2e8f0',
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #f1f5f9',
    paddingVertical: 4,
  },
  summaryHeader: {
    backgroundColor: '#f8fafc',
  },
  summaryCell: {
    flex: 1,
    fontSize: 9,
    paddingHorizontal: 4,
    color: '#334155',
  },
  summaryCellBold: {
    flex: 1,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 4,
    color: '#0f172a',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 32,
    fontSize: 8,
    color: '#94a3b8',
  },
})

const WASTE_LABELS: Record<string, string> = {
  infectious: 'Peligroso Infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

interface ContainerReportData {
  container: Container
  reception: ContainerReception | null
  exchangePhotos: Photo[]
  weighingPhotos: Photo[]
  storagePhotos: Photo[]
}

interface Props {
  batch: Batch
  client: Client
  containerData: ContainerReportData[]
}

export function BatchReportDocument({ batch, client, containerData }: Props) {
  const totalNetWeight = containerData.reduce((sum, { container, reception }) => {
    if (!reception) return sum
    return sum + Math.round((reception.gross_weight_kg - container.tare_weight_kg) * 100) / 100
  }, 0)

  return (
    <Document title={`Reporte Hospimed — ${client.name} — ${batch.date}`}>
      {/* Cover page */}
      <Page size="A4" style={[styles.page, styles.coverPage]}>
        <Text style={styles.coverTitle}>HOSPIMED</Text>
        <Text style={styles.coverTitle}>Informe de Procesamiento</Text>
        <Text style={[styles.coverSubtitle, { marginTop: 16 }]}>{client.name}</Text>
        <Text style={styles.coverMeta}>Fecha: {batch.date}</Text>
        <Text style={styles.coverMeta}>Total de envases: {containerData.length}</Text>
        <Text style={styles.coverMeta}>
          Peso neto total: {totalNetWeight.toFixed(1)} kg
        </Text>
        <Text style={styles.coverMeta}>
          Generado: {new Date().toLocaleString('es-PA')}
        </Text>
      </Page>

      {/* One page per container */}
      {containerData.map(({ container, reception, exchangePhotos, weighingPhotos, storagePhotos }, idx) => {
        const netWeight = reception
          ? Math.round((reception.gross_weight_kg - container.tare_weight_kg) * 100) / 100
          : null

        return (
          <Page key={container.id} size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.section}>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>
                Envase {container.id}
              </Text>
              <Text style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
                {client.name} · {batch.date}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Container info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Datos del envase</Text>
              <View style={styles.row}>
                <View style={styles.labelValue}>
                  <Text style={styles.label}>Número</Text>
                  <Text style={styles.value}>{container.id}</Text>
                </View>
                <View style={styles.labelValue}>
                  <Text style={styles.label}>Tipo de desecho</Text>
                  <Text style={styles.value}>{WASTE_LABELS[container.waste_type]}</Text>
                </View>
                <View style={styles.labelValue}>
                  <Text style={styles.label}>Tamaño</Text>
                  <Text style={styles.value}>{container.size_liters} L</Text>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.labelValue}>
                  <Text style={styles.label}>Tara</Text>
                  <Text style={styles.value}>{container.tare_weight_kg} kg</Text>
                </View>
                <View style={styles.labelValue}>
                  <Text style={styles.label}>Peso bruto</Text>
                  <Text style={styles.value}>{reception ? `${reception.gross_weight_kg} kg` : '—'}</Text>
                </View>
                <View style={styles.labelValue}>
                  <Text style={styles.label}>Peso neto</Text>
                  <Text style={[styles.value, { color: '#0284c7' }]}>
                    {netWeight !== null ? `${netWeight} kg` : '—'}
                  </Text>
                </View>
              </View>
              {reception && (
                <View style={styles.row}>
                  <View style={styles.labelValue}>
                    <Text style={styles.label}>Fecha / hora de pesaje</Text>
                    <Text style={styles.value}>
                      {new Date(reception.arrived_at).toLocaleString('es-PA')}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Intercambio photos */}
            {exchangePhotos.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Intercambio en punto de encuentro</Text>
                <View style={styles.photoRow}>
                  {exchangePhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoBox}>
                      <Image src={photo.url} style={styles.photo} />
                      <Text style={styles.photoLabel}>{photo.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Pesaje photos */}
            {weighingPhotos.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pesaje en planta</Text>
                <View style={styles.photoRow}>
                  {weighingPhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoBox}>
                      <Image src={photo.url} style={styles.photo} />
                      <Text style={styles.photoLabel}>{photo.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Cámara fría photos */}
            {storagePhotos.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cámara fría</Text>
                <View style={styles.photoRow}>
                  {storagePhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoBox}>
                      <Image src={photo.url} style={styles.photo} />
                      <Text style={styles.photoLabel}>{photo.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
          </Page>
        )
      })}

      {/* Summary page */}
      <Page size="A4" style={styles.page}>
        <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 12 }}>
          Resumen — {client.name}
        </Text>
        <View style={styles.summaryTable}>
          <View style={[styles.summaryRow, styles.summaryHeader]}>
            <Text style={styles.summaryCellBold}>Envase</Text>
            <Text style={styles.summaryCellBold}>Tipo</Text>
            <Text style={styles.summaryCellBold}>Tara (kg)</Text>
            <Text style={styles.summaryCellBold}>Bruto (kg)</Text>
            <Text style={styles.summaryCellBold}>Neto (kg)</Text>
          </View>
          {containerData.map(({ container, reception }) => {
            const net = reception
              ? Math.round((reception.gross_weight_kg - container.tare_weight_kg) * 100) / 100
              : null
            return (
              <View key={container.id} style={styles.summaryRow}>
                <Text style={styles.summaryCell}>{container.id}</Text>
                <Text style={styles.summaryCell}>{WASTE_LABELS[container.waste_type]}</Text>
                <Text style={styles.summaryCell}>{container.tare_weight_kg}</Text>
                <Text style={styles.summaryCell}>{reception?.gross_weight_kg ?? '—'}</Text>
                <Text style={styles.summaryCellBold}>{net ?? '—'}</Text>
              </View>
            )
          })}
          <View style={[styles.summaryRow, { borderTop: '1 solid #cbd5e1' }]}>
            <Text style={styles.summaryCellBold} colSpan={4}>TOTAL</Text>
            <Text style={[styles.summaryCellBold, { flex: 4 }]}></Text>
            <Text style={styles.summaryCellBold}>{totalNetWeight.toFixed(1)} kg</Text>
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}
```

- [ ] **Step 3: Create report preview component**

Create `src/components/reports/report-preview.tsx`:

```tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import type { Batch, Client, Container, ContainerReception, ExchangeEvent, Photo, StorageEvent } from '@/lib/types'

// react-pdf must be loaded client-side only (uses browser APIs)
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => <Button disabled><Loader2 className="h-4 w-4 animate-spin mr-2" />Preparando...</Button> }
)

const BatchReportDocumentDynamic = dynamic(
  () => import('./batch-report-document').then((mod) => mod.BatchReportDocument),
  { ssr: false }
)

interface ContainerReportData {
  container: Container
  reception: ContainerReception | null
  exchangePhotos: Photo[]
  weighingPhotos: Photo[]
  storagePhotos: Photo[]
}

interface Props {
  batch: Batch
  client: Client
  containerData: ContainerReportData[]
}

export function ReportPreview({ batch, client, containerData }: Props) {
  const filename = `Hospimed_${client.name.replace(/\s+/g, '_')}_${batch.date}.pdf`

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-slate-50 p-4 space-y-2">
        <p className="text-sm font-medium text-slate-700">Resumen del reporte</p>
        <p className="text-sm text-slate-500">Cliente: <strong>{client.name}</strong></p>
        <p className="text-sm text-slate-500">Fecha: <strong>{batch.date}</strong></p>
        <p className="text-sm text-slate-500">Envases: <strong>{containerData.length}</strong></p>
        <p className="text-sm text-slate-500">
          Páginas estimadas: <strong>{containerData.length + 2}</strong> (portada + {containerData.length} envases + resumen)
        </p>
      </div>

      <PDFDownloadLink
        document={
          <BatchReportDocumentDynamic
            batch={batch}
            client={client}
            containerData={containerData}
          />
        }
        fileName={filename}
      >
        {({ loading }) => (
          <Button className="w-full gap-2" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Generando PDF...</>
            ) : (
              <><Download className="h-4 w-4" />Descargar reporte</>
            )}
          </Button>
        )}
      </PDFDownloadLink>
    </div>
  )
}
```

- [ ] **Step 4: Create report page**

Create `src/app/batches/[id]/report/page.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportPreview } from '@/components/reports/report-preview'
import { useStore } from '@/lib/store'
import type { ContainerReception, Photo } from '@/lib/types'

interface Props {
  params: { id: string }
}

export default function BatchReportPage({ params }: Props) {
  const {
    batches, clients, containers, exchangeEvents,
    receptions, storageEvents, photos,
  } = useStore()

  const batch = batches.find((b) => b.id === params.id)
  if (!batch) notFound()

  const client = clients.find((c) => c.id === batch.client_id)!

  const containerData = useMemo(() => {
    return batch.container_ids.map((cid) => {
      const container = containers.find((c) => c.id === cid)!

      const reception: ContainerReception | null = [...receptions]
        .filter((r) => r.container_id === cid && r.batch_id === batch.id)
        .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0] ?? null

      const containerExchangeEvents = exchangeEvents.filter(
        (e) => (e.dirty_containers_received.includes(cid) || e.clean_containers_given.includes(cid)) && e.batch_id === batch.id
      )
      const exchangePhotoIds = containerExchangeEvents.flatMap((e) => e.photo_ids)

      const containerStorage = storageEvents.find((s) => s.container_id === cid && s.batch_id === batch.id)
      const storagePhotoIds = containerStorage?.photo_ids ?? []

      const weighingPhotoIds = reception?.photo_ids ?? []

      const getPhotos = (ids: string[]): Photo[] =>
        ids.map((id) => photos.find((p) => p.id === id)).filter((p): p is Photo => !!p)

      return {
        container,
        reception,
        exchangePhotos: getPhotos(exchangePhotoIds),
        weighingPhotos: getPhotos(weighingPhotoIds),
        storagePhotos: getPhotos(storagePhotoIds),
      }
    })
  }, [batch, containers, exchangeEvents, receptions, storageEvents, photos])

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/batches/${batch.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Generar Reporte</h1>
          <p className="text-sm text-slate-500">{client.name} · {batch.date}</p>
        </div>
      </div>

      <ReportPreview batch={batch} client={client} containerData={containerData} />
    </div>
  )
}
```

- [ ] **Step 5: Verify report page works**

```bash
npm run dev
```

Navigate to `http://localhost:3000/batches/batch-3/report` (batch-3 is completed). Expected:
- Summary card showing client, date, container count
- "Descargar reporte" button — clicking downloads a PDF with cover page + 2 container pages + summary

- [ ] **Step 6: Commit**

```bash
git add src/components/reports/ src/app/batches/
git commit -m "feat: add PDF report generation with cover, per-container pages, and summary"
```

---

## Task 2: Admin — Container CRUD

**Files:**
- Create: `src/components/admin/container-form.tsx`
- Create: `src/app/admin/containers/page.tsx`

- [ ] **Step 1: Create container form component**

Create `src/components/admin/container-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Client, Container, WasteType, ContainerSize } from '@/lib/types'

const WASTE_OPTIONS: { value: WasteType; label: string }[] = [
  { value: 'infectious', label: 'Peligroso infeccioso' },
  { value: 'anatomopathological', label: 'Anatomopatológico' },
  { value: 'cytotoxic', label: 'Citotóxico' },
  { value: 'liquid', label: 'Líquidos' },
  { value: 'morgue', label: 'Morgue' },
]

const SIZE_OPTIONS: { value: ContainerSize; label: string }[] = [
  { value: 240, label: '240 L' },
  { value: 750, label: '750 L' },
  { value: 1100, label: '1100 L' },
]

interface Props {
  clients: Client[]
  onSubmit: (data: Omit<Container, 'registered_at' | 'status'>) => void
  onCancel: () => void
}

export function ContainerForm({ clients, onSubmit, onCancel }: Props) {
  const [clientId, setClientId] = useState('')
  const [containerNumber, setContainerNumber] = useState('')
  const [size, setSize] = useState<ContainerSize | ''>('')
  const [wasteType, setWasteType] = useState<WasteType | ''>('')
  const [tare, setTare] = useState('')

  const selectedClient = clients.find((c) => c.id === clientId)
  const computedId = selectedClient && containerNumber
    ? `${selectedClient.code_letter}-${containerNumber}`
    : ''

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !containerNumber || !size || !wasteType || !tare) return
    onSubmit({
      id: computedId,
      client_id: clientId,
      size_liters: size as ContainerSize,
      waste_type: wasteType as WasteType,
      tare_weight_kg: parseFloat(tare),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Cliente</label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.code_letter})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Número de envase</label>
        <div className="flex gap-2 items-center">
          {selectedClient && (
            <span className="font-mono font-semibold text-slate-600">{selectedClient.code_letter}-</span>
          )}
          <Input
            type="number"
            placeholder="069"
            value={containerNumber}
            onChange={(e) => setContainerNumber(e.target.value)}
            className="flex-1"
          />
        </div>
        {computedId && (
          <p className="text-xs text-slate-500">ID del envase: <strong className="font-mono">{computedId}</strong></p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tamaño</label>
        <Select value={String(size)} onValueChange={(v) => setSize(Number(v) as ContainerSize)}>
          <SelectTrigger><SelectValue placeholder="Seleccionar tamaño" /></SelectTrigger>
          <SelectContent>
            {SIZE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tipo de desecho</label>
        <Select value={wasteType} onValueChange={(v) => setWasteType(v as WasteType)}>
          <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
          <SelectContent>
            {WASTE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tara (kg)</label>
        <Input
          type="number"
          step="0.1"
          min="0"
          placeholder="14.2"
          value={tare}
          onChange={(e) => setTare(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={!clientId || !containerNumber || !size || !wasteType || !tare}
        >
          Agregar envase
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create admin containers page**

Create `src/app/admin/containers/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContainerForm } from '@/components/admin/container-form'
import { useStore } from '@/lib/store'
import type { Container } from '@/lib/types'

const WASTE_LABELS: Record<string, string> = {
  infectious: 'Infeccioso',
  anatomopathological: 'Anatomopat.',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

export default function AdminContainersPage() {
  const { containers, clients, addContainer, updateContainer } = useStore()
  const [showForm, setShowForm] = useState(false)

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  function handleAdd(data: Omit<Container, 'registered_at' | 'status'>) {
    addContainer({
      ...data,
      status: 'active',
      registered_at: new Date().toISOString(),
    })
    setShowForm(false)
  }

  function handleDecommission(id: string) {
    updateContainer(id, { status: 'decommissioned' })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Administrar Envases</h1>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo envase
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agregar nuevo envase</CardTitle>
          </CardHeader>
          <CardContent>
            <ContainerForm
              clients={clients}
              onSubmit={handleAdd}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">Envase</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Tamaño</th>
              <th className="px-4 py-3 font-medium">Tara</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {containers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-semibold">{c.id}</td>
                <td className="px-4 py-3 text-slate-600">{clientMap[c.client_id] ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{WASTE_LABELS[c.waste_type]}</td>
                <td className="px-4 py-3 text-slate-600">{c.size_liters} L</td>
                <td className="px-4 py-3 text-slate-600">{c.tare_weight_kg} kg</td>
                <td className="px-4 py-3">
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                    {c.status === 'active' ? 'Activo' : 'Dado de baja'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {c.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDecommission(c.id)}
                    >
                      Dar de baja
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/container-form.tsx src/app/admin/containers/
git commit -m "feat: add admin container CRUD (add, decommission)"
```

---

## Task 3: Admin — Client CRUD

**Files:**
- Create: `src/components/admin/client-form.tsx`
- Create: `src/app/admin/clients/page.tsx`

- [ ] **Step 1: Create client form**

Create `src/components/admin/client-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Client } from '@/lib/types'

interface Props {
  onSubmit: (data: Omit<Client, 'id' | 'locations'>) => void
  onCancel: () => void
}

export function ClientForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState('')
  const [codeLetter, setCodeLetter] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !codeLetter.trim()) return
    onSubmit({ name: name.trim(), code_letter: codeLetter.trim().toUpperCase() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Nombre del cliente</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Hospital Nacional"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Letra de prefijo</label>
        <Input
          value={codeLetter}
          onChange={(e) => setCodeLetter(e.target.value.slice(0, 1))}
          placeholder="Ej: D"
          maxLength={1}
          className="uppercase w-20"
          required
        />
        <p className="text-xs text-slate-500">
          Un solo carácter. Los envases de este cliente se identificarán como {codeLetter.toUpperCase() || 'X'}-001, {codeLetter.toUpperCase() || 'X'}-002, etc.
        </p>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" disabled={!name.trim() || !codeLetter.trim()} className="flex-1">
          Agregar cliente
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create admin clients page**

Create `src/app/admin/clients/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClientForm } from '@/components/admin/client-form'
import { useStore } from '@/lib/store'
import type { Client } from '@/lib/types'

export default function AdminClientsPage() {
  const { clients, containers, addClient } = useStore()
  const [showForm, setShowForm] = useState(false)

  function handleAdd(data: Omit<Client, 'id' | 'locations'>) {
    addClient({
      id: `client-${Date.now()}`,
      ...data,
      locations: [],
    })
    setShowForm(false)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Administrar Clientes</h1>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agregar nuevo cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {clients.map((client) => {
          const containerCount = containers.filter((c) => c.client_id === client.id).length
          return (
            <div key={client.id} className="flex items-center justify-between p-4 bg-white rounded-lg border">
              <div>
                <p className="font-semibold text-slate-800">{client.name}</p>
                <p className="text-sm text-slate-500">
                  Prefijo: <span className="font-mono font-semibold">{client.code_letter}</span>
                  {' · '}
                  {containerCount} envase{containerCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add admin nav link to sidebar**

In `src/components/layout/sidebar.tsx`, update `TOP_NAV` to include both admin links:

```typescript
const TOP_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/containers', label: 'Envases', icon: Package },
]

// Add a separate admin section below the register submenu:
const ADMIN_LINKS = [
  { href: '/admin/containers', label: 'Envases' },
  { href: '/admin/clients', label: 'Clientes' },
]
```

Add an Admin section in the sidebar JSX, similar to the Register submenu, with a `Settings` icon.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/ src/app/admin/ src/components/layout/sidebar.tsx
git commit -m "feat: add admin CRUD pages for containers and clients"
```

---

## Task 4: Offline queue (IndexedDB)

**Files:**
- Create: `src/lib/offline-queue.ts`
- Create: `src/hooks/use-offline-sync.ts`
- Create: `src/__tests__/lib/offline-queue.test.ts`

- [ ] **Step 1: Write offline queue tests**

Create `src/__tests__/lib/offline-queue.test.ts`:

```typescript
// Note: these tests use a real IndexedDB implementation (fake-indexeddb)
// Install fake-indexeddb: npm install -D fake-indexeddb

import { enqueue, dequeueAll, clearAll } from '@/lib/offline-queue'

// fake-indexeddb patches the global IndexedDB before tests
import 'fake-indexeddb/auto'

describe('offline-queue', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('enqueues and dequeues items', async () => {
    await enqueue({ type: 'weighing', payload: { container_id: 'A-001', gross_weight_kg: 43.7 } })
    await enqueue({ type: 'storage', payload: { container_id: 'A-001' } })

    const items = await dequeueAll()
    expect(items).toHaveLength(2)
    expect(items[0].type).toBe('weighing')
    expect(items[1].type).toBe('storage')
  })

  it('clearAll removes all items', async () => {
    await enqueue({ type: 'weighing', payload: { container_id: 'A-001', gross_weight_kg: 43.7 } })
    await clearAll()
    const items = await dequeueAll()
    expect(items).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Install fake-indexeddb for tests**

```bash
npm install -D fake-indexeddb
```

- [ ] **Step 3: Run queue tests — expect failure**

```bash
npm test -- --testPathPattern=offline-queue
```

Expected: FAIL.

- [ ] **Step 4: Create offline queue module**

Create `src/lib/offline-queue.ts`:

```typescript
import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'hospimed-offline'
const DB_VERSION = 1
const STORE_NAME = 'queue'

export interface QueuedEvent {
  id?: number
  type: string
  payload: Record<string, unknown>
  queued_at: string
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    },
  })
}

export async function enqueue(event: Omit<QueuedEvent, 'id' | 'queued_at'>): Promise<void> {
  const db = await getDB()
  await db.add(STORE_NAME, { ...event, queued_at: new Date().toISOString() })
}

export async function dequeueAll(): Promise<QueuedEvent[]> {
  const db = await getDB()
  return db.getAll(STORE_NAME)
}

export async function clearAll(): Promise<void> {
  const db = await getDB()
  await db.clear(STORE_NAME)
}

export async function getQueueCount(): Promise<number> {
  const db = await getDB()
  return db.count(STORE_NAME)
}
```

- [ ] **Step 5: Run queue tests — expect pass**

```bash
npm test -- --testPathPattern=offline-queue
```

Expected: PASS.

- [ ] **Step 6: Create offline sync hook**

Create `src/hooks/use-offline-sync.ts`:

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { getQueueCount, dequeueAll, clearAll } from '@/lib/offline-queue'

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)

  async function refreshCount() {
    const count = await getQueueCount()
    setPendingCount(count)
  }

  const sync = useCallback(async () => {
    // In Plan 4 (Supabase), this will flush the queue to the server.
    // For now it just clears the local queue (mock mode has no server).
    const items = await dequeueAll()
    if (items.length > 0) {
      console.log('[offline-sync] Flushing', items.length, 'queued events (mock mode — no server)')
      await clearAll()
      setPendingCount(0)
    }
  }, [])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshCount()

    function handleOnline() {
      setIsOnline(true)
      sync()
    }

    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [sync])

  return { isOnline, pendingCount, refreshCount }
}
```

- [ ] **Step 7: Add sync indicator to layout**

In `src/app/layout.tsx`, import and add a sync indicator. Add this component first:

Create `src/components/layout/sync-indicator.tsx`:

```tsx
'use client'

import { useOfflineSync } from '@/hooks/use-offline-sync'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'

export function SyncIndicator() {
  const { isOnline, pendingCount } = useOfflineSync()

  if (isOnline && pendingCount === 0) return null

  return (
    <div
      className={`fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium shadow-lg z-50 ${
        isOnline ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {isOnline ? (
        <><RefreshCw className="h-4 w-4 animate-spin" />{pendingCount} evento{pendingCount !== 1 ? 's' : ''} sincronizando...</>
      ) : (
        <><WifiOff className="h-4 w-4" />Sin conexión · {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</>
      )}
    </div>
  )
}
```

In `src/app/layout.tsx`, add `<SyncIndicator />` inside the `<main>` wrapper:

```tsx
// Add import:
import { SyncIndicator } from '@/components/layout/sync-indicator'

// Add inside the layout div, after <main>:
<SyncIndicator />
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/offline-queue.ts src/hooks/use-offline-sync.ts src/components/layout/sync-indicator.tsx src/app/layout.tsx src/__tests__/lib/offline-queue.test.ts
git commit -m "feat: add IndexedDB offline queue and sync indicator"
```

---

## Task 5: PWA setup

**Files:**
- Modify: `next.config.ts`
- Create: `public/manifest.json`

- [ ] **Step 1: Verify next-pwa is installed**

```bash
npm list next-pwa
```

If missing:
```bash
npm install next-pwa
```

- [ ] **Step 2: Configure next-pwa in next.config.ts**

Replace `next.config.ts`:

```typescript
import type { NextConfig } from 'next'
import withPWA from 'next-pwa'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
}

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // only active in production
})(nextConfig)
```

- [ ] **Step 3: Create web manifest**

Create `public/manifest.json`:

```json
{
  "name": "Hospimed Trazabilidad",
  "short_name": "Hospimed",
  "description": "Sistema de trazabilidad de desechos clínicos",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#0f172a",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 4: Add manifest link to layout**

In `src/app/layout.tsx`, update the `metadata` export:

```typescript
export const metadata: Metadata = {
  title: 'Hospimed — Trazabilidad',
  description: 'Sistema de trazabilidad de desechos clínicos',
  manifest: '/manifest.json',
  themeColor: '#0f172a',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}
```

- [ ] **Step 5: Create placeholder icons**

```bash
# Create a simple 192x192 placeholder icon (replace with real Hospimed logo)
# For now, copy any 192x192 PNG to public/icon-192.png and any 512x512 PNG to public/icon-512.png
# These are required for the PWA install prompt to appear
```

Ask the user to provide the Hospimed logo or place any PNG at `public/icon-192.png` and `public/icon-512.png`.

- [ ] **Step 6: Build and test PWA**

```bash
npm run build && npm start
```

Open `http://localhost:3000` in Chrome. Open DevTools → Application → Service Workers. Expected: service worker registered.

In Chrome DevTools → Application → Manifest: check manifest is detected.

- [ ] **Step 7: Commit**

```bash
git add next.config.ts public/manifest.json
git commit -m "feat: configure PWA with next-pwa and web manifest"
```

---

## Verification checklist — Plan 4 complete (all plans complete)

- [ ] `npm test` — all tests pass

```bash
npm test
```

Expected: all tests pass.

- [ ] `npm run build` — no errors

```bash
npm run build
```

- [ ] Full browser walkthrough:
  1. **Dashboard** → metrics, active batches, completed batches with filters
  2. **Batches** → click active batch → container list with phases
  3. **Report** → from completed batch → PDF downloads with cover, container pages, summary
  4. **Containers** → inventory table, search and all filters work
  5. **Container detail** → A-001: lifeline at correct phase, location history, photo gallery
  6. **Register** → weighing flow: 3 steps, saves to store, container phase updates in inventory
  7. **Register** → storage flow: saves, phase updates
  8. **Admin** → add new container, appears in inventory
  9. **Admin** → add new client, appears in exchange and location dropdowns
  10. **Offline** → DevTools → Network → Offline → try to register weighing → success screen shows → Network back online → sync indicator appears briefly

- [ ] Final commit

```bash
git add .
git commit -m "chore: Plan 4 complete — reports, admin CRUD, offline PWA"
```

---

## What's next

When the user shares the Hospimed PDF template, update `src/components/reports/batch-report-document.tsx` to match the visual layout.

When Supabase integration is ready:
1. Replace the Zustand mock store with Supabase queries
2. Wire up `use-offline-sync.ts` to actually POST queued events to the Supabase API
3. Add Supabase Auth to replace the mock login
4. Use Supabase Storage for photo URLs instead of base64 data URLs
