# Editor del Registro Fotográfico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un editor de pantalla completa en el hub donde el equipo reacomoda el registro fotográfico arrastrando cuadros y fotos, y descarga el PDF editado con el mismo diseño que el automático.

**Architecture:** El PDF pasa a dibujarse desde una "maqueta" (`ReportLayout`: días → cuadros → 8 recuadros con su foto). `buildReportLayout(data)` produce la maqueta automática; el botón actual la imprime tal cual y el editor la modifica con funciones puras antes de imprimirla con el mismo componente. La UI de arrastre usa `@dnd-kit`; toda la lógica (maqueta, acciones, árbol del buscador) es pura y se prueba con jest.

**Tech Stack:** Next.js 16 (export estático, `--webpack`), React 19, `@react-pdf/renderer` 4, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`, Tailwind 3, jest + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-02-editor-registro-fotografico-design.md`

## Global Constraints

- Código de shared se importa como `@hospiwaste/shared/...`; `@/*` es local del hub.
- El hub es export estático (`output: 'export'`): nada de rutas dinámicas de servidor; los parámetros del editor van por query string.
- Comandos desde `hub/`: tests `npx jest <ruta>`; build `npm run build` (usa `--webpack`).
- Sin persistencia: ni base de datos, ni localStorage. Cerrar la pestaña pierde la edición.
- Filtros idénticos al reporte: empresa + rango de `/reports`, recepciones no anuladas, sin `anatomopathological` ni `cytotoxic`.
- Buscador: solo pesajes. Fotos de recorrido no aparecen en él.
- Páginas automáticas: 4 cuadros por hoja; cada día empieza en hoja nueva.
- Un cuadro solo se mueve dentro de su día.
- Textos de UI en español.
- "Descargar reporte" de `/reports` sigue produciendo el PDF automático (mismas fotos en las mismas posiciones).

## Review Focus

1. **Store todavía cargando al abrir el editor por URL o al recargar** → se ve "Cargando reporte…" y, cuando llegan los datos, la maqueta automática; una actualización del store después de la primera edición no pisa lo editado. (Diseño en Task 5: `edited ?? baseLayout`; verificación manual en Task 6.)
2. **Query string inválido** (sin `company`, fecha mal escrita, Desde > Hasta) → mensaje con enlace a Reportes, sin romper. Test de `parseReportRange` en Task 4.
3. **Un día al que le borraron todos los cuadros** → el PDF no tiene hoja en blanco para ese día; el editor sigue mostrando "+ Agregar cuadro". Test de `paginateDay` en Task 1.
4. **La misma foto en dos recuadros** → se descarga una sola vez. Test de `layoutPhotoUrls` en Task 1.
5. **Cuadro soltado sobre un cuadro de otro día, o foto soltada sobre su propio recuadro** → no cambia nada. Tests de `applyDragEnd` en Task 2.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `hub/src/lib/data/report-layout.ts` (nuevo) | Tipos de la maqueta, `buildReportLayout`, paginado, urls/fotos en uso, acciones puras, `applyDragEnd` |
| `hub/src/lib/data/photo-browser-tree.ts` (nuevo) | Árbol día → sesión → tacho/contenedor para el buscador |
| `hub/src/lib/data/reports.ts` | + `selectReportReceptions`, `parseReportRange`, `reportFilename`; − `reportPhotoUrls` |
| `hub/src/components/reports/photographic-report-document.tsx` | El PDF dibuja una `ReportLayout` |
| `hub/src/components/reports/report-download.tsx` (nuevo) | Hook de descarga + etiqueta del botón + mensajes (compartido por `/reports` y el editor) |
| `hub/src/components/reports/report-preview.tsx` | Usa el hook; botón "Editar reporte" |
| `hub/src/app/reports/page.tsx` | Usa `parseReportRange` |
| `hub/src/app/reports/editor/page.tsx` (nuevo) | Ruta del editor |
| `hub/src/components/reports/editor/report-editor.tsx` (nuevo) | Estado, `DndContext`, header, layout de pantalla |
| `hub/src/components/reports/editor/photo-browser.tsx` (nuevo) | Panel izquierdo |
| `hub/src/components/reports/editor/report-canvas.tsx` (nuevo) | Hojas, cuadros ordenables, recuadros |
| `hub/src/__tests__/lib/report-layout.test.ts` (nuevo) | Tests de la maqueta y acciones |
| `hub/src/__tests__/lib/photo-browser-tree.test.ts` (nuevo) | Tests del árbol |
| `hub/src/__tests__/lib/reports.test.ts` | Ajustes por `reportPhotoUrls` → `layoutPhotoUrls`; tests nuevos de helpers |

---

### Task 1: La maqueta y el PDF que la dibuja

**Files:**
- Create: `hub/src/lib/data/report-layout.ts`
- Create: `hub/src/__tests__/lib/report-layout.test.ts`
- Modify: `hub/src/lib/data/reports.ts` (borrar `reportPhotoUrls`, líneas ~106-119)
- Modify: `hub/src/components/reports/photographic-report-document.tsx`
- Modify: `hub/src/components/reports/report-preview.tsx`
- Modify: `hub/src/__tests__/lib/reports.test.ts`

**Interfaces:**
- Consumes: `PhotographicReportData`, `chunk` de `@/lib/data/reports`; `Photo` de shared.
- Produces:
  - `SLOTS_PER_CUADRO = 8`, `COLUMNS = 4`, `CUADROS_PER_PAGE = 4`
  - `interface LayoutCuadro { id: string; label: string; comment: string; slots: (Photo | null)[] }`
  - `interface LayoutDay { date: string; cuadros: LayoutCuadro[] }`
  - `interface ReportLayout { days: LayoutDay[] }`
  - `buildReportLayout(data: PhotographicReportData): ReportLayout`
  - `paginateDay(day: LayoutDay): LayoutCuadro[][]`
  - `layoutPhotoUrls(layout: ReportLayout): string[]`
  - `usedPhotoIds(layout: ReportLayout): Set<string>`
  - `PhotographicReportDocument({ data, layout, images })`

Nota de diseño: los recuadros guardan el `Photo` completo (no solo el id) para que el PDF y el canvas no necesiten un mapa aparte; la comparación "en uso" es por `photo.id`.

- [ ] **Step 1: Write the failing test**

Crear `hub/src/__tests__/lib/report-layout.test.ts`:

```ts
import type { Photo } from '@hospiwaste/shared/lib/types'
import type { PhotographicReportData } from '@/lib/data/reports'
import {
  buildReportLayout,
  paginateDay,
  layoutPhotoUrls,
  usedPhotoIds,
  type ReportLayout,
} from '@/lib/data/report-layout'

const ph = (id: string): Photo => ({
  id, url: `u-${id}`, event_type: 'weighing', event_id: 'e', taken_at: '2026-05-17T09:00:00-05:00', label: '',
})

function data(days: PhotographicReportData['days']): PhotographicReportData {
  return {
    company: { id: 'company-ion', name: 'ION' } as PhotographicReportData['company'],
    client: { id: 'client-1', name: 'PTDP' } as PhotographicReportData['client'],
    rangeStart: '2026-05-11', rangeEnd: '2026-05-17', generatedAt: '',
    days,
    meta: { routeEventCount: 0, weighingReceptionCount: 0, routePhotoCount: 0, weighingPhotoCount: 0, totalPhotos: 0 },
  }
}

const routeEntry = (id: string) => ({ photo: ph(id), container_id: null, container: null, taken_at: '', comment: '' })
const pair = (n: number) => ({ container_id: `T${n}`, container: null, scale: ph(`s${n}`), tacho: ph(`t${n}`) })

describe('buildReportLayout', () => {
  it('recorrido: 8 fotos por cuadro en orden, fila por fila, y corta en "(cont.)"', () => {
    const photos = Array.from({ length: 10 }, (_, i) => routeEntry(`r${i}`))
    const layout = buildReportLayout(data([{ date: '2026-05-17', groups: [{ label: 'Recorrido — 1.ª ruta', stage: 'route', photos }] }]))
    const [a, b] = layout.days[0].cuadros
    expect(a.label).toBe('Recorrido — 1.ª ruta')
    expect(a.comment).toBe('Recorrido — 1.ª ruta')
    expect(a.slots.map((p) => p?.id)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'])
    expect(b.label).toBe('Recorrido — 1.ª ruta (cont.)')
    expect(b.slots.map((p) => p?.id ?? null)).toEqual(['r8', 'r9', null, null, null, null, null, null])
  })

  it('pesaje: par i en la columna i — balanza arriba, tacho abajo; 4 pares por cuadro', () => {
    const pairs = [1, 2, 3, 4, 5].map(pair)
    const layout = buildReportLayout(data([{ date: '2026-05-17', groups: [{ label: 'Pesaje — 1.ª ruta', stage: 'weighing', photos: [], pairs }] }]))
    const [a, b] = layout.days[0].cuadros
    expect(a.slots.map((p) => p?.id)).toEqual(['s1', 's2', 's3', 's4', 't1', 't2', 't3', 't4'])
    expect(b.label).toBe('Pesaje — 1.ª ruta (cont.)')
    expect(b.slots.map((p) => p?.id ?? null)).toEqual(['s5', null, null, null, 't5', null, null, null])
  })

  it('ids de cuadro únicos y estables entre llamadas', () => {
    const d = data([{ date: '2026-05-17', groups: [
      { label: 'R', stage: 'route', photos: [routeEntry('r0')] },
      { label: 'P', stage: 'weighing', photos: [], pairs: [pair(1)] },
    ] }])
    const ids = buildReportLayout(d).days[0].cuadros.map((c) => c.id)
    expect(new Set(ids).size).toBe(2)
    expect(buildReportLayout(d).days[0].cuadros.map((c) => c.id)).toEqual(ids)
  })
})

describe('paginateDay', () => {
  const cuadro = (id: string) => ({ id, label: id, comment: id, slots: [] })
  it('4 cuadros por hoja', () => {
    const pages = paginateDay({ date: 'd', cuadros: ['a', 'b', 'c', 'd', 'e'].map(cuadro) })
    expect(pages.map((p) => p.map((c) => c.id))).toEqual([['a', 'b', 'c', 'd'], ['e']])
  })
  it('un día sin cuadros no produce hojas', () => {
    expect(paginateDay({ date: 'd', cuadros: [] })).toEqual([])
  })
})

describe('layoutPhotoUrls / usedPhotoIds', () => {
  const layout: ReportLayout = { days: [{ date: 'd', cuadros: [
    { id: 'a', label: '', comment: '', slots: [ph('x'), null, ph('y')] },
    { id: 'b', label: '', comment: '', slots: [ph('x')] },
  ] }] }
  it('la misma foto en dos recuadros se descarga una sola vez', () => {
    expect(layoutPhotoUrls(layout).sort()).toEqual(['u-x', 'u-y'])
  })
  it('fotos en uso por id', () => {
    expect([...usedPhotoIds(layout)].sort()).toEqual(['x', 'y'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (desde `hub/`): `npx jest src/__tests__/lib/report-layout.test.ts`
Expected: FAIL — `Cannot find module '@/lib/data/report-layout'`.

- [ ] **Step 3: Write minimal implementation**

Crear `hub/src/lib/data/report-layout.ts`:

```ts
import type { Photo } from '@hospiwaste/shared/lib/types'
import { chunk, type PhotographicReportData } from './reports'

/**
 * La "maqueta" del registro fotográfico: lo que el PDF dibuja. El reporte
 * automático la arma con `buildReportLayout`; el editor la modifica con las
 * acciones de abajo. Las dos descargas usan el mismo componente PDF.
 */

/** Recuadros por cuadro: grilla de 4 columnas × 2 filas. */
export const SLOTS_PER_CUADRO = 8
/** Columnas de la grilla; en pesaje, una por par (balanza arriba, tacho abajo). */
export const COLUMNS = 4
export const CUADROS_PER_PAGE = 4

export interface LayoutCuadro {
  id: string
  label: string
  comment: string
  /** SLOTS_PER_CUADRO posiciones: [0..3] fila de arriba, [4..7] fila de abajo. */
  slots: (Photo | null)[]
}

export interface LayoutDay {
  date: string
  cuadros: LayoutCuadro[]
}

export interface ReportLayout {
  days: LayoutDay[]
}

const emptySlots = (): (Photo | null)[] => Array<Photo | null>(SLOTS_PER_CUADRO).fill(null)

export function buildReportLayout(data: PhotographicReportData): ReportLayout {
  return {
    days: data.days.map((day) => {
      const cuadros: LayoutCuadro[] = []
      const push = (label: string, slots: (Photo | null)[]) =>
        cuadros.push({ id: `${day.date}-${cuadros.length}`, label, comment: label, slots })

      for (const group of day.groups) {
        if (group.stage === 'weighing' && group.pairs) {
          chunk(group.pairs, COLUMNS).forEach((pairs, i) => {
            const slots = emptySlots()
            pairs.forEach((pair, col) => {
              slots[col] = pair.scale
              slots[COLUMNS + col] = pair.tacho
            })
            push(i === 0 ? group.label : `${group.label} (cont.)`, slots)
          })
        } else {
          chunk(group.photos, SLOTS_PER_CUADRO).forEach((entries, i) => {
            const slots = emptySlots()
            entries.forEach((entry, k) => {
              slots[k] = entry.photo
            })
            push(i === 0 ? group.label : `${group.label} (cont.)`, slots)
          })
        }
      }
      return { date: day.date, cuadros }
    }),
  }
}

/** Hojas de un día: 4 cuadros por hoja. Un día sin cuadros no tiene hojas. */
export function paginateDay(day: LayoutDay): LayoutCuadro[][] {
  return chunk(day.cuadros, CUADROS_PER_PAGE)
}

function layoutPhotos(layout: ReportLayout): Photo[] {
  return layout.days.flatMap((d) => d.cuadros.flatMap((c) => c.slots)).filter((p): p is Photo => p !== null)
}

/** Urls a descargar para el PDF, sin repetir. */
export function layoutPhotoUrls(layout: ReportLayout): string[] {
  return [...new Set(layoutPhotos(layout).map((p) => p.url))].filter(Boolean)
}

/** Ids de las fotos presentes en algún recuadro (marca "en uso" del buscador). */
export function usedPhotoIds(layout: ReportLayout): Set<string> {
  return new Set(layoutPhotos(layout).map((p) => p.id))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/report-layout.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: El PDF dibuja la maqueta**

En `hub/src/components/reports/photographic-report-document.tsx`:

1. Reemplazar los imports y constantes del inicio:

```tsx
import {
  Document, Page, Text, View, Image, StyleSheet,
} from '@react-pdf/renderer'
import { APP_NAME } from '@hospiwaste/shared/lib/constants'
import type { PhotographicReportData } from '@/lib/data/reports'
import { paginateDay, type LayoutCuadro, type LayoutDay, type ReportLayout } from '@/lib/data/report-layout'
```

(se borran `PHOTOS_PER_CUADRO`, `PAIRS_PER_CUADRO`, `CUADROS_PER_PAGE`, el import de `chunk` y los tipos `ReportDay`, `ReportPhotoEntry`, `WeighingPair`).

2. En `styles`, borrar `minHeight: 150` de `photoGrid` y agregar después de `photo`:

```tsx
  // Recuadro sin foto: mismo alto que uno con foto, en blanco.
  emptyBox: {
    height: 96,
  },
```

3. Borrar la interfaz `Cuadro` y la función `buildCuadros` completas.

4. Reemplazar `CuadroView`, `DayPages`, `Props` y `PhotographicReportDocument` por:

```tsx
function CuadroView({ cuadro, images }: { cuadro: LayoutCuadro; images: ReportImages }) {
  return (
    <View style={styles.cuadro} wrap={false}>
      <Text style={styles.cuadroHeader}>{cuadro.label}</Text>
      <View style={styles.photoGrid}>
        {cuadro.slots.map((photo, i) => (
          <View key={i} style={styles.photoCell}>
            {photo ? (
              <View style={styles.photoBox}>
                <ReportPhoto url={photo.url} images={images} />
              </View>
            ) : (
              <View style={styles.emptyBox} />
            )}
          </View>
        ))}
      </View>
      <View style={styles.comentario}>
        <Text style={styles.comentarioLabel}>Comentario:</Text>
        <Text style={styles.comentarioText}>{cuadro.comment}</Text>
      </View>
    </View>
  )
}

function DayPages({ day, companyName, images }: { day: LayoutDay; companyName: string; images: ReportImages }) {
  return (
    <>
      {paginateDay(day).map((pageCuadros, idx) => (
        <Page key={`${day.date}-${idx}`} size="A4" orientation="landscape" style={styles.page}>
          <PageHeader />
          <MetaBar companyName={companyName} fecha={day.date} />
          <View style={styles.cuadrosWrap}>
            {pageCuadros.map((c) => (
              <CuadroView key={c.id} cuadro={c} images={images} />
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
  /** Empresa y rango (encabezados y nota de reporte vacío). */
  data: PhotographicReportData
  /** Qué foto va en cada recuadro: la automática o la editada. */
  layout: ReportLayout
  /** Fotos ya descargadas y reducidas (ver `prepareReportImages`). */
  images: ReportImages
}

export function PhotographicReportDocument({ data, layout, images }: Props) {
  const { company } = data
  const empty = layout.days.every((d) => d.cuadros.length === 0)
  return (
    <Document title={`${APP_NAME} — Registro Fotográfico — ${company.name}`}>
      {layout.days.map((day) => (
        <DayPages key={day.date} day={day} companyName={company.name} images={images} />
      ))}
      {empty && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <PageHeader />
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

Alto de cada fila: `photoCell` tiene `padding: 1` → 1 + 96 + 1 = 98 pt; dos filas = 196 pt, igual que hoy (columna de pesaje: 1 + 96 + 2 + 96 + 1). Siguen cabiendo 4 cuadros por hoja.

- [ ] **Step 6: `report-preview` usa la maqueta; borrar `reportPhotoUrls`**

En `hub/src/lib/data/reports.ts` borrar la función `reportPhotoUrls` y su comentario.

En `hub/src/components/reports/report-preview.tsx`:
- import: `import type { PhotographicReportData } from '@/lib/data/reports'` y `import { buildReportLayout, layoutPhotoUrls } from '@/lib/data/report-layout'`; agregar `useMemo` al import de react.
- después de `const [state, setState] = ...`: `const layout = useMemo(() => buildReportLayout(data), [data])`
- en `handleGenerate`: `const urls = layoutPhotoUrls(layout)` y `pdf(<PhotographicReportDocument data={data} layout={layout} images={images} />)`.

En `hub/src/__tests__/lib/reports.test.ts`:
- import: quitar `reportPhotoUrls`; agregar `import { buildReportLayout, layoutPhotoUrls } from '@/lib/data/report-layout'`.
- en `excluye anatomopatológicos y citotóxicos del registro`: `const urls = layoutPhotoUrls(buildReportLayout(buildPhotographicReportData('company-ion', store, range)!))`.
- en `junta las urls de recorrido y de los pares de pesaje, sin repetir`: `const urls = layoutPhotoUrls(buildReportLayout(data))` (el resto del test queda igual: compara contra todas las fotos de grupos y pares).

- [ ] **Step 7: Run tests and type-check**

Run: `npx jest src/__tests__/lib/report-layout.test.ts src/__tests__/lib/reports.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit -p . 2>&1 | grep error | grep -v "__tests__\|\.test\."`
Expected: sin salida.

- [ ] **Step 8: Commit**

```bash
git add hub/src/lib/data/report-layout.ts hub/src/lib/data/reports.ts hub/src/components/reports/photographic-report-document.tsx hub/src/components/reports/report-preview.tsx hub/src/__tests__/lib/report-layout.test.ts hub/src/__tests__/lib/reports.test.ts
git commit -m "refactor(reportes): el PDF del registro se dibuja desde una maqueta"
```

---

### Task 2: Acciones del editor sobre la maqueta

**Files:**
- Modify: `hub/src/lib/data/report-layout.ts` (agregar al final)
- Modify: `hub/src/__tests__/lib/report-layout.test.ts` (agregar al final)

**Interfaces:**
- Consumes: `ReportLayout`, `LayoutCuadro`, `emptySlots` (Task 1).
- Produces:
  - `interface SlotRef { cuadroId: string; slot: number }`
  - `type DragRef = { type: 'cuadro'; cuadroId: string; date: string } | ({ type: 'slot' } & SlotRef) | { type: 'browser'; photo: Photo }`
  - `photoAt(layout, ref: SlotRef): Photo | null`
  - `moveCuadro(layout, cuadroId: string, overCuadroId: string): ReportLayout`
  - `dropPhoto(layout, ref: SlotRef, photo: Photo): ReportLayout`
  - `swapSlots(layout, a: SlotRef, b: SlotRef): ReportLayout`
  - `clearSlot(layout, ref: SlotRef): ReportLayout`
  - `setComment(layout, cuadroId: string, comment: string): ReportLayout`
  - `addCuadro(layout, date: string): ReportLayout`
  - `removeCuadro(layout, cuadroId: string): ReportLayout`
  - `applyDragEnd(layout, active: DragRef, over: DragRef | null): ReportLayout`
  - Todas devuelven **la misma referencia** cuando no cambian nada (el editor lo usa para no marcar cambios).

- [ ] **Step 1: Write the failing test**

Agregar al import de `report-layout.test.ts`: `photoAt, moveCuadro, dropPhoto, swapSlots, clearSlot, setComment, addCuadro, removeCuadro, applyDragEnd`. Agregar al final:

```ts
describe('acciones del editor', () => {
  const base = (): ReportLayout => ({ days: [
    { date: 'd1', cuadros: [
      { id: 'a', label: 'A', comment: 'A', slots: [ph('1'), ph('2'), null, null, null, null, null, null] },
      { id: 'b', label: 'B', comment: 'B', slots: [ph('3'), null, null, null, null, null, null, null] },
      { id: 'c', label: 'C', comment: 'C', slots: Array(8).fill(null) },
    ] },
    { date: 'd2', cuadros: [{ id: 'z', label: 'Z', comment: 'Z', slots: Array(8).fill(null) }] },
  ] })
  const ids = (l: ReportLayout, day = 0) => l.days[day].cuadros.map((c) => c.id)

  it('moveCuadro reordena dentro del día', () => {
    expect(ids(moveCuadro(base(), 'a', 'c'))).toEqual(['b', 'c', 'a'])
    expect(ids(moveCuadro(base(), 'c', 'a'))).toEqual(['c', 'a', 'b'])
  })

  it('moveCuadro no cruza días', () => {
    const l = base()
    expect(moveCuadro(l, 'a', 'z')).toBe(l)
  })

  it('dropPhoto reemplaza lo que había', () => {
    const l = dropPhoto(base(), { cuadroId: 'a', slot: 0 }, ph('9'))
    expect(photoAt(l, { cuadroId: 'a', slot: 0 })?.id).toBe('9')
  })

  it('swapSlots intercambia entre cuadros y mueve si el destino está vacío', () => {
    const l = swapSlots(base(), { cuadroId: 'a', slot: 0 }, { cuadroId: 'b', slot: 0 })
    expect(photoAt(l, { cuadroId: 'a', slot: 0 })?.id).toBe('3')
    expect(photoAt(l, { cuadroId: 'b', slot: 0 })?.id).toBe('1')
    const m = swapSlots(base(), { cuadroId: 'a', slot: 1 }, { cuadroId: 'c', slot: 5 })
    expect(photoAt(m, { cuadroId: 'a', slot: 1 })).toBeNull()
    expect(photoAt(m, { cuadroId: 'c', slot: 5 })?.id).toBe('2')
  })

  it('clearSlot vacía; setComment edita', () => {
    expect(photoAt(clearSlot(base(), { cuadroId: 'a', slot: 0 }), { cuadroId: 'a', slot: 0 })).toBeNull()
    expect(setComment(base(), 'b', 'Hola').days[0].cuadros[1].comment).toBe('Hola')
  })

  it('addCuadro agrega uno vacío al final del día, con id nuevo', () => {
    const l = addCuadro(base(), 'd1')
    const added = l.days[0].cuadros[3]
    expect(added.label).toBe('Pesaje')
    expect(added.comment).toBe('Pesaje')
    expect(added.slots).toEqual(Array(8).fill(null))
    expect(['a', 'b', 'c', 'z']).not.toContain(added.id)
    expect(addCuadro(l, 'd1').days[0].cuadros[4].id).not.toBe(added.id)
  })

  it('removeCuadro elimina; el día puede quedar vacío', () => {
    expect(ids(removeCuadro(base(), 'b'))).toEqual(['a', 'c'])
    expect(removeCuadro(base(), 'z').days[1].cuadros).toEqual([])
  })

  describe('applyDragEnd', () => {
    it('cuadro sobre cuadro del mismo día: reordena', () => {
      const l = applyDragEnd(base(), { type: 'cuadro', cuadroId: 'a', date: 'd1' }, { type: 'cuadro', cuadroId: 'b', date: 'd1' })
      expect(ids(l)).toEqual(['b', 'a', 'c'])
    })
    it('cuadro sobre cuadro de otro día: no cambia nada', () => {
      const l = base()
      expect(applyDragEnd(l, { type: 'cuadro', cuadroId: 'a', date: 'd1' }, { type: 'cuadro', cuadroId: 'z', date: 'd2' })).toBe(l)
    })
    it('foto del buscador sobre un recuadro: la suelta ahí', () => {
      const l = applyDragEnd(base(), { type: 'browser', photo: ph('9') }, { type: 'slot', cuadroId: 'z', slot: 7 })
      expect(photoAt(l, { cuadroId: 'z', slot: 7 })?.id).toBe('9')
    })
    it('foto del canvas sobre otro recuadro: intercambia', () => {
      const l = applyDragEnd(base(), { type: 'slot', cuadroId: 'a', slot: 0 }, { type: 'slot', cuadroId: 'a', slot: 1 })
      expect(photoAt(l, { cuadroId: 'a', slot: 0 })?.id).toBe('2')
      expect(photoAt(l, { cuadroId: 'a', slot: 1 })?.id).toBe('1')
    })
    it('foto sobre su propio recuadro, o soltada fuera: no cambia nada', () => {
      const l = base()
      expect(applyDragEnd(l, { type: 'slot', cuadroId: 'a', slot: 0 }, { type: 'slot', cuadroId: 'a', slot: 0 })).toBe(l)
      expect(applyDragEnd(l, { type: 'browser', photo: ph('9') }, null)).toBe(l)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/report-layout.test.ts`
Expected: FAIL — `moveCuadro is not a function` (o error de import).

- [ ] **Step 3: Write minimal implementation**

Agregar al final de `hub/src/lib/data/report-layout.ts`:

```ts
// ── Acciones del editor ────────────────────────────────────────────────────
// Puras: devuelven una maqueta nueva, o la misma referencia si no cambia nada.

export interface SlotRef {
  cuadroId: string
  slot: number
}

/** Lo que se arrastra o sobre lo que se suelta (va en `data` de dnd-kit). */
export type DragRef =
  | { type: 'cuadro'; cuadroId: string; date: string }
  | ({ type: 'slot' } & SlotRef)
  | { type: 'browser'; photo: Photo }

function updateCuadro(layout: ReportLayout, cuadroId: string, fn: (c: LayoutCuadro) => LayoutCuadro): ReportLayout {
  return {
    days: layout.days.map((d) => ({
      ...d,
      cuadros: d.cuadros.map((c) => (c.id === cuadroId ? fn(c) : c)),
    })),
  }
}

export function photoAt(layout: ReportLayout, ref: SlotRef): Photo | null {
  for (const day of layout.days) {
    const cuadro = day.cuadros.find((c) => c.id === ref.cuadroId)
    if (cuadro) return cuadro.slots[ref.slot] ?? null
  }
  return null
}

function setSlot(layout: ReportLayout, ref: SlotRef, photo: Photo | null): ReportLayout {
  return updateCuadro(layout, ref.cuadroId, (c) => ({
    ...c,
    slots: c.slots.map((p, i) => (i === ref.slot ? photo : p)),
  }))
}

/** Lleva el cuadro a la posición de `overCuadroId`. Solo dentro del mismo día. */
export function moveCuadro(layout: ReportLayout, cuadroId: string, overCuadroId: string): ReportLayout {
  if (cuadroId === overCuadroId) return layout
  const day = layout.days.find((d) => d.cuadros.some((c) => c.id === cuadroId))
  if (!day) return layout
  const from = day.cuadros.findIndex((c) => c.id === cuadroId)
  const to = day.cuadros.findIndex((c) => c.id === overCuadroId)
  if (to === -1) return layout
  const cuadros = [...day.cuadros]
  const [moved] = cuadros.splice(from, 1)
  cuadros.splice(to, 0, moved)
  return { days: layout.days.map((d) => (d === day ? { ...d, cuadros } : d)) }
}

export function dropPhoto(layout: ReportLayout, ref: SlotRef, photo: Photo): ReportLayout {
  return setSlot(layout, ref, photo)
}

/** Intercambia dos recuadros; si el destino está vacío, equivale a mover. */
export function swapSlots(layout: ReportLayout, a: SlotRef, b: SlotRef): ReportLayout {
  if (a.cuadroId === b.cuadroId && a.slot === b.slot) return layout
  const pa = photoAt(layout, a)
  const pb = photoAt(layout, b)
  return setSlot(setSlot(layout, a, pb), b, pa)
}

export function clearSlot(layout: ReportLayout, ref: SlotRef): ReportLayout {
  return setSlot(layout, ref, null)
}

export function setComment(layout: ReportLayout, cuadroId: string, comment: string): ReportLayout {
  return updateCuadro(layout, cuadroId, (c) => ({ ...c, comment }))
}

let newCuadroSeq = 0

/** Cuadro vacío al final del día. */
export function addCuadro(layout: ReportLayout, date: string): ReportLayout {
  newCuadroSeq += 1
  const cuadro: LayoutCuadro = { id: `nuevo-${newCuadroSeq}`, label: 'Pesaje', comment: 'Pesaje', slots: emptySlots() }
  return { days: layout.days.map((d) => (d.date === date ? { ...d, cuadros: [...d.cuadros, cuadro] } : d)) }
}

export function removeCuadro(layout: ReportLayout, cuadroId: string): ReportLayout {
  return { days: layout.days.map((d) => ({ ...d, cuadros: d.cuadros.filter((c) => c.id !== cuadroId) })) }
}

/** Traduce el fin de un arrastre a una acción. Combinaciones sin sentido no cambian nada. */
export function applyDragEnd(layout: ReportLayout, active: DragRef, over: DragRef | null): ReportLayout {
  if (!over) return layout
  if (active.type === 'cuadro') {
    return over.type === 'cuadro' ? moveCuadro(layout, active.cuadroId, over.cuadroId) : layout
  }
  if (over.type !== 'slot') return layout
  if (active.type === 'browser') return dropPhoto(layout, over, active.photo)
  return swapSlots(layout, active, over)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/report-layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hub/src/lib/data/report-layout.ts hub/src/__tests__/lib/report-layout.test.ts
git commit -m "feat(reportes): acciones puras del editor del registro fotográfico"
```

---

### Task 3: Árbol del buscador de fotos

**Files:**
- Modify: `hub/src/lib/data/reports.ts`
- Create: `hub/src/lib/data/photo-browser-tree.ts`
- Create: `hub/src/__tests__/lib/photo-browser-tree.test.ts`

**Interfaces:**
- Consumes: `isoDate`, `withinRange` de `reports.ts`; `WASTE_TYPE_LABELS` de `@hospiwaste/shared/lib/data/dashboard-analytics`.
- Produces:
  - `selectReportReceptions(companyId: string, receptions: ContainerReception[], start: Date, end: Date): ContainerReception[]` (en `reports.ts`)
  - `interface BrowserItem { key: string; label: string; scale: Photo | null; tacho: Photo | null }`
  - `interface BrowserSession { key: string; label: string; items: BrowserItem[] }`
  - `interface BrowserDay { date: string; sessions: BrowserSession[] }`
  - `buildPhotoBrowserTree(receptions: ContainerReception[], sessions: WeighingSession[], photos: Photo[]): BrowserDay[]`

- [ ] **Step 1: Extraer el filtro de recepciones**

En `hub/src/lib/data/reports.ts`, agregar después de `withinRange`:

```ts
/**
 * Recepciones que entran al registro: no anuladas, de la empresa, dentro del
 * rango y sin anatomopatológicos ni citotóxicos. La empresa es propiedad del
 * registro (snapshot al pesar); un pesaje sin empresa no pertenece a ningún reporte.
 */
export function selectReportReceptions(
  companyId: string,
  receptions: ContainerReception[],
  start: Date,
  end: Date,
): ContainerReception[] {
  return receptions.filter(
    (r) =>
      !r.voided_at &&
      !EXCLUDED_WASTE_TYPES.includes(r.waste_type as WasteType) &&
      withinRange(r.arrived_at, start, end) &&
      r.company_id === companyId,
  )
}
```

En `buildPhotographicReportData`: borrar `recBelongs` (y ajustar su comentario para que hable solo de `routeBelongs`) y reemplazar el bloque `const receptions = store.receptions.filter(...)` por:

```ts
  const receptions = selectReportReceptions(companyId, store.receptions, start, end)
```

Run: `npx jest src/__tests__/lib/reports.test.ts`
Expected: PASS (sin cambios de comportamiento).

- [ ] **Step 2: Write the failing test**

Crear `hub/src/__tests__/lib/photo-browser-tree.test.ts`:

```ts
import type { ContainerReception, Photo, WeighingSession } from '@hospiwaste/shared/lib/types'
import { buildPhotoBrowserTree } from '@/lib/data/photo-browser-tree'

const ph = (id: string): Photo => ({ id, url: `u-${id}`, event_type: 'weighing', event_id: 'e', taken_at: '', label: '' })

const rec = (p: Partial<ContainerReception> & { id: string; arrived_at: string }): ContainerReception => ({
  container_id: null,
  weighing_session_id: null,
  gross_weight_kg: 10,
  operator_id: 'user-1',
  photo_ids: [`${p.id}-t`, `${p.id}-s`],
  observations: '',
  company_id: 'company-ion',
  ...p,
})

const session = (id: string, started_at: string) =>
  ({ id, client_id: 'client-1', date: started_at.slice(0, 10), started_at, ended_at: null, operator_id: 'user-1', status: 'completed', reception_ids: [] }) as unknown as WeighingSession

const photosFor = (...ids: string[]) => ids.flatMap((id) => [ph(`${id}-t`), ph(`${id}-s`)])

describe('buildPhotoBrowserTree', () => {
  const sessions = [session('s-tarde', '2026-05-17T15:00:00-05:00'), session('s-manana', '2026-05-17T09:00:00-05:00')]
  const receptions = [
    rec({ id: 'r1', arrived_at: '2026-05-17T15:10:00-05:00', container_id: '173', weighing_session_id: 's-tarde' }),
    rec({ id: 'r2', arrived_at: '2026-05-17T09:05:00-05:00', container_id: '052', weighing_session_id: 's-manana' }),
    rec({ id: 'r3', arrived_at: '2026-05-17T10:00:00-05:00', container_ref: '5501', waste_type: 'morgue' }),
    rec({ id: 'r4', arrived_at: '2026-05-18T09:00:00-05:00', container_id: '001', weighing_session_id: 'no-existe' }),
  ]
  const tree = buildPhotoBrowserTree(receptions, sessions, photosFor('r1', 'r2', 'r3', 'r4'))

  it('agrupa por día, en orden', () => {
    expect(tree.map((d) => d.date)).toEqual(['2026-05-17', '2026-05-18'])
  })

  it('sesiones por hora de inicio, numeradas; "Sin sesión" al final', () => {
    const labels = tree[0].sessions.map((s) => s.label)
    expect(labels[0]).toMatch(/^Sesión 1 · /)
    expect(labels[1]).toMatch(/^Sesión 2 · /)
    expect(labels[2]).toBe('Sin sesión')
    expect(tree[0].sessions[0].items.map((i) => i.label)).toEqual(['Tacho 052'])
    expect(tree[0].sessions[1].items.map((i) => i.label)).toEqual(['Tacho 173'])
  })

  it('contenedor descartable con su número y tipo', () => {
    expect(tree[0].sessions[2].items[0].label).toBe('Contenedor 5501 (Morgue)')
  })

  it('una sesión que no está en el store cae en "Sin sesión"', () => {
    expect(tree[1].sessions.map((s) => s.label)).toEqual(['Sin sesión'])
  })

  it('balanza = photo_ids[1], tacho = photo_ids[0]', () => {
    const item = tree[0].sessions[0].items[0]
    expect(item.tacho?.id).toBe('r2-t')
    expect(item.scale?.id).toBe('r2-s')
  })

  it('omite pesajes sin ninguna foto encontrada; conserva los que tienen una sola', () => {
    const t = buildPhotoBrowserTree(
      [rec({ id: 'x', arrived_at: '2026-05-17T09:00:00-05:00', container_id: '9' }), rec({ id: 'y', arrived_at: '2026-05-17T09:30:00-05:00', container_id: '8' })],
      [],
      [ph('y-t')],
    )
    const items = t[0].sessions[0].items
    expect(items.map((i) => i.label)).toEqual(['Tacho 8'])
    expect(items[0].scale).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/photo-browser-tree.test.ts`
Expected: FAIL — `Cannot find module '@/lib/data/photo-browser-tree'`.

- [ ] **Step 4: Write minimal implementation**

Crear `hub/src/lib/data/photo-browser-tree.ts`:

```ts
import type { ContainerReception, Photo, WeighingSession } from '@hospiwaste/shared/lib/types'
import { WASTE_TYPE_LABELS } from '@hospiwaste/shared/lib/data/dashboard-analytics'
import { isoDate } from './reports'

/**
 * Árbol del buscador del editor del registro: día → sesión de pesaje →
 * tacho o contenedor descartable → foto de balanza y foto del tacho.
 * Recibe las recepciones ya filtradas (`selectReportReceptions`).
 */

export interface BrowserItem {
  key: string
  label: string
  scale: Photo | null // photo_ids[1]
  tacho: Photo | null // photo_ids[0]
}

export interface BrowserSession {
  key: string
  label: string
  items: BrowserItem[]
}

export interface BrowserDay {
  date: string
  sessions: BrowserSession[]
}

const NO_SESSION = ''

const time = (iso: string) => new Date(iso).getTime()

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
}

function itemLabel(rec: ContainerReception): string {
  if (rec.container_id) return `Tacho ${rec.container_id}`
  const tipo = rec.waste_type ? ` (${WASTE_TYPE_LABELS[rec.waste_type]})` : ''
  return `Contenedor ${rec.container_ref || 's/n'}${tipo}`
}

export function buildPhotoBrowserTree(
  receptions: ContainerReception[],
  sessions: WeighingSession[],
  photos: Photo[],
): BrowserDay[] {
  const photoMap = new Map(photos.map((p) => [p.id, p]))
  const sessionMap = new Map(sessions.map((s) => [s.id, s]))
  const photo = (id: string | undefined) => (id ? photoMap.get(id) ?? null : null)

  // date → sessionKey → items (en orden de pesaje)
  const byDay = new Map<string, Map<string, BrowserItem[]>>()
  const sorted = [...receptions].sort((a, b) => time(a.arrived_at) - time(b.arrived_at))
  for (const rec of sorted) {
    const item: BrowserItem = { key: rec.id, label: itemLabel(rec), tacho: photo(rec.photo_ids[0]), scale: photo(rec.photo_ids[1]) }
    if (!item.tacho && !item.scale) continue
    const date = isoDate(new Date(rec.arrived_at))
    const sessionKey = rec.weighing_session_id && sessionMap.has(rec.weighing_session_id) ? rec.weighing_session_id : NO_SESSION
    const day = byDay.get(date) ?? new Map<string, BrowserItem[]>()
    byDay.set(date, day)
    day.set(sessionKey, [...(day.get(sessionKey) ?? []), item])
  }

  return [...byDay.keys()].sort().map((date) => {
    const day = byDay.get(date)!
    const sessionIds = [...day.keys()]
      .filter((k) => k !== NO_SESSION)
      .sort((a, b) => time(sessionMap.get(a)!.started_at) - time(sessionMap.get(b)!.started_at))
    const out: BrowserSession[] = sessionIds.map((id, i) => ({
      key: `${date}:${id}`,
      label: `Sesión ${i + 1} · ${formatTime(sessionMap.get(id)!.started_at)}`,
      items: day.get(id)!,
    }))
    const loose = day.get(NO_SESSION)
    if (loose) out.push({ key: `${date}:sin-sesion`, label: 'Sin sesión', items: loose })
    return { date, sessions: out }
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/photo-browser-tree.test.ts src/__tests__/lib/reports.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add hub/src/lib/data/reports.ts hub/src/lib/data/photo-browser-tree.ts hub/src/__tests__/lib/photo-browser-tree.test.ts
git commit -m "feat(reportes): árbol de fotos de pesaje para el editor del registro"
```

---

### Task 4: Descarga compartida, rango por query string y botón "Editar reporte"

**Files:**
- Modify: `hub/src/lib/data/reports.ts`
- Modify: `hub/src/__tests__/lib/reports.test.ts`
- Create: `hub/src/components/reports/report-download.tsx`
- Modify: `hub/src/components/reports/report-preview.tsx`
- Modify: `hub/src/app/reports/page.tsx`

**Interfaces:**
- Consumes: `ReportRange`, `PhotographicReportData`, `layoutPhotoUrls`, `ReportLayout`, `PhotographicReportDocument`, `prepareReportImages`.
- Produces:
  - `parseReportRange(start: string | null, end: string | null): ReportRange | null`
  - `reportFilename(data: PhotographicReportData, suffix?: string): string`
  - `type GenerationState` (movido desde report-preview)
  - `useReportDownload(): { state: GenerationState; busy: boolean; download(data, layout, filename): Promise<boolean> }`
  - `DownloadButtonLabel({ state, idleLabel })`, `DownloadMessages({ state })`
  - URL del editor: `/reports/editor?company=<id>&start=<YYYY-MM-DD>&end=<YYYY-MM-DD>`

- [ ] **Step 1: Write the failing test**

En `reports.test.ts` agregar `parseReportRange, reportFilename` al import de `@/lib/data/reports` y al final del archivo:

```ts
describe('parseReportRange', () => {
  it('YYYY-MM-DD → [00:00, 23:59:59] local', () => {
    const r = parseReportRange('2026-09-28', '2026-10-02')!
    expect(r.start).toEqual(new Date(2026, 8, 28, 0, 0, 0))
    expect(r.end).toEqual(new Date(2026, 9, 2, 23, 59, 59))
  })
  it('null si falta, está mal escrito o Desde > Hasta', () => {
    expect(parseReportRange(null, '2026-10-02')).toBeNull()
    expect(parseReportRange('2026-10-02', '')).toBeNull()
    expect(parseReportRange('28/09/2026', '2026-10-02')).toBeNull()
    expect(parseReportRange('2026-13-40', '2026-10-02')).toBeNull()
    expect(parseReportRange('2026-10-03', '2026-10-02')).toBeNull()
  })
})

describe('reportFilename', () => {
  const data = { company: { name: 'ION Airkem' }, rangeStart: '2026-09-28', rangeEnd: '2026-10-02' } as Parameters<typeof reportFilename>[0]
  it('nombre del automático y del editado', () => {
    expect(reportFilename(data)).toMatch(/_RegistroFotografico_ION_Airkem_2026-09-28_2026-10-02\.pdf$/)
    expect(reportFilename(data, '_editado')).toMatch(/_2026-10-02_editado\.pdf$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/reports.test.ts`
Expected: FAIL — `parseReportRange is not a function`.

- [ ] **Step 3: Write minimal implementation**

En `hub/src/lib/data/reports.ts` agregar `import { APP_NAME, getRouteSlotDefinition } from '@hospiwaste/shared/lib/constants'` (reemplaza el import actual de `getRouteSlotDefinition`) y, después de `withinRange`:

```ts
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Fechas `YYYY-MM-DD` (inputs de fecha o query string) → rango local
 * [00:00, 23:59:59]. null si falta alguna, está mal escrita o Desde > Hasta.
 */
export function parseReportRange(start: string | null, end: string | null): ReportRange | null {
  if (!start || !end || !ISO_DAY.test(start) || !ISO_DAY.test(end) || start > end) return null
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T23:59:59`)
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || isoDate(s) !== start || isoDate(e) !== end) return null
  return { start: s, end: e }
}

/** Nombre del PDF del registro; el editor agrega `_editado`. */
export function reportFilename(data: PhotographicReportData, suffix = ''): string {
  const safeName = data.company.name.replace(/[^a-z0-9]/gi, '_')
  return `${APP_NAME}_RegistroFotografico_${safeName}_${data.rangeStart}_${data.rangeEnd}${suffix}.pdf`
}
```

(`isoDate(s) !== start` descarta fechas que `Date` corrige solo, como `2026-02-31`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/reports.test.ts`
Expected: PASS.

- [ ] **Step 5: Hook de descarga compartido**

Crear `hub/src/components/reports/report-download.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import type { PhotographicReportData } from '@/lib/data/reports'
import { layoutPhotoUrls, type ReportLayout } from '@/lib/data/report-layout'
import { prepareReportImages } from '@/lib/report-images'
import { PhotographicReportDocument } from './photographic-report-document'

export type GenerationState =
  | { phase: 'idle' }
  | { phase: 'photos'; done: number; total: number }
  | { phase: 'pdf' }
  | { phase: 'done'; missing: number }
  | { phase: 'error'; message: string }

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Genera y descarga el PDF de una maqueta. Lo usan `/reports` y el editor. */
export function useReportDownload() {
  const [state, setState] = useState<GenerationState>({ phase: 'idle' })
  const busy = state.phase === 'photos' || state.phase === 'pdf'

  // El PDF se arma recién al hacer clic: primero se descargan y reducen las
  // fotos (con reintentos), después se genera el archivo. Antes @react-pdf
  // bajaba todas las fotos a tamaño original apenas se abría la vista previa.
  async function download(data: PhotographicReportData, layout: ReportLayout, filename: string): Promise<boolean> {
    try {
      const urls = layoutPhotoUrls(layout)
      setState({ phase: 'photos', done: 0, total: urls.length })
      const images = await prepareReportImages(urls, {
        onProgress: (done, total) => setState({ phase: 'photos', done, total }),
      })
      setState({ phase: 'pdf' })
      const { pdf } = await import('@react-pdf/renderer')
      const blob = await pdf(<PhotographicReportDocument data={data} layout={layout} images={images} />).toBlob()
      triggerDownload(blob, filename)
      const missing = [...images.values()].filter((v) => v === null).length
      setState({ phase: 'done', missing })
      return true
    } catch (err) {
      console.error('[reports] generar PDF falló:', err)
      setState({ phase: 'error', message: 'No se pudo generar el PDF. Intenta de nuevo.' })
      return false
    }
  }

  return { state, busy, download }
}

export function DownloadButtonLabel({ state, idleLabel }: { state: GenerationState; idleLabel: string }) {
  if (state.phase === 'photos') {
    return (
      <>
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparando fotos {state.done} de {state.total}…
      </>
    )
  }
  if (state.phase === 'pdf') {
    return (
      <>
        <Loader2 className="h-4 w-4 animate-spin" />
        Generando PDF…
      </>
    )
  }
  return (
    <>
      <Download className="h-4 w-4" />
      {idleLabel}
    </>
  )
}

export function DownloadMessages({ state }: { state: GenerationState }) {
  if (state.phase === 'done' && state.missing > 0) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        {state.missing} foto{state.missing !== 1 ? 's' : ''} no se pudo descargar y sale como
        “Foto no disponible” en el PDF. Vuelve a generarlo para reintentar.
      </p>
    )
  }
  if (state.phase === 'error') {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.message}</p>
    )
  }
  return null
}
```

- [ ] **Step 6: `report-preview` usa el hook y suma "Editar reporte"**

En `hub/src/components/reports/report-preview.tsx`:

1. Imports: quitar `useState`, `Download`, `Loader2`, `APP_NAME`, `prepareReportImages`, `PhotographicReportDocument`, `layoutPhotoUrls`. Dejar/agregar:

```tsx
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, PencilRuler, Route, Scale } from 'lucide-react'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { Card, CardContent } from '@hospiwaste/shared/components/ui/card'
import { reportFilename, type PhotographicReportData } from '@/lib/data/reports'
import { buildReportLayout } from '@/lib/data/report-layout'
import { DownloadButtonLabel, DownloadMessages, useReportDownload } from './report-download'
```

2. Borrar `GenerationState`, `triggerDownload` y `handleGenerate`. El cuerpo de `ReportPreview` antes del `return` queda:

```tsx
  const { company, client, rangeStart, rangeEnd, meta } = data
  const router = useRouter()
  const layout = useMemo(() => buildReportLayout(data), [data])
  const { state, busy, download } = useReportDownload()
  const filename = reportFilename(data)
  const editorHref = `/reports/editor?company=${encodeURIComponent(company.id)}&start=${rangeStart}&end=${rangeEnd}`
```

3. Reemplazar el bloque `<div className="pt-2 border-t">…</div>` por:

```tsx
        <div className="pt-2 border-t space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => download(data, layout, filename)} disabled={busy} className="gap-2 w-full sm:w-auto" size="lg">
              <DownloadButtonLabel state={state} idleLabel="Descargar reporte PDF" />
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(editorHref)}
              disabled={busy || meta.totalPhotos === 0}
              className="gap-2 w-full sm:w-auto"
              size="lg"
            >
              <PencilRuler className="h-4 w-4" />
              Editar reporte
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            El archivo se guardará como <code className="font-mono">{filename}</code>
          </p>
          <DownloadMessages state={state} />
        </div>
```

En `hub/src/app/reports/page.tsx`: importar `parseReportRange` desde `@/lib/data/reports` y dentro del `useMemo` de `reportData` reemplazar el armado manual de `start`/`end` por:

```tsx
    const range = parseReportRange(startStr, endStr)
    if (!companyId || !range) return null
    return buildPhotographicReportData(
      companyId,
      { clients, companies, containers, routeEvents, weighingSessions, receptions, photos },
      range,
    )
```

(borrar la línea `if (!companyId || invalidRange) return null` y el comentario `// input date …`; `invalidRange` se sigue usando para el mensaje de error).

- [ ] **Step 7: Verify**

Run: `npx jest src/__tests__/lib`
Expected: PASS.
Run: `npx tsc --noEmit -p . 2>&1 | grep error | grep -v "__tests__\|\.test\."`
Expected: sin salida. (La ruta `/reports/editor` todavía no existe: el botón navega a una 404 hasta Task 5. No hacer deploy entre Task 4 y 5.)

- [ ] **Step 8: Commit**

```bash
git add hub/src/lib/data/reports.ts hub/src/__tests__/lib/reports.test.ts hub/src/components/reports/report-download.tsx hub/src/components/reports/report-preview.tsx hub/src/app/reports/page.tsx
git commit -m "feat(reportes): descarga compartida y botón Editar reporte"
```

---

### Task 5: Pantalla del editor

**Files:**
- Modify: `hub/package.json` (dependencias nuevas)
- Create: `hub/src/app/reports/editor/page.tsx`
- Create: `hub/src/components/reports/editor/report-editor.tsx`
- Create: `hub/src/components/reports/editor/photo-browser.tsx`
- Create: `hub/src/components/reports/editor/report-canvas.tsx`

**Interfaces:**
- Consumes: todo lo de Tasks 1-4 (`buildReportLayout`, `paginateDay`, `usedPhotoIds`, `photoAt`, acciones, `applyDragEnd`, `DragRef`, `buildPhotoBrowserTree`, `selectReportReceptions`, `parseReportRange`, `reportFilename`, `useReportDownload`, `DownloadButtonLabel`, `DownloadMessages`).
- Produces: ruta `/reports/editor`.

Convención de ids de dnd-kit: cuadro = `cuadro.id` (sortable); recuadro = `slot:<cuadroId>:<i>` (draggable y droppable con el mismo id); miniatura = `browser:<photoId>`. El `data` de cada uno es su `DragRef`.

- [ ] **Step 1: Instalar dnd-kit**

Run (desde la raíz del repo): `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities -w hub`
Expected: las tres aparecen en `dependencies` de `hub/package.json`.

- [ ] **Step 2: Ruta**

Crear `hub/src/app/reports/editor/page.tsx`:

```tsx
'use client'

import { Suspense } from 'react'
import { ReportEditor } from '@/components/reports/editor/report-editor'

// useSearchParams necesita un Suspense en export estático.
export default function ReportEditorPage() {
  return (
    <Suspense fallback={null}>
      <ReportEditor />
    </Suspense>
  )
}
```

- [ ] **Step 3: Buscador**

Crear `hub/src/components/reports/editor/photo-browser.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Check, ChevronDown, ChevronRight, ImageOff } from 'lucide-react'
import type { Photo } from '@hospiwaste/shared/lib/types'
import { cn } from '@hospiwaste/shared/lib/utils'
import type { BrowserDay } from '@/lib/data/photo-browser-tree'
import type { DragRef } from '@/lib/data/report-layout'

interface Props {
  tree: BrowserDay[]
  /** Ids de fotos que ya están en algún recuadro del canvas. */
  used: Set<string>
}

/** Panel izquierdo: carpetas día → sesión → tacho, con miniaturas arrastrables. */
export function PhotoBrowser({ tree, used }: Props) {
  // Todo cerrado al inicio: las miniaturas se piden recién al abrir la carpeta.
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  if (tree.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay pesajes con fotos en este rango.</p>
  }

  return (
    <div className="space-y-0.5 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fotos de pesaje</p>
      {tree.map((day) => (
        <Folder key={day.date} label={day.date} open={open.has(day.date)} onToggle={() => toggle(day.date)}>
          {day.sessions.map((s) => (
            <Folder key={s.key} label={s.label} open={open.has(s.key)} onToggle={() => toggle(s.key)}>
              {s.items.map((item) => (
                <Folder key={item.key} label={item.label} open={open.has(item.key)} onToggle={() => toggle(item.key)}>
                  <div className="flex gap-2 py-1">
                    <Thumb photo={item.scale} caption="Balanza" used={used} />
                    <Thumb photo={item.tacho} caption="Tacho" used={used} />
                  </div>
                </Folder>
              ))}
            </Folder>
          ))}
        </Folder>
      ))}
    </div>
  )
}

function Folder({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <div>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-muted">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </button>
      {open && <div className="ml-2 border-l pl-2">{children}</div>}
    </div>
  )
}

function Thumb({ photo, caption, used }: { photo: Photo | null; caption: string; used: Set<string> }) {
  if (!photo) {
    return (
      <div className="w-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">Sin foto</div>
        <p className="mt-0.5 text-[11px] font-medium">{caption}</p>
      </div>
    )
  }
  return <DraggableThumb photo={photo} caption={caption} inUse={used.has(photo.id)} />
}

function DraggableThumb({ photo, caption, inUse }: { photo: Photo; caption: string; inUse: boolean }) {
  const data: DragRef = { type: 'browser', photo }
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `browser:${photo.id}`, data })
  const [broken, setBroken] = useState(false)
  return (
    <div className="w-16 text-center">
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={cn(
          'flex h-16 w-16 cursor-grab touch-none items-center justify-center overflow-hidden rounded bg-muted ring-1 ring-border',
          isDragging && 'opacity-40',
        )}
      >
        {broken ? (
          <ImageOff className="h-5 w-5 text-muted-foreground" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={caption} loading="lazy" draggable={false} onError={() => setBroken(true)} className="h-full w-full object-contain" />
        )}
      </div>
      <p className="mt-0.5 text-[11px] font-medium">{caption}</p>
      {inUse && (
        <p className="flex items-center justify-center gap-0.5 text-[10px] text-emerald-700">
          <Check className="h-3 w-3" />
          en uso
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Canvas**

Crear `hub/src/components/reports/editor/report-canvas.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2, X } from 'lucide-react'
import type { Photo } from '@hospiwaste/shared/lib/types'
import { cn } from '@hospiwaste/shared/lib/utils'
import {
  addCuadro, clearSlot, paginateDay, removeCuadro, setComment,
  type DragRef, type LayoutCuadro, type ReportLayout,
} from '@/lib/data/report-layout'

interface Props {
  layout: ReportLayout
  companyName: string
  onChange: (next: ReportLayout) => void
}

/** Hojas A4 imitadas en HTML: es la vista editable, no el PDF. */
export function ReportCanvas({ layout, companyName, onChange }: Props) {
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {layout.days.map((day) => (
        <section key={day.date} className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">{day.date}</h2>
          {/* Un contexto por día: los cuadros se reordenan solo dentro de su día. */}
          <SortableContext items={day.cuadros.map((c) => c.id)} strategy={rectSortingStrategy}>
            {paginateDay(day).map((page, i) => (
              <Sheet key={i} companyName={companyName} date={day.date}>
                {page.map((c) => (
                  <EditableCuadro key={c.id} cuadro={c} date={day.date} layout={layout} onChange={onChange} />
                ))}
              </Sheet>
            ))}
          </SortableContext>
          <button
            type="button"
            onClick={() => onChange(addCuadro(layout, day.date))}
            className="mx-auto flex items-center gap-1.5 rounded-lg border border-dashed border-slate-400 px-4 py-2 text-sm text-slate-600 hover:border-slate-600 hover:text-slate-900"
          >
            <Plus className="h-4 w-4" />
            Agregar cuadro a este día
          </button>
        </section>
      ))}
    </div>
  )
}

function Sheet({ companyName, date, children }: { companyName: string; date: string; children: React.ReactNode }) {
  const meta: [string, string][] = [['Edificio', '4E'], ['Ubicación', 'PTDP'], ['Empresa', companyName], ['Fecha', date]]
  return (
    <div className="rounded-sm bg-white p-5 shadow-md ring-1 ring-black/5">
      <div className="mb-2 flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-riga.png" alt="RIGA" className="h-8 w-24 object-contain object-left" />
        <p className="flex-1 text-center text-sm font-bold tracking-widest text-slate-900">REGISTRO FOTOGRÁFICO</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-cpch.jpg" alt="CPCH" className="h-9 w-24 object-contain object-right" />
      </div>
      <div className="mb-3 flex border border-slate-400 text-[11px]">
        {meta.map(([k, v]) => (
          <div key={k} className="flex border-r border-slate-400 last:border-r-0">
            <span className="bg-slate-200 px-2 py-1 font-semibold text-slate-700">{k}</span>
            <span className="min-w-16 px-2 py-1 text-slate-900">{v}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function EditableCuadro({ cuadro, date, layout, onChange }: { cuadro: LayoutCuadro; date: string; layout: ReportLayout; onChange: (next: ReportLayout) => void }) {
  const data: DragRef = { type: 'cuadro', cuadroId: cuadro.id, date }
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: cuadro.id, data })
  const [confirming, setConfirming] = useState(false)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('rounded-sm border border-slate-400 bg-white', isDragging && 'relative z-10 opacity-80 shadow-xl')}
    >
      <div className="flex items-center gap-1 border-b border-slate-400 bg-slate-100 px-1 py-0.5">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          type="button"
          aria-label="Mover cuadro"
          className="cursor-grab touch-none text-slate-500 hover:text-slate-900 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="flex-1 truncate text-center text-[11px] font-semibold text-slate-700">{cuadro.label}</span>
        {confirming ? (
          <span className="flex items-center gap-1.5 text-[11px]">
            ¿Eliminar?
            <button type="button" className="font-semibold text-red-700" onClick={() => onChange(removeCuadro(layout, cuadro.id))}>Sí</button>
            <button type="button" className="text-slate-600" onClick={() => setConfirming(false)}>No</button>
          </span>
        ) : (
          <button type="button" aria-label="Eliminar cuadro" onClick={() => setConfirming(true)} className="text-slate-400 hover:text-red-700">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-0.5 p-0.5">
        {cuadro.slots.map((photo, i) => (
          <SlotBox
            key={i}
            cuadroId={cuadro.id}
            slot={i}
            photo={photo}
            onClear={() => onChange(clearSlot(layout, { cuadroId: cuadro.id, slot: i }))}
          />
        ))}
      </div>
      <label className="flex items-center gap-1 border-t border-slate-400 px-1.5 py-1 text-[11px]">
        <span className="font-semibold text-slate-700">Comentario:</span>
        <input
          value={cuadro.comment}
          onChange={(e) => onChange(setComment(layout, cuadro.id, e.target.value))}
          className="flex-1 rounded bg-transparent px-0.5 text-slate-900 outline-none hover:bg-slate-50 focus:bg-amber-50"
        />
      </label>
    </div>
  )
}

function SlotBox({ cuadroId, slot, photo, onClear }: { cuadroId: string; slot: number; photo: Photo | null; onClear: () => void }) {
  const id = `slot:${cuadroId}:${slot}`
  const data: DragRef = { type: 'slot', cuadroId, slot }
  const drop = useDroppable({ id, data })
  const drag = useDraggable({ id, data, disabled: !photo })

  return (
    <div
      ref={drop.setNodeRef}
      className={cn('group relative aspect-[95/96] bg-slate-50', drop.isOver && 'ring-2 ring-inset ring-sky-500')}
    >
      {photo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={drag.setNodeRef}
            {...drag.attributes}
            {...drag.listeners}
            src={photo.url}
            alt=""
            loading="lazy"
            draggable={false}
            className={cn('h-full w-full cursor-grab touch-none object-contain', drag.isDragging && 'opacity-30')}
          />
          <button
            type="button"
            aria-label="Vaciar recuadro"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClear}
            className="absolute right-0.5 top-0.5 hidden rounded bg-black/60 p-0.5 text-white group-hover:block"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Editor (estado, arrastre, descarga)**

Crear `hub/src/components/reports/editor/report-editor.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import {
  DndContext, DragOverlay, PointerSensor, closestCenter, pointerWithin, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { useStore } from '@hospiwaste/shared/lib/store'
import {
  buildPhotographicReportData, parseReportRange, reportFilename, selectReportReceptions,
} from '@/lib/data/reports'
import {
  applyDragEnd, buildReportLayout, photoAt, usedPhotoIds, type DragRef, type ReportLayout,
} from '@/lib/data/report-layout'
import { buildPhotoBrowserTree } from '@/lib/data/photo-browser-tree'
import { DownloadButtonLabel, DownloadMessages, useReportDownload } from '../report-download'
import { PhotoBrowser } from './photo-browser'
import { ReportCanvas } from './report-canvas'

/**
 * Destinos válidos según lo que se arrastra: un cuadro cae sobre cuadros de su
 * mismo día (por cercanía); una foto, sobre el recuadro que está bajo el puntero.
 */
const collisionDetection: CollisionDetection = (args) => {
  const active = args.active.data.current as DragRef | undefined
  const refOf = (c: (typeof args.droppableContainers)[number]) => c.data.current as DragRef | undefined
  if (active?.type === 'cuadro') {
    const droppableContainers = args.droppableContainers.filter((c) => {
      const ref = refOf(c)
      return ref?.type === 'cuadro' && ref.date === active.date
    })
    return closestCenter({ ...args, droppableContainers })
  }
  const droppableContainers = args.droppableContainers.filter((c) => refOf(c)?.type === 'slot')
  return pointerWithin({ ...args, droppableContainers })
}

export function ReportEditor() {
  const params = useSearchParams()
  const companyId = params.get('company') ?? ''
  const range = useMemo(() => parseReportRange(params.get('start'), params.get('end')), [params])
  const { clients, companies, containers, routeEvents, weighingSessions, receptions, photos } = useStore()

  const data = useMemo(
    () =>
      range
        ? buildPhotographicReportData(companyId, { clients, companies, containers, routeEvents, weighingSessions, receptions, photos }, range)
        : null,
    [companyId, range, clients, companies, containers, routeEvents, weighingSessions, receptions, photos],
  )
  const tree = useMemo(
    () => (range ? buildPhotoBrowserTree(selectReportReceptions(companyId, receptions, range.start, range.end), weighingSessions, photos) : []),
    [companyId, range, receptions, weighingSessions, photos],
  )

  // Mientras no se edita, la maqueta sigue al store (que puede estar terminando
  // de cargar). La primera edición la congela: una actualización del store ya
  // no pisa lo editado.
  const baseLayout = useMemo(() => (data ? buildReportLayout(data) : null), [data])
  const [edited, setEdited] = useState<ReportLayout | null>(null)
  const layout = edited ?? baseLayout
  const used = useMemo(() => (layout ? usedPhotoIds(layout) : new Set<string>()), [layout])

  const [dirty, setDirty] = useState(false)
  const [dragging, setDragging] = useState<DragRef | null>(null)
  const { state, busy, download } = useReportDownload()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Cerrar o recargar con cambios sin descargar: el navegador avisa.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (!range) return <EditorMessage text="Faltan la empresa o las fechas del reporte." />
  if (!data || !layout) {
    return <EditorMessage text={companies.length > 0 ? 'No se encontró la empresa del reporte.' : 'Cargando reporte…'} />
  }

  function change(next: ReportLayout) {
    setEdited(next)
    setDirty(true)
  }

  function handleDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current as DragRef | undefined) ?? null)
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragging(null)
    const active = e.active.data.current as DragRef | undefined
    if (!active || !layout) return
    const next = applyDragEnd(layout, active, (e.over?.data.current as DragRef | undefined) ?? null)
    if (next !== layout) change(next)
  }

  async function handleDownload() {
    if (!data || !layout) return
    if (await download(data, layout, reportFilename(data, '_editado'))) setDirty(false)
  }

  const overlayPhoto =
    dragging?.type === 'browser' ? dragging.photo : dragging?.type === 'slot' ? photoAt(layout, dragging) : null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="flex items-center gap-4 border-b px-4 py-2">
        <Link
          href="/reports"
          onClick={(e) => {
            if (dirty && !window.confirm('Hay cambios sin descargar. ¿Salir del editor y perderlos?')) e.preventDefault()
          }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <h1 className="truncate text-sm font-semibold text-foreground">
          Editar reporte · {data.company.name} · {data.rangeStart} → {data.rangeEnd}
        </h1>
        <Button onClick={handleDownload} disabled={busy} className="ml-auto gap-2">
          <DownloadButtonLabel state={state} idleLabel="Descargar" />
        </Button>
      </header>
      {((state.phase === 'done' && state.missing > 0) || state.phase === 'error') && (
        <div className="border-b px-4 py-2">
          <DownloadMessages state={state} />
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="flex min-h-0 flex-1">
          <aside className="w-72 shrink-0 overflow-y-auto border-r p-3">
            <PhotoBrowser tree={tree} used={used} />
          </aside>
          <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
            <ReportCanvas layout={layout} companyName={data.company.name} onChange={change} />
          </main>
        </div>
        <DragOverlay dropAnimation={null}>
          {overlayPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={overlayPhoto.url} alt="" className="h-24 w-24 rounded bg-white object-contain shadow-xl ring-1 ring-black/10" />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function EditorMessage({ text }: { text: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-background text-sm text-muted-foreground">
      <p>{text}</p>
      <Link href="/reports" className="text-foreground underline">Volver a Reportes</Link>
    </div>
  )
}
```

- [ ] **Step 6: Type-check, lint y build**

Run (desde `hub/`): `npx tsc --noEmit -p . 2>&1 | grep error | grep -v "__tests__\|\.test\."`
Expected: sin salida.
Run: `npx eslint src/components/reports src/app/reports src/lib/data`
Expected: sin errores.
Run (desde la raíz): `npm run build:hub`
Expected: build OK, aparece la ruta `/reports/editor`.

- [ ] **Step 7: Commit**

```bash
git add hub/package.json package-lock.json hub/src/app/reports/editor hub/src/components/reports/editor
git commit -m "feat(reportes): editor del registro fotográfico con arrastrar y soltar"
```

---

### Task 6: Verificación en el navegador y vault

**Files:**
- Modify: `vault/project/Architecture.md`
- Modify: `vault/processes/PhotoDocumentation.md`
- Modify: `vault/_index.md`
- Create: `vault/logs/2026-10-02-editor-registro-fotografico.md`

- [ ] **Step 1: Tests completos**

Run (desde la raíz): `npm test`
Expected: los 3 workspaces en verde.

- [ ] **Step 2: Prueba manual** (`npm run dev:hub`, sesión de coordinador, `http://localhost:3000/reports`)

Checklist — cada punto debe cumplirse:
1. Elegir empresa y semana con pesajes → "Descargar reporte PDF" baja el mismo PDF de siempre (4 cuadros por hoja, fotos completas).
2. "Editar reporte" abre el editor a pantalla completa con el reporte ya armado, empresa y rango correctos en el header.
3. Recargar la página del editor → "Cargando reporte…" y después el reporte (Review Focus 1).
4. Abrir `/reports/editor?company=x&start=2026-13-01&end=2026-10-02` → mensaje + "Volver a Reportes" (Review Focus 2).
5. Buscador: carpetas día → sesión → tacho; al abrir un tacho se ven las miniaturas "Balanza" y "Tacho"; las que están en el canvas dicen "✓ en uso"; no hay anato ni cito.
6. Arrastrar un cuadro: los demás se corren con animación; no se puede llevar a otro día.
7. Soltar una miniatura en un recuadro lleno → la reemplaza; arrastrar una foto del canvas sobre otra → intercambian; ✕ vacía un recuadro.
8. Editar un comentario; "+ Agregar cuadro" agrega uno vacío al final del día; 🗑 → "Sí" lo borra.
9. Con cambios, intentar recargar → el navegador avisa; "Volver" → pide confirmar.
10. "Descargar" → baja `…_editado.pdf` con la disposición editada, mismos logos y barra de datos; recuadros vacíos en blanco; un día sin cuadros no aparece (Review Focus 3).

- [ ] **Step 3: Vault**

`vault/project/Architecture.md` — en la sección de dependencias, agregar:

```markdown
- **`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`** (hub, 2026-10-02) — arrastrar y soltar del editor del registro fotográfico. Elegida sobre el drag & drop nativo de HTML5 por el reordenamiento animado de los cuadros. Ver [[2026-10-02-editor-registro-fotografico]].
```

`vault/processes/PhotoDocumentation.md` — en "Formato del informe", agregar:

```markdown
- **Editor** (2026-10-02): "Editar reporte" abre un editor donde coordinación reacomoda cuadros y fotos antes de descargar. Arranca con el reporte automático, usa los mismos filtros y no guarda nada: cerrar la pestaña pierde la edición. "Descargar reporte" sigue bajando el automático.
```

`vault/logs/2026-10-02-editor-registro-fotografico.md`:

```markdown
---
title: Editor del registro fotográfico
tags:
  - logs
  - reports
updated: 2026-10-02
---

# Editor del registro fotográfico

Botón "Editar reporte" en `/reports`: editor de pantalla completa para reacomodar el
registro antes de descargarlo. Pedido para que el equipo decida si le aporta valor.

## Decisiones
- **Sin persistencia.** Editan, descargan y listo; cerrar la pestaña pierde todo. Evita tabla nueva y conflictos de edición simultánea mientras no se sepa si el equipo lo usa.
- **Una maqueta, un PDF.** El PDF se dibuja desde la maqueta (días → cuadros → 8 recuadros). La descarga automática y la editada usan el mismo componente, así el diseño no se duplica.
- **Grilla única 4×2.** Recorrido y pesaje son la misma grilla (pesaje: balanza arriba, tacho abajo en la misma columna), así cualquier foto entra en cualquier recuadro.
- **Buscador solo de pesajes**, por día → sesión → tacho/contenedor. Las fotos de recorrido no están en él.
- **Cuadros solo dentro de su día**: la fecha de la hoja sigue siendo verdad.

Spec: `docs/superpowers/specs/2026-10-02-editor-registro-fotografico-design.md`.

## Pendiente
- Ver con coordinación si lo usan; si sí, evaluar guardar ediciones.
```

`vault/_index.md` — actualizar `updated:` a `2026-10-02` y agregar a la tabla de pendientes:

```markdown
| Preguntar a coordinación si el editor del registro fotográfico les sirve (si sí: ¿guardar ediciones?) | [[2026-10-02-editor-registro-fotografico]] |
```

- [ ] **Step 4: Commit**

```bash
git add vault/project/Architecture.md vault/processes/PhotoDocumentation.md vault/_index.md vault/logs/2026-10-02-editor-registro-fotografico.md
git commit -m "docs(vault): editor del registro fotográfico"
```
