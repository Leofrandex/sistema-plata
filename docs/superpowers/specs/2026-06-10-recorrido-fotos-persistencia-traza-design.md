# Diseño — Lote post-lanzamiento: fotos de recorrido, persistencia cross-device, traza de usuario

**Fecha:** 2026-06-10
**Estado:** Aprobado para implementación
**Autor:** Sebastián + Claude (brainstorming)

## Contexto

Lote de correcciones y mejoras detectadas en operación real tras el lanzamiento
(2026-06-01). Reúne cinco grupos de trabajo que comparten dominio (recorrido,
pesaje, hidratación Supabase) y una causa raíz común para varios síntomas.

La investigación sobre la base real (`xqqnthyipkdkwyknbtnw`) confirmó:

- El store se hidrata desde Supabase **solo** para `{containers, weighingSessions,
  receptions, routeEvents, photos}`. `storageEvents`, `treatmentRuns`,
  `externalTransfers` y `locations` se quedan en datos MOCK y nunca se refrescan.
- `handleFinish` de pesaje escribe `StorageEvent` y `ContainerLocation` **solo al
  store local** (`addStorageEvent`/`addLocation`); nunca a Supabase. Por eso
  `storage_events` y `container_locations` tienen 0 filas.
- Dos `route_events` idénticos (tachos 001/055/185) creados con 2.6 s de diferencia
  → doble-submit del botón "Guardar andén".
- `route_events.floor` y `route_events.dock` nunca se escriben (código muerto). La
  "Ubicación del recorrido" mapea a `route_events.area`.
- `containers` no tiene columna de usuario creador (`created_by`); el resto de las
  tablas de eventos ya tienen `operator_id` poblado.

## Decisiones de diseño tomadas

1. **Fase del tacho:** los **eventos siguen siendo la fuente de verdad**. En este
   lote solo se arregla persistencia + hidratación. La columna cacheada
   `current_phase` y las vistas de Postgres quedan **fuera de alcance**; se documenta
   en el ADR que el próximo paso de escala es la **vista de Postgres** (no la columna).
2. **Cross-device:** completar write-through + hidratación y conservar la recarga
   existente al enfocar la pestaña / refrescar. **Sin Supabase Realtime.**
3. **Fotos de recorrido:** varias por categoría (sucios / limpios), mínimo una de
   cada, sección de sucios primero.
4. **Traza de usuario:** agregar `containers.created_by` y mostrar "registrado por"
   en el admin de tachos.

---

## Grupo 1 — Persistencia + hidratación completas (columna vertebral)

**Arregla:** tratamiento invisible en otro dispositivo; gráfico "kg del día" que no
se actualiza.

### Causa raíz
La lógica de fase (`computeContainerPhase`) necesita `storage_events` para que un
tacho pase de `weighing` a `cold_storage` (requisito para aparecer en tratamiento).
Esos eventos hoy solo viven en el store local del dispositivo que pesó. Cualquier
otro dispositivo (o el mismo tras refrescar) re-hidrata desde Supabase, donde la
tabla está vacía y además ni siquiera se consulta → el tacho queda atascado en
`weighing`. El mismo hueco deja `treatmentRuns` sin hidratar, por lo que el
"procesado" del gráfico kg/día nunca refleja la realidad.

### Cambios

**Write-through (`src/app/register/weighing/page.tsx`, `handleFinish`):**
- Persistir cada `storage_event` a Supabase antes de `addStorageEvent`.
- Persistir cada `container_location` a Supabase antes de `addLocation`.
- Usar los IDs reales devueltos por la BD en el store (no `storage-${Date.now()}`).
- El `treatment_run` del flujo "tratar inmediatamente" ya se persiste; mantener.
- Revisar `src/app/register/treatment/page.tsx`: el `addLocation` del envío a
  tratamiento también es local-only → persistir igual.

**Queries nuevas (`src/lib/supabase/queries.ts`):**
- `createStorageEvent(supabase, row)` → inserta en `storage_events`, devuelve fila.
- `createContainerLocation(supabase, row)` → inserta en `container_locations`,
  devuelve fila.
- `listStorageEvents(supabase)`
- `listTreatmentRuns(supabase)`
- `listExternalTransfers(supabase)`
- `listContainerLocations(supabase)`
- Adaptadores fila→tipo correspondientes (`rowToStorageEvent`, etc.).

**Hidratación (`src/components/supabase-hydrator.tsx`):**
- Agregar las 4 tablas al `Promise.all` de carga.
- Mapear a los tipos del store e incluirlas en el patch de `hydrate()`.

**Store (`src/lib/store.ts`):**
- `hydrate(patch)` ya hace `set(patch)`; basta con que el hydrator incluya
  `storageEvents`, `treatmentRuns`, `externalTransfers`, `locations` en el patch.
- Confirmar que el tipo del patch acepta esas claves.

### Criterio de aceptación
- Dispositivo A pesa y finaliza → `storage_events` y `container_locations` ganan
  filas en Supabase.
- Dispositivo B (o A tras refrescar) ve esos tachos como candidatos en
  `/register/treatment`.
- El gráfico "kg del día" muestra "procesado" coherente con los tratamientos
  reales tras refrescar en cualquier dispositivo.

---

## Grupo 2 — Rediseño de fotos en recorrido

**Arregla:** fotos no obligatorias por tipo; falta de orden; "las fotos no
permanecen al editar un andén".

### Schema
- Migración no destructiva: `alter table public.photos add column role text;`
- Convención: `'dirty'` y `'clean'` para fotos de recorrido. `null` para pesaje
  (que **no** cambia: sigue siendo posicional balanza/tacho).

### Tipos y formulario
- `RouteFormState` (`src/components/register/route-form.tsx`):
  - Reemplazar `photos: string[]` por `dirtyPhotos: string[]` + `cleanPhotos: string[]`.
- Render en orden: **(1) Fotos de tachos sucios**, **(2) Fotos de tachos limpios**.
  Cada sección usa `PhotoCaptureMulti` (varias fotos). Etiquetas claras.
- Validación `canSaveAnden` (`anden/[slot]/page.tsx`): requiere
  `dirtyPhotos.length + dirtyExistentes ≥ 1` **y** `cleanPhotos.length + cleanExistentes ≥ 1`,
  además de la empresa y al menos un tacho (condiciones actuales).

### Subida y tipos del store
- `RouteEvent` (`src/lib/types.ts`): agregar `dirty_photo_ids: string[]` y
  `clean_photo_ids: string[]`. Mantener `photo_ids` como **unión** (lo usan los
  reportes; no se toca su consumo).
- Al guardar andén (`handleCreateAnden`/`handleUpdateAnden`):
  - Subir `dirtyPhotos` con `role: 'dirty'` y `cleanPhotos` con `role: 'clean'`.
  - `uploadEventPhotos` (`src/lib/data/photos.ts`) acepta un `role` opcional que se
    persiste en `public.photos.role`.
- Hidratación: al reconstruir `photo_ids` por evento, agrupar por `role` en
  `dirty_photo_ids` / `clean_photo_ids`; `photo_ids` = unión de ambos.

### Edición de andén (mostrar fotos existentes)
- Hoy `handleSelectAnden` pone `photos: []`, ocultando las fotos ya subidas (de ahí
  el síntoma "se pierden"). Tras el rediseño, cada sección muestra las fotos
  existentes del grupo (por id, con su URL firmada) más las nuevas a agregar.
- La preservación por id en el guardado se mantiene (equivalente a `mergePhotoIds`
  por grupo).

### Criterio de aceptación
- No se puede guardar un andén sin al menos una foto de sucios y una de limpios.
- Al editar un andén ya registrado, sus fotos existentes (sucios y limpios) se ven.
- En Supabase, las fotos de recorrido quedan con `role` correcto.

---

## Grupo 3 — Anti doble-submit en andén

**Arregla:** andenes duplicados por doble-tap.

- `anden/[slot]/page.tsx`: estado `saving` (bool). `handleSaveAnden` retorna
  temprano si `saving`; lo pone en `true` al entrar y `false` en `finally`.
- El botón "Guardar andén / Guardar cambios del andén" se deshabilita con
  `saving` (además del `!canSaveAnden` actual). Mismo patrón `submitting` que ya usa
  `/register/treatment`.

### Criterio de aceptación
- Un doble-tap rápido en "Guardar andén" crea **un** `route_event`, no dos.

---

## Grupo 4 — Traza de usuario en tachos

- Migración: `alter table public.containers add column created_by uuid references public.profiles(id);`
  (nullable; los 230 históricos quedan `null`).
- `Container` (tipo + `rowToContainer` en el hydrator): incluir `created_by`.
- Al crear un tacho en el admin: poblar `created_by = currentProfileId`.
- Mostrar "Registrado por" en el admin de tachos (nombre del perfil; "—" si `null`).

### Criterio de aceptación
- Un tacho nuevo guarda el `created_by` del usuario logueado.
- El admin de tachos muestra quién registró cada tacho (o "—" para históricos).

---

## Grupo 5 — Limpieza de schema

- Migración: `alter table public.route_events drop column floor, drop column dock;`
  - Quitar `floor`/`dock` de: `RouteEvent` (tipo), `mapRouteEvents`, `createRouteEvent`/
    `updateRouteEvent` (queries), `RouteFormState`, `EMPTY_FORM`, y los `addRouteEvent`/
    `updateRouteEvent` del andén. Se conserva `area` como ubicación del recorrido.
- **No** se eliminan `client_locations` ni `external_transfers`:
  - `external_transfers` tiene `/register/transfer` "en construcción" (feature
    planificada). Se documenta como "sin cablear aún", no obsoleta.
  - `client_locations` (0 filas): se documenta como candidata a revisión en el ADR de
    DataModel; no se borra en este lote.

### Criterio de aceptación
- `route_events` ya no tiene `floor`/`dock`; el form sigue guardando la ubicación en
  `area` sin regresiones.
- El ADR de DataModel documenta el estado de las tablas sin cablear.

---

## Documentación del vault (al cerrar)

- `logs/2026-06-10-recorrido-fotos-persistencia-traza.md` — log del lote.
- Actualizar `decisions/2026-05-21-estado-envase-derivado.md`: aclarar que el próximo
  paso de escala es la **vista de Postgres** (modelo B), no la columna cacheada;
  reafirmar eventos como fuente de verdad.
- Actualizar `DataModel.md`: `containers.created_by`; `photos.role`; baja de
  `route_events.floor`/`dock`; estado de `storage_events`/`container_locations`
  (ahora persistidas) y de `client_locations`/`external_transfers` (sin cablear).
- Actualizar `vault/_index.md`.

## Orden de implementación sugerido

1. Grupo 1 (backbone: persistencia + hidratación) — desbloquea tratamiento y kg/día.
2. Grupo 3 (anti doble-submit) — cambio pequeño y aislado.
3. Grupo 4 (traza `created_by`).
4. Grupo 5 (limpieza de schema).
5. Grupo 2 (rediseño de fotos) — el más amplio en UI; se apoya en `photos.role`.

## Pruebas

- Unit: `computeDailyKg` con `treatmentRuns` hidratados; agrupación de fotos por
  `role` en el mapeo del hydrator; `canSaveAnden` con combinaciones de fotos
  sucias/limpias existentes y nuevas.
- Manual E2E: flujo cross-device (pesar en A, ver tratamiento en B); doble-tap en
  guardar andén; editar andén y verificar fotos visibles; crear tacho y ver
  "registrado por".
