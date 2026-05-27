# Diseño — Rediseño del Reporte Fotográfico (Tarea 5)

**Fecha:** 2026-05-27
**Referencia visual:** `2026-05-27-reporte-ejemplo.png` (en esta carpeta)
**Relacionado:** `2026-05-27-pesaje-login-recorridos-multianden-design.md` (tareas 1-4 ya implementadas)

---

## Contexto

El reporte fotográfico actual (`/reports`) agrupa las fotos por etapa global (todas
las de recorridos, luego todas las de pesajes) en una grilla de 2 columnas, rango fijo
lunes→hoy. Se rediseña para: (a) permitir un rango de fechas manual, (b) ordenar
estrictamente por día → ruta → recorrido + pesaje, (c) replicar el layout del ejemplo
(4 cuadros 2×2, 8 fotos por cuadro, salto de página por día).

Archivos actuales de referencia:
- `src/lib/data/reports.ts` — construye `PhotographicReportData` (byStage global)
- `src/components/reports/photographic-report-document.tsx` — PDF con `@react-pdf/renderer`
- `src/app/reports/page.tsx` — selección de empresa + rango automático
- `src/components/reports/report-preview.tsx` — preview/descarga

El reporte sigue siendo **por empresa** (un PDF por empresa), filtrando a los
containers de esa empresa.

---

## Modelo de datos del reporte (nuevo)

El reporte se estructura como una lista ordenada de **días**, cada día con una lista
ordenada de **grupos** de fotos. Cada grupo tiene una etiqueta y sus fotos.

```ts
interface ReportPhotoGroup {
  label: string                 // "Recorrido — 1ra ruta 06:30", "Pesaje — 1ra ruta"
  photos: ReportPhotoEntry[]    // fotos del grupo, en orden
}

interface ReportDay {
  date: string                  // YYYY-MM-DD (local)
  groups: ReportPhotoGroup[]    // en orden estricto
}

interface PhotographicReportData {
  company: Company
  client: Client
  rangeStart: string            // YYYY-MM-DD
  rangeEnd: string              // YYYY-MM-DD
  generatedAt: string
  days: ReportDay[]             // solo días con al menos una foto
  meta: { routeEventCount: number; weighingReceptionCount: number; totalPhotos: number }
}
```

`ReportPhotoEntry` se conserva (photo, container_id, container, taken_at, comment).

### Orden estricto

Para cada día del rango (cronológico ascendente):
1. Se toman los `route_events` de andén de ese día cuyos containers tocan la empresa,
   **agrupados por ruta/slot** y ordenados por hora (`started_at`).
2. Por cada ruta, en orden, se generan dos grupos:
   - **Grupo Recorrido:** todas las fotos (`photo_ids`) de los andenes de esa ruta
     (todos los `route_events` con ese `(date, slot)`), en orden de `taken_at`.
     Etiqueta: `Recorrido — {ordinal} ruta {hora}`.
   - **Grupo Pesaje:** las recepciones de los tachos **sucios recogidos** en esa ruta
     que pertenecen a la empresa; sus fotos en orden. Etiqueta: `Pesaje — {ordinal} ruta`.
3. Un grupo con 0 fotos se omite.

> El ordinal/hora de la ruta se obtiene de `getRouteSlotDefinition(slot)`.
> Una recepción se asigna a la ruta donde su container aparece en
> `containers_dirty_received`. Si un container fue recogido en varias rutas del día
> (caso raro), se asigna a la primera (menor `started_at`).

---

## Layout del PDF (réplica del ejemplo)

- Página **A4 horizontal**.
- Encabezado: logo/Marca, título **"REGISTRO FOTOGRÁFICO"**, (logo derecha opcional).
- **Una barra de metadatos** arriba, por página: `Edificio` y `Ubicación` fijos
  (placeholder "—" / nombre de empresa), `Empresa` = nombre, y `Fecha` = el día de
  esa página. (La barra es la misma en todas las páginas salvo la fecha.)
- **4 cuadros en grilla 2×2.** Cada cuadro:
  - Encabezado del cuadro con su etiqueta (`label`).
  - Grilla de hasta **8 fotos (4 columnas × 2 filas)**, llenadas izquierda→derecha,
    arriba→abajo.
  - Fila inferior **`Comentario:`** con la etiqueta del grupo.
- Número de página abajo a la derecha ("PAG X").

### Reglas de paginación y llenado

- **Cada grupo arranca en un cuadro nuevo.** Si un grupo tiene más de 8 fotos, continúa
  en cuadros adicionales con la misma etiqueta + sufijo ` (cont.)`. Si tiene menos de 8,
  el cuadro queda parcialmente vacío.
- Los cuadros se colocan de a 4 por página (2×2), en orden.
- **Cambio de día ⇒ salto de página.** El nuevo día empieza en página nueva aunque la
  anterior tenga cuadros vacíos.
- Dentro de un mismo día, si se llenan los 4 cuadros, se continúa en otra página del
  mismo día (misma fecha en la barra de metadatos).

### Algoritmo de "cuadros"

1. Por cada día → por cada grupo → partir `group.photos` en chunks de 8 → cada chunk es
   un "cuadro" con la etiqueta del grupo (cont. si es chunk >0).
2. Agrupar los cuadros del día en páginas de 4.
3. Renderizar una `Page` por cada página de cuadros, con la fecha del día.

---

## Selector de fechas (UI)

En `src/app/reports/page.tsx`:
- Mantener el selector de empresa.
- Default: semana actual (lunes 00:00 → ahora), como hoy.
- Agregar dos inputs `<input type="date">`: **Desde** y **Hasta**, inicializados al
  rango por defecto. Al cambiarlos, se reconstruye el reporte con ese rango.
- Validación simple: si `desde > hasta`, mostrar aviso y no generar.
- `buildPhotographicReportData(companyId, store, { start, end })` recibe el rango.

---

## Detalles menores resueltos

- **Orden de las 2 fotos por tacho en pesaje:** se mantiene el orden actual del reporte
  (idx 0 = Envase, idx 1 = Balanza). El reordenamiento previo fue solo en la pantalla de
  captura.
- **Fotos de recorrido:** son la lista plana de `photo_ids` del/los `route_event(s)` de
  la ruta (no se dividen en sucios/limpios; el modelo de captura no lo soporta).
- **Comentario por foto vs por cuadro:** el ejemplo usa un comentario por cuadro →
  el `Comentario:` muestra la etiqueta del grupo. (Se deja de mostrar el comentario
  por-foto del diseño anterior.)

---

## Componentes / archivos

- `src/lib/data/reports.ts` — REWRITE de `buildPhotographicReportData` a la estructura
  `days → groups`; firma con rango `{ start, end }`. Conservar `getMondayOfWeek`,
  `isoDate`, `withinRange`. Helper nuevo `chunk` (o reusar).
- `src/__tests__/lib/reports.test.ts` — actualizar/añadir tests del nuevo orden y agrupación.
- `src/components/reports/photographic-report-document.tsx` — REWRITE del layout (2×2,
  8 fotos, salto por día, metadatos arriba).
- `src/app/reports/page.tsx` — inputs de rango desde/hasta.
- `src/components/reports/report-preview.tsx` — ajustes menores si la firma de datos cambia.

---

## Fuera de alcance

- Dividir fotos de recorrido en sucios/limpios (requeriría cambiar la captura).
- Reportes multi-empresa en un solo PDF (sigue siendo uno por empresa).
