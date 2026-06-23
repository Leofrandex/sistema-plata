# Diseño — Colores de estados, historial de recorridos, tab de tachos y reportes

**Fecha:** 2026-06-22
**Rama:** `feat/colores-estados-historial-tachos-reportes`

## Contexto

Lote de cuatro ajustes de UI independientes, surgidos de uso operativo post-lanzamiento:

1. Recolorear los 4 estados de circulación de los tachos.
2. Reorganizar el historial de recorridos (limpios/sucios en líneas separadas + contadores).
3. Enriquecer el tab de Tachos (filtros por empresa y fase, columna de tiempo en fase, fases = estados del dashboard).
4. Corregir las fotos en los reportes (quitar firmas, parear peso arriba / tacho abajo).

Sin migraciones de base de datos. Verificación al final: `jest` y `next build`.

---

## 1. Colores de los 4 estados

**Fuente única de verdad:** `BUCKET_DEFINITIONS` en `src/lib/data/dashboard-metrics.ts` (líneas 27–32).

Cambiar los colores:

| Estado (`key`)      | Label                  | Color actual        | Color nuevo        |
|---------------------|------------------------|---------------------|--------------------|
| `en_planta`         | En planta              | `#94A3B8` (gris)    | **`#16A34A`** verde |
| `en_cliente`        | En cliente             | `#10B981` (verde)   | **`#F97316`** naranja |
| `pendiente_pesar`   | Pendiente por pesar    | `#F59E0B` (ámbar)   | **`#94A3B8`** gris  |
| `pendiente_tratar`  | Pendiente por tratar   | `#2A27E9` (azul)    | **`#DC2626`** rojo  |

Estos colores ya fluyen automáticamente al `circulation-pie-chart.tsx` (celdas + leyenda) porque leen `bucket.color`. No hay otro lugar que defina estos colores.

**Helper nuevo:** exportar desde `dashboard-metrics.ts`

```ts
export function circulationColor(bucket: CirculationBucket): string
export function circulationLabel(bucket: CirculationBucket): string
```

Ambos derivados de `BUCKET_DEFINITIONS` (lookup por `key`). Se reutilizan en el tab de Tachos (cambio #3) para que el badge de fase use exactamente el mismo color y label que el dashboard.

---

## 2. Historial de recorridos

**Archivo:** `src/components/history/route-history.tsx` (línea 117–119, dentro de cada tarjeta de recorrido).

Hoy: una sola línea `Sucios: … · Limpios: …`.

Cambiar a **dos líneas, cada una con contador**, en el orden limpios → sucios:

- **`Limpios (N): A-001, A-002`** — texto verde (`text-green-700`).
- **`Sucios (N): A-010, A-011`** — texto rojo (`text-red-700`).

Donde `N = ev.containers_clean_delivered.length` y `ev.containers_dirty_received.length` respectivamente. Cuando una lista está vacía, mostrar `Limpios (0): —`. Se conservan `formatTachoNumber` para cada id y la línea de `Área`. Contadores **por tarjeta** (no resumen global).

El bloque de edición (coordinador) no cambia; ya usa `Sucios (n)` / `Limpios (n)` en sus botones.

---

## 3. Tab de Tachos

**Archivos:** `src/app/containers/page.tsx`, `src/components/containers/container-table.tsx`, `src/components/containers/container-filters.tsx`, y `src/lib/data/dashboard-metrics.ts`.

### 3a. Fase = los 4 estados del dashboard

La columna "Fase actual" deja de mostrar las 6 fases internas (`PHASE_LABELS`: Recorrido/Pesaje/Cámara fría/Tratamiento/Traslado/Limpio) y pasa a mostrar uno de los **4 estados de circulación** del dashboard, con su color (cambio #1).

Función nueva en `dashboard-metrics.ts` (refactor de `computeCirculationBucket` para exponer también el timestamp de entrada al estado):

```ts
export interface CirculationStatus {
  bucket: CirculationBucket
  sinceMs: number | null   // epoch ms del evento que lo dejó en este estado; null si no hay eventos
}
export function computeCirculationStatus(
  container: Container,
  store: CirculationTimelineSlice,
): CirculationStatus
```

`sinceMs` = el `latest` (máximo de cleanDelivered/dirtyReceived/reception/closed). Si `latest === -Infinity` (sin eventos, estado `en_planta` inicial), `sinceMs = null`. `computeCirculationBucket` se reimplementa como `computeCirculationStatus(...).bucket` para no duplicar lógica.

### 3b. Columna "Tiempo en fase" (reemplaza "Ubicación actual")

Muestra el tiempo transcurrido desde `sinceMs` hasta ahora. Formato compacto:

- `≥ 1 día` → `"Xd Yh"` (ej. `3d 4h`)
- `≥ 1 hora` → `"Xh Ym"` (ej. `5h 20m`)
- `< 1 hora` → `"Xm"` (ej. `12m`)
- `sinceMs === null` → `"—"`

Helper nuevo `formatDuration(ms: number): string` (en `dashboard-metrics.ts` o `src/lib/data/containers.ts`). El "ahora" se toma de un estado `now` en la página, refrescado cada 60s con `setInterval`, para que el valor no quede congelado sin recargar.

### 3c. Filtros nuevos

En `container-filters.tsx`, extender la interfaz `ContainerFilters`:

```ts
export interface ContainerFilters {
  search: string
  size: ContainerSize | 'all'
  company: string | 'all'           // company_id
  phase: CirculationBucket | 'all'  // estado de circulación
}
```

- **Empresa:** `Select` poblado con `companies` (pasadas como prop desde la página). Opción "Todas las empresas".
- **Fase:** `Select` con las 4 opciones del dashboard (`circulationLabel` por bucket) + "Todas las fases".

La grilla del filtro pasa de `sm:grid-cols-2` a `sm:grid-cols-2 lg:grid-cols-4` para acomodar los 4 controles.

### 3d. Empresa actual del tacho

La empresa es propiedad del registro, no del tacho (`decisions/2026-06-10-empresa-por-registro.md`). Para filtrar, se deriva la **empresa actual** = `company_id` del registro más reciente que referencia al tacho, comparando:
- la recepción no anulada más reciente (`arrived_at`), y
- el recorrido no anulado más reciente que lo incluye en dirty o clean (`started_at`).

Gana el más nuevo; si ninguno tiene `company_id`, la empresa actual es `null` (no matchea ningún filtro de empresa concreto).

### 3e. Modelo de la página

`page.tsx` deja de depender de `buildContainerWithPhase` para esta vista y construye un view-model propio por tacho activo (no-yaris, como hace el dashboard):

```ts
interface TachoRow {
  id: string
  size_liters: ContainerSize
  bucket: CirculationBucket
  sinceMs: number | null
  company_id: string | null   // empresa actual derivada
}
```

Filtrado por `search` (id), `size`, `company`, `phase`. `ContainerTable` recibe `TachoRow[]` + `companies` (para no necesitar `clients`). El click sigue navegando a `/containers/{id}` (la página de detalle, con sus 6 fases, no cambia).

Columnas finales de la tabla: **Tacho · Tamaño · Fase · Tiempo en fase**.

---

## 4. Reportes

**Archivos:** `src/lib/data/reports.ts`, `src/components/reports/photographic-report-document.tsx`.

### 4a. Quitar las firmas

En `routePhotoEntries` (reports.ts línea 188), omitir el id de firma:

```ts
for (const photoId of ev.photo_ids) {
  if (photoId === ev.signature_photo_id) continue   // ← nuevo
  ...
}
```

Se usa `signature_photo_id` (campo conocido del `RouteEvent`) en vez de `photo.role`, porque el tipo `Photo` del app no expone `role`. Robusto y sin tocar el esquema.

### 4b. Peso arriba / tacho abajo — 4 pesajes por bloque

Orden de `photo_ids` en una recepción de pesaje es determinista: **índice 0 = tacho, índice 1 = balanza/peso** (ver `persistWeighingPhotos` en `app/register/weighing/page.tsx`: `[photo_container, photo_scale]`). No se requieren roles ni migración.

**Estructura nueva** en `reports.ts`:

```ts
export interface WeighingPair {
  container_id: string
  container: Container | null
  scale: Photo | null   // photo_ids[1]
  tacho: Photo | null   // photo_ids[0]
}
```

`ReportPhotoGroup` gana un campo opcional `pairs?: WeighingPair[]` que se llena solo para grupos `stage: 'weighing'`. La función `weighingPhotoEntries` se reemplaza por `weighingPairs(recs)`:
- Recepciones ordenadas por `arrived_at`.
- Por recepción: `scale = photoMap.get(photo_ids[1])`, `tacho = photoMap.get(photo_ids[0])`. Si solo hay una foto, se ubica como `tacho` y `scale = null` (caso raro/histórico).
- Se omiten recepciones sin ninguna foto.

`pushGroup` debe considerar no vacío también cuando hay `pairs`. El conteo `weighingPhotoCount` suma fotos presentes en los pares (scale + tacho no nulos).

**Render** en `photographic-report-document.tsx`:
- `buildCuadros`: para grupos de recorrido, chunk de `photos` por 8 (sin cambios). Para grupos de pesaje, chunk de `pairs` por **4** (4 pesajes por bloque). `Cuadro` pasa a llevar `stage` + (`photos` | `pairs`).
- `CuadroView`: si `stage === 'weighing'`, renderiza una grilla de columnas (cada par = una columna de `width: 25%`): foto de peso arriba, foto de tacho debajo, en la misma columna. Si `stage === 'route'`, mantiene la grilla actual de 8 fotos.

Layout objetivo del bloque de pesaje:

```
┌────────┬────────┬────────┬────────┐
│ PESO 1 │ PESO 2 │ PESO 3 │ PESO 4 │
├────────┼────────┼────────┼────────┤
│TACHO 1 │TACHO 2 │TACHO 3 │TACHO 4 │
└────────┴────────┴────────┴────────┘
```

---

## Fuera de alcance (YAGNI)

- No se añade `role` a las fotos de pesaje (el orden de índice ya es determinista).
- No se cambia la página de detalle del tacho (`/containers/{id}`) ni su lifeline de 6 fases.
- No se añade resumen global de limpios/sucios en el historial (contadores por tarjeta).
- No hay actualización en tiempo real por segundo de "Tiempo en fase" (refresco cada 60s).

## Verificación

- `npm run test:jest` (incluye tests de `dashboard-metrics` y `reports`; añadir casos para `computeCirculationStatus`, `formatDuration`, `weighingPairs`, exclusión de firma).
- `next build`.
- E2E manual: dashboard (colores), historial (2 líneas + contadores), tab tachos (filtros + tiempo en fase), reporte PDF (sin firmas, peso/tacho pareados).
