# Rediseño del Reporte Fotográfico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el reporte fotográfico para ordenarlo estrictamente por día → ruta → (recorrido + pesaje de esos tachos), con layout de 4 cuadros 2×2 (8 fotos por cuadro), salto de página por día, y selector de rango de fechas manual.

**Architecture:** `buildPhotographicReportData` pasa de una estructura `byStage` global a `days → groups` ordenados con etiqueta. El PDF arma "cuadros" de 8 fotos por grupo (cada grupo arranca cuadro nuevo, overflow continúa) y pagina de a 4 cuadros, con salto de página al cambiar de día. La UI agrega inputs de rango con default semana actual.

**Tech Stack:** Next.js 16, React 19, `@react-pdf/renderer` 4, Zustand, jest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-27-reporte-fotografico-rediseno-design.md`
**Referencia visual:** `docs/superpowers/specs/2026-05-27-reporte-ejemplo.png`

---

## File Structure

- `src/lib/data/reports.ts` — REWRITE de la estructura de datos + agrupación por día/ruta + helper `chunk`.
- `src/__tests__/lib/reports.test.ts` — REWRITE de tests al nuevo modelo.
- `src/components/reports/photographic-report-document.tsx` — REWRITE del layout PDF.
- `src/components/reports/report-preview.tsx` — MODIFY (campos renombrados + métricas).
- `src/app/reports/page.tsx` — MODIFY (inputs de rango desde/hasta).

---

## Task 1: Reescribir `reports.ts` (estructura días→grupos + agrupación)

**Files:**
- Modify (rewrite): `src/lib/data/reports.ts`

> Contexto: hoy la función filtra route_events y receptions de la empresa en un rango
> y devuelve `byStage.route` / `byStage.weighing` planos. Se reescribe para devolver
> `days: ReportDay[]`, donde cada día tiene grupos ordenados (recorrido + pesaje por
> ruta) más un grupo de pesajes "sin recorrido asociado" (para data histórica/Yaris).

- [ ] **Step 1: Reemplazar tipos y firma**

Reemplazar TODO el contenido de `src/lib/data/reports.ts` por:
```ts
import type {
  Client,
  Company,
  Container,
  RouteEvent,
  WeighingSession,
  ContainerReception,
  Photo,
  RouteSlot,
} from '@/lib/types'
import { getRouteSlotDefinition } from '@/lib/constants'

/** Una foto enriquecida con metadatos del contexto. */
export interface ReportPhotoEntry {
  photo: Photo
  container_id: string
  container: Container | null
  taken_at: string
  comment: string
}

/** Grupo de fotos con una etiqueta (se renderiza como un "cuadro" o varios si >8). */
export interface ReportPhotoGroup {
  label: string
  stage: 'route' | 'weighing'
  photos: ReportPhotoEntry[]
}

/** Un día del reporte. Cada día arranca en página nueva. */
export interface ReportDay {
  date: string // YYYY-MM-DD local
  groups: ReportPhotoGroup[]
}

export interface PhotographicReportData {
  company: Company
  client: Client
  rangeStart: string // YYYY-MM-DD
  rangeEnd: string // YYYY-MM-DD
  generatedAt: string
  days: ReportDay[]
  meta: {
    routeEventCount: number
    weighingReceptionCount: number
    routePhotoCount: number
    weighingPhotoCount: number
    totalPhotos: number
  }
}

export interface ReportStoreSlice {
  clients: Client[]
  companies: Company[]
  containers: Container[]
  routeEvents: RouteEvent[]
  weighingSessions: WeighingSession[]
  receptions: ContainerReception[]
  photos: Photo[]
}

export interface ReportRange {
  start: Date
  end: Date
}

/** Lunes 00:00 local de la semana que contiene `reference`. */
export function getMondayOfWeek(reference: Date = new Date()): Date {
  const d = new Date(reference)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Formatea una Date como `YYYY-MM-DD` en zona local. */
export function isoDate(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** true si `value` (ISO datetime) cae dentro de `[start, end]` inclusivos. */
export function withinRange(value: string, start: Date, end: Date): boolean {
  const t = new Date(value).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

/** Parte un array en sub-arrays de tamaño `size`. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
```

- [ ] **Step 2: Implementar `buildPhotographicReportData` (parte 1: filtros)**

Agregar a continuación en el mismo archivo:
```ts
/**
 * Arma el reporte fotográfico de una empresa para un rango.
 * - Default: [lunes 00:00 de la semana de `now`, `now`].
 * - Devuelve null si la empresa o el cliente no existen.
 *
 * Orden estricto: por día → por ruta (slot, cronológico) → grupo Recorrido luego
 * grupo Pesaje (recepciones de los tachos sucios recogidos en esa ruta). Las
 * recepciones que no estén atadas a ninguna ruta del rango se agrupan por su fecha
 * de pesaje en un grupo "Pesaje" al final del día.
 */
export function buildPhotographicReportData(
  companyId: string,
  store: ReportStoreSlice,
  range?: ReportRange,
): PhotographicReportData | null {
  const company = store.companies.find((co) => co.id === companyId)
  if (!company) return null
  const client = store.clients.find((c) => c.id === company.client_id)
  if (!client) return null

  const end = range?.end ?? new Date()
  const start = range?.start ?? getMondayOfWeek(end)

  const containers = store.containers.filter((c) => c.company_id === companyId)
  const containerIds = new Set(containers.map((c) => c.id))
  const containerMap = new Map(containers.map((c) => [c.id, c]))
  const photoMap = new Map(store.photos.map((p) => [p.id, p]))

  // route_events de andén en el rango que tocan a la empresa
  const routeEvents = store.routeEvents.filter((r) => {
    if (r.kind !== 'anden') return false
    if (!withinRange(r.started_at, start, end)) return false
    return (
      r.containers_dirty_received.some((cid) => containerIds.has(cid)) ||
      r.containers_clean_delivered.some((cid) => containerIds.has(cid))
    )
  })

  // receptions de la empresa en el rango
  const receptions = store.receptions.filter(
    (r) => containerIds.has(r.container_id) && withinRange(r.arrived_at, start, end),
  )
```

- [ ] **Step 3: Implementar parte 2 (agrupar por día/ruta + grupos)**

Continuar dentro de la misma función:
```ts
  // Índice: container_id → primera ruta (date, slot, started_at) donde fue recogido
  type RutaKey = string // `${date}__${slot}`
  const rutaOfContainer = new Map<string, { date: string; slot: RouteSlot; startedAt: string }>()
  const sortedRoutes = [...routeEvents].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  )
  for (const ev of sortedRoutes) {
    if (!ev.slot) continue
    for (const cid of ev.containers_dirty_received) {
      if (!containerIds.has(cid)) continue
      if (!rutaOfContainer.has(cid)) {
        rutaOfContainer.set(cid, { date: ev.date, slot: ev.slot, startedAt: ev.started_at })
      }
    }
  }

  // Agrupar route_events por ruta (date, slot)
  const routesByKey = new Map<RutaKey, RouteEvent[]>()
  for (const ev of sortedRoutes) {
    if (!ev.slot) continue
    const key = `${ev.date}__${ev.slot}`
    const arr = routesByKey.get(key) ?? []
    arr.push(ev)
    routesByKey.set(key, arr)
  }

  // Receptions por ruta key (para el grupo Pesaje de cada ruta)
  const receptionsByRuta = new Map<RutaKey, ContainerReception[]>()
  const orphanReceptions: ContainerReception[] = []
  for (const rec of receptions) {
    const ruta = rutaOfContainer.get(rec.container_id)
    if (ruta) {
      const key = `${ruta.date}__${ruta.slot}`
      const arr = receptionsByRuta.get(key) ?? []
      arr.push(rec)
      receptionsByRuta.set(key, arr)
    } else {
      orphanReceptions.push(rec)
    }
  }

  const byTakenAt = (a: ReportPhotoEntry, b: ReportPhotoEntry) =>
    new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()

  function routePhotoEntries(events: RouteEvent[]): ReportPhotoEntry[] {
    const out: ReportPhotoEntry[] = []
    for (const ev of events) {
      const dirtyOfCompany = ev.containers_dirty_received.filter((cid) => containerIds.has(cid))
      const cleanOfCompany = ev.containers_clean_delivered.filter((cid) => containerIds.has(cid))
      for (const photoId of ev.photo_ids) {
        const photo = photoMap.get(photoId)
        if (!photo) continue
        out.push({
          photo,
          container_id: dirtyOfCompany[0] ?? cleanOfCompany[0] ?? '',
          container: null,
          taken_at: photo.taken_at,
          comment: '',
        })
      }
    }
    return out.sort(byTakenAt)
  }

  function weighingPhotoEntries(recs: ContainerReception[]): ReportPhotoEntry[] {
    const out: ReportPhotoEntry[] = []
    const sorted = [...recs].sort(
      (a, b) => new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime(),
    )
    for (const rec of sorted) {
      const container = containerMap.get(rec.container_id) ?? null
      for (const photoId of rec.photo_ids) {
        const photo = photoMap.get(photoId)
        if (!photo) continue
        out.push({
          photo,
          container_id: rec.container_id,
          container,
          taken_at: photo.taken_at,
          comment: '',
        })
      }
    }
    return out
  }

  // Construir mapa día → grupos
  const dayMap = new Map<string, ReportPhotoGroup[]>()
  function pushGroup(date: string, group: ReportPhotoGroup) {
    if (group.photos.length === 0) return
    const arr = dayMap.get(date) ?? []
    arr.push(group)
    dayMap.set(date, arr)
  }

  // Rutas ordenadas por (date, started_at)
  const rutaKeys = [...routesByKey.keys()].sort((a, b) => {
    const [da, sa] = a.split('__')
    const [db, sb] = b.split('__')
    if (da !== db) return da < db ? -1 : 1
    return sa < sb ? -1 : 1
  })
  for (const key of rutaKeys) {
    const [date, slot] = key.split('__') as [string, RouteSlot]
    const def = getRouteSlotDefinition(slot)
    const events = routesByKey.get(key)!
    pushGroup(date, {
      label: `Recorrido — ${def.ordinal} ruta ${def.shortLabel}`,
      stage: 'route',
      photos: routePhotoEntries(events),
    })
    pushGroup(date, {
      label: `Pesaje — ${def.ordinal} ruta`,
      stage: 'weighing',
      photos: weighingPhotoEntries(receptionsByRuta.get(key) ?? []),
    })
  }

  // Pesajes huérfanos (sin recorrido en el rango): agrupar por fecha de pesaje
  const orphanByDate = new Map<string, ContainerReception[]>()
  for (const rec of orphanReceptions) {
    const d = isoDate(new Date(rec.arrived_at))
    const arr = orphanByDate.get(d) ?? []
    arr.push(rec)
    orphanByDate.set(d, arr)
  }
  for (const [date, recs] of orphanByDate) {
    pushGroup(date, {
      label: 'Pesaje',
      stage: 'weighing',
      photos: weighingPhotoEntries(recs),
    })
  }

  const days: ReportDay[] = [...dayMap.keys()]
    .sort()
    .map((date) => ({ date, groups: dayMap.get(date)! }))
```

- [ ] **Step 4: Implementar parte 3 (meta + return)**

Cerrar la función:
```ts
  let routePhotoCount = 0
  let weighingPhotoCount = 0
  for (const day of days) {
    for (const g of day.groups) {
      if (g.stage === 'route') routePhotoCount += g.photos.length
      else weighingPhotoCount += g.photos.length
    }
  }

  return {
    company,
    client,
    rangeStart: isoDate(start),
    rangeEnd: isoDate(end),
    generatedAt: new Date().toISOString(),
    days,
    meta: {
      routeEventCount: routeEvents.length,
      weighingReceptionCount: receptions.length,
      routePhotoCount,
      weighingPhotoCount,
      totalPhotos: routePhotoCount + weighingPhotoCount,
    },
  }
}
```

- [ ] **Step 5: Verificar que compila el módulo**

Run: `npx tsc --noEmit 2>&1 | grep "src/lib/data/reports.ts" || echo "reports.ts OK"`
Expected: `reports.ts OK` (los errores en `reports.test.ts` / `report-preview` / `reports/page` se arreglan en Tasks 2-4).

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/reports.ts
git commit -m "feat(reportes): estructura días→grupos ordenada por ruta (recorrido + pesaje)"
```
(footer: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`)

---

## Task 2: Reescribir tests de `reports.ts`

**Files:**
- Modify (rewrite): `src/__tests__/lib/reports.test.ts`

> Los tests corren bajo **jest** (globals describe/it/expect, sin import de vitest).

- [ ] **Step 1: Reemplazar el archivo de tests**

Reemplazar TODO el contenido por:
```ts
import {
  buildPhotographicReportData,
  getMondayOfWeek,
  isoDate,
  chunk,
} from '@/lib/data/reports'
import type { ReportStoreSlice } from '@/lib/data/reports'
import {
  MOCK_CLIENTS,
  MOCK_COMPANIES,
  MOCK_CONTAINERS,
  MOCK_ROUTE_EVENTS,
  MOCK_WEIGHING_SESSIONS,
  MOCK_RECEPTIONS,
  MOCK_PHOTOS,
} from '@/lib/mock-data'

describe('getMondayOfWeek', () => {
  it('returns the same date when reference is Monday', () => {
    const monday = new Date(2026, 4, 11, 14, 32)
    expect(isoDate(getMondayOfWeek(monday))).toBe('2026-05-11')
    expect(getMondayOfWeek(monday).getHours()).toBe(0)
  })
  it('returns previous Monday when reference is Wednesday', () => {
    expect(isoDate(getMondayOfWeek(new Date(2026, 4, 13, 10, 0)))).toBe('2026-05-11')
  })
  it('returns previous Monday when reference is Sunday', () => {
    expect(isoDate(getMondayOfWeek(new Date(2026, 4, 17, 23, 59)))).toBe('2026-05-11')
  })
})

describe('chunk', () => {
  it('parte en sub-arrays del tamaño dado', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('buildPhotographicReportData (por empresa)', () => {
  const store: ReportStoreSlice = {
    clients: MOCK_CLIENTS,
    companies: MOCK_COMPANIES,
    containers: MOCK_CONTAINERS,
    routeEvents: MOCK_ROUTE_EVENTS,
    weighingSessions: MOCK_WEIGHING_SESSIONS,
    receptions: MOCK_RECEPTIONS,
    photos: MOCK_PHOTOS,
  }
  const range = { start: new Date(2026, 4, 11, 0, 0), end: new Date(2026, 4, 17, 23, 59) }

  it('returns null when company does not exist', () => {
    expect(buildPhotographicReportData('nonexistent', store, range)).toBeNull()
  })

  it('arma el reporte de ION ordenado por ruta (recorrido luego pesaje)', () => {
    const data = buildPhotographicReportData('company-ion', store, range)!
    expect(data.company.name).toBe('ION')
    expect(data.rangeStart).toBe('2026-05-11')
    expect(data.rangeEnd).toBe('2026-05-17')

    // Un solo día con actividad
    expect(data.days.length).toBe(1)
    const day = data.days[0]
    expect(day.date).toBe('2026-05-17')

    // Orden de grupos: Recorrido 1ra, Pesaje 1ra, Recorrido 2da
    // (Pesaje 2da se omite: I-003 no tiene reception)
    const labels = day.groups.map((g) => g.label)
    expect(labels[0]).toContain('Recorrido')
    expect(labels[0]).toContain('1.ª')
    expect(labels[1]).toContain('Pesaje')
    expect(labels[1]).toContain('1.ª')
    expect(labels[2]).toContain('Recorrido')
    expect(labels[2]).toContain('2.ª')

    // Conteos de fotos
    expect(data.meta.routePhotoCount).toBe(5) // r1: 3, r2: 2
    expect(data.meta.weighingPhotoCount).toBe(4) // reception-1 (2) + reception-2 (2)
    expect(data.meta.totalPhotos).toBe(9)
    expect(data.meta.routeEventCount).toBe(2)
    expect(data.meta.weighingReceptionCount).toBe(2)
  })

  it('incluye pesajes históricos sin recorrido (Airkem) como grupo propio', () => {
    const airkem = buildPhotographicReportData('company-airkem', store, range)!
    // Airkem tiene receptions históricas (sin route_events que las recojan en rango)
    expect(airkem.meta.weighingReceptionCount).toBeGreaterThan(0)
    // Deben aparecer como grupos de pesaje en algún día
    const hasWeighingGroup = airkem.days.some((d) => d.groups.some((g) => g.stage === 'weighing'))
    expect(hasWeighingGroup).toBe(true)
  })

  it('devuelve vacío cuando el rango no tiene actividad', () => {
    const empty = { start: new Date(2027, 0, 1), end: new Date(2027, 0, 15, 23, 59) }
    const data = buildPhotographicReportData('company-ion', store, empty)!
    expect(data.meta.totalPhotos).toBe(0)
    expect(data.days).toEqual([])
  })
})
```

- [ ] **Step 2: Correr los tests**

Run: `npx jest src/__tests__/lib/reports.test.ts`
Expected: PASS (todos). Si `weighingReceptionCount` de Airkem o el conteo de ION
difiere por datos históricos, ajustar la aserción al valor real observado
(los conteos de ION son deterministas: route 5 fotos, weighing 4 fotos).

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/lib/reports.test.ts
git commit -m "test(reportes): cubrir nueva estructura días→grupos y orden por ruta"
```

---

## Task 3: Reescribir el layout del PDF

**Files:**
- Modify (rewrite): `src/components/reports/photographic-report-document.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplazar TODO el contenido por:
```tsx
import {
  Document, Page, Text, View, Image, StyleSheet,
} from '@react-pdf/renderer'
import { APP_NAME } from '@/lib/constants'
import { chunk } from '@/lib/data/reports'
import type { PhotographicReportData, ReportDay, ReportPhotoEntry } from '@/lib/data/reports'

const PHOTOS_PER_CUADRO = 8 // 4 columnas × 2 filas
const CUADROS_PER_PAGE = 4 // 2 × 2

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 28,
    paddingHorizontal: 20,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  title: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  metaBar: {
    flexDirection: 'row',
    border: '0.5 solid #94a3b8',
    marginBottom: 8,
  },
  metaCell: {
    flexDirection: 'row',
    borderRight: '0.5 solid #94a3b8',
  },
  metaLabel: {
    paddingVertical: 3,
    paddingHorizontal: 5,
    backgroundColor: '#e2e8f0',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#334155',
  },
  metaValue: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 7,
    color: '#0f172a',
    minWidth: 60,
  },
  cuadrosWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cuadro: {
    width: '48.8%',
    border: '0.5 solid #94a3b8',
    borderRadius: 2,
  },
  cuadroHeader: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottom: '0.5 solid #94a3b8',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#334155',
    textAlign: 'center',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 2,
    minHeight: 150,
  },
  photoCell: {
    width: '25%',
    padding: 1,
  },
  photoBox: {
    aspectRatio: 4 / 3,
    width: '100%',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  comentario: {
    flexDirection: 'row',
    borderTop: '0.5 solid #94a3b8',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  comentarioLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#334155',
  },
  comentarioText: {
    fontSize: 7,
    color: '#0f172a',
    marginLeft: 3,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 12,
    right: 20,
    fontSize: 7,
    color: '#94a3b8',
  },
  empty: {
    margin: 32,
    padding: 32,
    border: '1 dashed #cbd5e1',
    borderRadius: 6,
    alignItems: 'center',
  },
  emptyText: { color: '#64748b', fontSize: 10 },
})

interface Cuadro {
  label: string
  photos: ReportPhotoEntry[]
}

/** Convierte los grupos de un día en cuadros de hasta 8 fotos (overflow → (cont.)). */
function buildCuadros(day: ReportDay): Cuadro[] {
  const cuadros: Cuadro[] = []
  for (const group of day.groups) {
    const parts = chunk(group.photos, PHOTOS_PER_CUADRO)
    parts.forEach((photos, i) => {
      cuadros.push({ label: i === 0 ? group.label : `${group.label} (cont.)`, photos })
    })
  }
  return cuadros
}

function MetaBar({ companyName, fecha }: { companyName: string; fecha: string }) {
  return (
    <View style={styles.metaBar} fixed>
      <View style={styles.metaCell}>
        <Text style={styles.metaLabel}>Edificio</Text>
        <Text style={styles.metaValue}>—</Text>
      </View>
      <View style={styles.metaCell}>
        <Text style={styles.metaLabel}>Ubicación</Text>
        <Text style={styles.metaValue}>PTDP</Text>
      </View>
      <View style={styles.metaCell}>
        <Text style={styles.metaLabel}>Empresa</Text>
        <Text style={styles.metaValue}>{companyName}</Text>
      </View>
      <View style={[styles.metaCell, { borderRight: 'none' }]}>
        <Text style={styles.metaLabel}>Fecha</Text>
        <Text style={styles.metaValue}>{fecha}</Text>
      </View>
    </View>
  )
}

function CuadroView({ cuadro }: { cuadro: Cuadro }) {
  return (
    <View style={styles.cuadro} wrap={false}>
      <Text style={styles.cuadroHeader}>{cuadro.label}</Text>
      <View style={styles.photoGrid}>
        {cuadro.photos.map((entry) => (
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

function DayPages({ day, companyName }: { day: ReportDay; companyName: string }) {
  const cuadros = buildCuadros(day)
  const pages = chunk(cuadros, CUADROS_PER_PAGE)
  return (
    <>
      {pages.map((pageCuadros, idx) => (
        <Page key={`${day.date}-${idx}`} size="A4" orientation="landscape" style={styles.page}>
          <Text style={styles.title} fixed>REGISTRO FOTOGRÁFICO</Text>
          <MetaBar companyName={companyName} fecha={day.date} />
          <View style={styles.cuadrosWrap}>
            {pageCuadros.map((c, i) => (
              <CuadroView key={`${day.date}-${idx}-${i}`} cuadro={c} />
            ))}
          </View>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            fixed
          />
        </Page>
      ))}
    </>
  )
}

interface Props {
  data: PhotographicReportData
}

export function PhotographicReportDocument({ data }: Props) {
  const { company, days, meta } = data
  return (
    <Document title={`${APP_NAME} — Registro Fotográfico — ${company.name}`}>
      {days.map((day) => (
        <DayPages key={day.date} day={day} companyName={company.name} />
      ))}
      {meta.totalPhotos === 0 && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <Text style={styles.title}>REGISTRO FOTOGRÁFICO</Text>
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No hay registros fotográficos para {company.name} en el rango {data.rangeStart} a {data.rangeEnd}.
            </Text>
          </View>
        </Page>
      )}
    </Document>
  )
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep "photographic-report-document" || echo "doc OK"`
Expected: `doc OK`.

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/photographic-report-document.tsx
git commit -m "feat(reportes): layout 4 cuadros 2x2 (8 fotos), salto de página por día"
```

---

## Task 4: Actualizar preview y página de reportes (rango de fechas)

**Files:**
- Modify: `src/components/reports/report-preview.tsx`
- Modify: `src/app/reports/page.tsx`

- [ ] **Step 1: Actualizar `report-preview.tsx` a los nuevos campos**

En `src/components/reports/report-preview.tsx`, reemplazar la línea de desestructuración:
```tsx
  const { company, client, weekStart, weekEnd, meta, byStage } = data
```
por:
```tsx
  const { company, client, rangeStart, rangeEnd, meta } = data
```
Reemplazar la construcción del filename:
```tsx
  const filename = `${APP_NAME}_RegistroFotografico_${safeName}_${weekStart}_${weekEnd}.pdf`
```
por:
```tsx
  const filename = `${APP_NAME}_RegistroFotografico_${safeName}_${rangeStart}_${rangeEnd}.pdf`
```
Reemplazar el subtítulo del header:
```tsx
              {client.name} · Semana del {weekStart} al {weekEnd}
```
por:
```tsx
              {client.name} · {rangeStart} al {rangeEnd}
```
Reemplazar las dos `MetricBox` que usan `byStage`:
```tsx
          <MetricBox
            icon={<Route className="h-4 w-4" />}
            label="Recorridos"
            value={meta.routeEventCount}
            secondary={`${byStage.route.length} foto${byStage.route.length !== 1 ? 's' : ''}`}
          />
          <MetricBox
            icon={<Scale className="h-4 w-4" />}
            label="Pesajes"
            value={meta.weighingReceptionCount}
            secondary={`${byStage.weighing.length} foto${byStage.weighing.length !== 1 ? 's' : ''}`}
          />
```
por:
```tsx
          <MetricBox
            icon={<Route className="h-4 w-4" />}
            label="Recorridos"
            value={meta.routeEventCount}
            secondary={`${meta.routePhotoCount} foto${meta.routePhotoCount !== 1 ? 's' : ''}`}
          />
          <MetricBox
            icon={<Scale className="h-4 w-4" />}
            label="Pesajes"
            value={meta.weighingReceptionCount}
            secondary={`${meta.weighingPhotoCount} foto${meta.weighingPhotoCount !== 1 ? 's' : ''}`}
          />
```

- [ ] **Step 2: Verificar preview compila**

Run: `npx tsc --noEmit 2>&1 | grep "report-preview" || echo "preview OK"`
Expected: `preview OK`.

- [ ] **Step 3: Reescribir `reports/page.tsx` con inputs de rango**

Reemplazar TODO el contenido de `src/app/reports/page.tsx` por:
```tsx
'use client'

import { useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useStore } from '@/lib/store'
import {
  buildPhotographicReportData,
  getMondayOfWeek,
  isoDate,
} from '@/lib/data/reports'
import { ReportPreview } from '@/components/reports/report-preview'

export default function ReportsPage() {
  const {
    clients, companies, containers, routeEvents, weighingSessions, receptions, photos,
  } = useStore()

  const clientNameMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.name])),
    [clients],
  )

  const [companyId, setCompanyId] = useState<string>(companies[0]?.id ?? '')

  const now = useMemo(() => new Date(), [])
  const defaultStart = useMemo(() => isoDate(getMondayOfWeek(now)), [now])
  const defaultEnd = useMemo(() => isoDate(now), [now])

  const [startStr, setStartStr] = useState<string>(defaultStart)
  const [endStr, setEndStr] = useState<string>(defaultEnd)

  const invalidRange = startStr > endStr

  const reportData = useMemo(() => {
    if (!companyId || invalidRange) return null
    // input date (YYYY-MM-DD) → rango local [00:00, 23:59:59]
    const start = new Date(`${startStr}T00:00:00`)
    const end = new Date(`${endStr}T23:59:59`)
    return buildPhotographicReportData(
      companyId,
      { clients, companies, containers, routeEvents, weighingSessions, receptions, photos },
      { start, end },
    )
  }, [companyId, startStr, endStr, invalidRange, clients, companies, containers, routeEvents, weighingSessions, receptions, photos])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Genera el registro fotográfico por empresa. Por defecto cubre la semana actual,
          pero podés elegir cualquier rango de fechas. Las fotos se ordenan por día,
          ruta y etapa (recorrido y luego pesaje). Un PDF por empresa.
        </p>
      </header>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Empresa</label>
            <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? '')}>
              <SelectTrigger className="w-full sm:max-w-md">
                <SelectValue placeholder="Seleccionar empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((co) => (
                  <SelectItem key={co.id} value={co.id}>
                    {co.name} <span className="text-muted-foreground">({clientNameMap[co.client_id] ?? '—'})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Desde</label>
              <Input type="date" value={startStr} max={endStr} onChange={(e) => setStartStr(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Hasta</label>
              <Input type="date" value={endStr} min={startStr} onChange={(e) => setEndStr(e.target.value)} />
            </div>
          </div>

          {invalidRange ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              La fecha "Desde" no puede ser posterior a "Hasta".
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Rango: <strong className="text-foreground">{startStr}</strong> al{' '}
                <strong className="text-foreground">{endStr}</strong>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {reportData ? (
        <ReportPreview data={reportData} />
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {invalidRange ? 'Corregí el rango de fechas para ver el reporte.' : 'Selecciona una empresa para ver el reporte.'}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep -E "reports/page|report-preview|reports.ts" | grep -v "\.test\." || echo "OK"`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/report-preview.tsx src/app/reports/page.tsx
git commit -m "feat(reportes): selector de rango de fechas (default semana actual)"
```

---

## Task 5: Verificación final + vault

**Files:** ninguno (verificación) + vault

- [ ] **Step 1: Suite de tests**

Run: `npx jest src/__tests__/lib/reports.test.ts src/__tests__/lib/route-sessions.test.ts`
Expected: PASS.

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 3: Verificación manual (dev)**

Run: `npm run dev`. En `/reports`:
1. Seleccionar empresa ION → ver métricas (Recorridos 2 / 5 fotos, Pesajes 2 / 4 fotos, Total 9).
2. Descargar PDF: confirmar layout horizontal, "REGISTRO FOTOGRÁFICO", barra de metadatos con la fecha del día, 4 cuadros 2×2, cada cuadro con su etiqueta ("Recorrido — 1.ª ruta 6:30 AM", "Pesaje — 1.ª ruta", "Recorrido — 2.ª ruta 10:30 AM"), fotos 4×2 dentro del cuadro, "Comentario:" con la etiqueta.
3. Cambiar el rango "Desde/Hasta" a un rango con varios días → confirmar salto de página por día.
4. Probar rango inválido (desde > hasta) → muestra aviso, no genera.

- [ ] **Step 4: Actualizar vault**

Añadir al log `vault/logs/2026-05-27-pesaje-login-recorridos-multianden.md` una sección
"## 5. Reportes — rediseño" describiendo: orden día→ruta→(recorrido+pesaje), layout 4
cuadros 2×2 / 8 fotos, salto por día, rango de fechas, y el grupo de pesajes huérfanos
para data histórica. Actualizar la nota de procesamiento en `vault/_index.md` (quitar
"reporte pendiente"). Referenciar spec/plan de reportes.

- [ ] **Step 5: Commit vault**

```bash
git add vault/
git commit -m "docs(vault): log del rediseño del reporte fotográfico"
```

---

## Notas de la auto-revisión

- **Cobertura del spec:** estructura días→grupos (T1), tests (T2), layout 2×2/8 fotos/salto por día (T3), rango de fechas + preview (T4), verificación + vault (T5). Grupo de pesajes huérfanos cubre la data histórica (Airkem) para no regresar.
- **Consistencia de tipos:** `PhotographicReportData` ahora expone `rangeStart/rangeEnd/days/meta{routePhotoCount,weighingPhotoCount,...}`; `report-preview` y `reports/page` se actualizan en T4 (eliminan `weekStart/weekEnd/byStage`). `chunk` se exporta desde `reports.ts` y se reusa en el PDF.
- **Placeholders:** ninguno; todo el código está completo.
- **Riesgo conocido:** el conteo histórico exacto de Airkem puede variar; el test usa `toBeGreaterThan(0)` en vez de un número fijo. Los conteos de ION son deterministas y se asertan exactos.
