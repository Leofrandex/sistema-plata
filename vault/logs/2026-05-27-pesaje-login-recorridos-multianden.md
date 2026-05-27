---
title: Ajustes UX — Pesaje / Login / Recorridos multi-andén
tags:
  - log
  - pesaje
  - login
  - recorridos
updated: 2026-05-27
---

# 2026-05-27 — Pesaje / Login / Recorridos multi-andén

Lote de 4 ajustes post-piloto (la tarea 5, rediseño del reporte fotográfico, se
diseña aparte cuando exista la imagen de ejemplo de referencia).

Spec: `docs/superpowers/specs/2026-05-27-pesaje-login-recorridos-multianden-design.md`
Plan: `docs/superpowers/plans/2026-05-27-pesaje-login-recorridos-multianden.md`

## 1. Pesaje — "vehículo Yaris" → "tacho Yaris", sin ícono de carro

El concepto Yaris dejó de referirse a un vehículo: se renombró a "tacho Yaris" y se
quitó el ícono `Car` (label del selector y badge "Dedicado a Yaris"). `weighing-form.tsx`.

## 2. Login — mostrar/ocultar contraseña

Botón ojo (`Eye`/`EyeOff`) dentro del campo de contraseña que alterna `type`
password/text. `login/page.tsx`.

## 3. Pesaje — orden de fotos

La foto de la balanza ahora va **arriba** y la del envase **abajo** (columna única).
Solo cambia el orden visual; el orden de subida `photo_container`/`photo_scale` y el
mapeo del reporte (idx 0=Envase, idx 1=Balanza) **no** cambian. `weighing-form.tsx`.

## 4. Recorridos — multi-andén por horario

**Por qué:** una ruta de un horario suele recoger en varios andenes. Antes cada
horario admitía un solo registro de recorrido, así que cada andén obligaba a "rehacer"
la página. Además, al editar un recorrido se perdían las fotos (solo se subían al
finalizar).

**Decisión de diseño:** se replica el patrón de pesaje (sesión → varios registros
editables) **sin agregar tabla nueva**. Cada andén = un `route_event`; la "sesión" del
horario se identifica por `(date, slot, kind='anden')`. Ver ADR implícito en el spec.

**Cambios clave:**
- Migración `20260527010000_drop_route_anden_unique.sql`: se elimina el índice único
  parcial `route_events_anden_unique_date_slot` para permitir varios andenes por
  horario/día.
- Las fotos de cada andén se **suben al guardar el andén**, no al finalizar el
  recorrido → resuelve la pérdida de fotos al editar. En edición se preservan las
  fotos existentes por `photo_id` y solo se suben las nuevas (`mergePhotoIds`).
- Estados: andén guardado = `route_event` `in_progress`; "Finalizar recorrido" marca
  todos los andenes del horario como `completed`. "Cancelar" los borra.
- Recuperación: si la app se cierra a mitad, los andenes `in_progress` reconstruyen la
  sesión al reabrir el horario (sin pérdida).
- Helpers puros `getSlotAndenEvents` / `mergePhotoIds` en `src/lib/data/route-sessions.ts`
  (con tests). `findAndenInProgress` → `listAndenInProgress` (devuelve lista).
- Nuevo `RouteSessionDrawer` (espejo de `WeighingSessionDrawer`) para revisitar/editar
  andenes. `[slot]/page.tsx` reescrito; `anden/page.tsx` recalcula estado por slot.

**Recorrido completo primero:** los envases se consolidan al finalizar el recorrido,
no por andén individual.

## 5. Reportes — rediseño

**Por qué:** el reporte agrupaba por etapa global (todos los recorridos, luego todos los
pesajes). Se necesita orden estricto **por día → por ruta → recorrido + pesaje de esos
tachos**, replicando el formato impreso del ejemplo (4 cuadros 2×2, 8 fotos por cuadro).

Spec: `docs/superpowers/specs/2026-05-27-reporte-fotografico-rediseno-design.md`
Plan: `docs/superpowers/plans/2026-05-27-reporte-fotografico-rediseno.md`
Imagen de referencia: `docs/superpowers/specs/2026-05-27-reporte-ejemplo.png`

**Cambios clave:**
- `reports.ts`: nueva estructura `days → groups` (cada grupo = Recorrido o Pesaje de una
  ruta, con etiqueta). Orden: por día, por ruta (slot cronológico), grupo Recorrido y
  luego grupo Pesaje (recepciones de los tachos sucios recogidos en esa ruta). Grupos
  vacíos se omiten. `buildPhotographicReportData` ahora recibe `{ start, end }`.
- **Pesajes huérfanos:** recepciones sin recorrido en el rango (data histórica, Yaris) se
  agrupan por su fecha de pesaje en un grupo "Pesaje" — evita regresión con el histórico
  de Airkem.
- PDF (`photographic-report-document.tsx`): layout horizontal, barra de metadatos arriba
  (Edificio/Ubicación/Empresa fijos + Fecha = el día de la página), **4 cuadros 2×2**,
  cada cuadro con su etiqueta + grilla de 8 fotos (4×2) + "Comentario:". Cada grupo
  arranca cuadro nuevo (overflow → "(cont.)"); **salto de página por día**.
- `/reports`: selector de **rango de fechas** (Desde/Hasta) con default semana actual
  (lunes→hoy) y validación de rango inválido.

## Pendiente

- E2E manual del flujo multi-andén y del reporte (PDF) en dispositivo real.
