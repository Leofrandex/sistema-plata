# Historial editable de recorridos y pesajes — Diseño

**Fecha:** 2026-06-17
**Estado:** Aprobado para implementación
**Relacionado:** `decisions/2026-05-21-estado-envase-derivado.md` (anulación lógica), `decisions/2026-06-01-roles-acceso.md` (roles), `logs/2026-06-03-deshacer-pesaje-vista-pendientes.md` (patrón soft-delete existente)

## Objetivo

Permitir, desde la app, **consultar el historial** de recorridos y de pesajes ya registrados, **editar ciertos campos** y **anular registros**, con confirmación en cada acción. Hoy estas correcciones solo se pueden hacer con SQL directo a Supabase, lo que no es viable en operación (ver ADR de estado derivado).

## Decisiones de diseño (acordadas en brainstorming)

1. **"Eliminar" = anulación lógica (soft-delete)**, nunca borrado físico. Mantiene la trazabilidad regulatoria, coherente con el ADR de estado derivado y con el "deshacer pesaje" ya existente (`voidReception`). El registro anulado deja de contar en dashboard, derivación de fase y reportes, pero la fila se conserva con motivo.
2. **Acceso por rol:** el historial es **visible para todos** (operador y coordinador, solo lectura). Los controles de **editar** y **anular** se renderizan **solo para `coordinator`**, reforzado por middleware/RLS como el resto de secciones de coordinador.
3. **Ubicación en la UI:** un **apartado dentro de cada pantalla de registro**, no una sección nueva. Se implementa con un control de **pestañas "Registrar" / "Historial"** en `/register/route` y `/register/weighing`. "Registrar" es la vista por defecto (flujo actual intacto); "Historial" muestra la lista + detalle editable.
4. **Granularidad:**
   - **Recorrido** = un `route_event` (un andén o la morgue). Unidad que se lista, edita y anula.
   - **Pesaje** = la lista muestra **sesiones** (`weighing_sessions`), y al abrir una se ven sus **recepciones** individuales. La edición y la anulación operan a nivel **recepción** (los campos editables son por recepción). También se puede anular la **sesión completa** (que anula todas sus recepciones no anuladas).

## Campos editables (solo coordinador)

| Entidad | Campos editables |
|---|---|
| Recorrido (`route_event`) | empresa (`company_id`), ubicación/área del andén (`area`), tachos limpios entregados (`containers_clean_delivered`), tachos sucios recibidos (`containers_dirty_received`) |
| Pesaje (`container_reception`) | peso bruto (`gross_weight_kg`), tipo de desecho (`waste_type`), tacho (`container_id`) |

> La **empresa del pesaje** NO es editable aquí: se corrige en el recorrido, que es su origen canónico (la empresa se hereda del recorrido al pesar; ver `decisions/2026-06-10-empresa-por-registro.md`).

## Rediseño de los 4 estados del dashboard (gráfico "Tachos en circulación")

Junto con el historial se redefine la semántica de los 4 buckets, pasando a un modelo **basado en línea de tiempo donde gana el último evento del tacho**. Cierra el ciclo completo:

**En planta (limpio)** → _recorrido entrega limpio_ → **En cliente** → _recorrido recoge sucio_ → **Pendiente por pesar** → _pesaje_ → **Pendiente por tratar** → _tratamiento_ → **En planta** otra vez.

| Bucket (key interno) | Label | Color | Condición (último evento vigente del tacho) |
|---|---|---|---|
| `en_planta` | **En planta** | `#94A3B8` (slate) | Limpio físicamente en planta: **recién dado de alta** (sin eventos) o **tratamiento/traslado completado**, aún sin entregar a cliente |
| `en_cliente` | **En cliente** | `#10B981` (emerald) | Último evento de recorrido = **entregado limpio** (`containers_clean_delivered`), sin recogida sucia posterior |
| `pendiente_pesar` | **Pendiente por pesar** | `#F59E0B` (amber) | **Recogido sucio** (`containers_dirty_received`) sin recepción vigente posterior |
| `pendiente_tratar` | **Pendiente por tratar** | `#2A27E9` (accent) | **Pesado** (recepción vigente), esperando tratamiento |

Cambios respecto al modelo anterior:
- "En cliente" deja de derivarse de `container_locations` (`client_site`) y pasa a derivarse de **`containers_clean_delivered`** del recorrido más reciente.
- "En planta" ya **no** significa "pesado": ahora es el estado de tacho limpio disponible en planta (absorbe el viejo "Sin registro"). El bucket `sin_registro` desaparece.
- El viejo "En planta" (pesado/cámara fría) se renombra a **"Pendiente por tratar"**.

### Derivación por línea de tiempo

Para cada tacho `active` y no-Yaris, se determina el bucket comparando el **timestamp del evento vigente más reciente** entre:
- `clean_delivered`: `started_at` del recorrido más reciente que lo entregó limpio (no anulado).
- `dirty_received`: `started_at` del recorrido más reciente que lo recogió sucio (no anulado).
- `reception`: `arrived_at` de la recepción vigente (no anulada) más reciente.
- `treatment`/`transfer`: `completed_at`/`transferred_at` más reciente.

Mapeo del evento ganador → bucket:
- `clean_delivered` es el más reciente → `en_cliente`.
- `dirty_received` es el más reciente → `pendiente_pesar`.
- `reception` es el más reciente → `pendiente_tratar`.
- `treatment`/`transfer` completado es el más reciente, o **no hay ningún evento** → `en_planta`.

> Nota de consistencia: "Pendiente por pesar" debe seguir coincidiendo con `getPendingWeighingContainerIds` (cola del pesador). En el modelo de línea de tiempo, un tacho está pendiente de pesar exactamente cuando su último evento es `dirty_received` (sin recepción vigente posterior), que es la misma condición.

Se implementa en una función nueva y testeable `computeCirculationBucket(...)` en `src/lib/data/dashboard-metrics.ts`, que reemplaza el `switch` sobre `computeContainerPhase` dentro de `computeCirculationBreakdown`. `computeContainerPhase` se conserva para otros usos (inventario de tachos), filtrando recorridos anulados.

## Arquitectura

Sigue el patrón de capas existente: **queries (Supabase) → acciones de store (write-through + refresco local) → componentes**.

### 1. Migración de base de datos

Nueva migración `supabase/migrations/<ts>_soft_delete_route_events_weighing_sessions.sql`:

- Agregar a `route_events` y a `weighing_sessions`:
  - `voided_at timestamptz`
  - `voided_by uuid references public.profiles(id)`
  - `void_reason text`
- `comment on column` explicando la semántica (espejo del comentario ya presente en `container_receptions.voided_at`).
- Recrear la vista `v_containers_pending_weighing` (y cualquier otra que escanee `route_events`) para filtrar `route_events.voided_at is null`. **Las recepciones ya filtran su propio `voided_at`.**

Razón de columnas dedicadas en vez de un valor `'voided'` en el enum `status`: conserva el **motivo** y separa "estado operativo" (in_progress/completed) de "anulado". Idéntico a `container_receptions`.

### 2. Queries (`src/lib/supabase/queries/`)

- **route-events.ts:**
  - `voidRouteEvent(db, id, voidedBy, reason)` — set `voided_at/by/reason`. (Reemplaza el uso de `deleteRouteEvent` para anulación; `deleteRouteEvent` queda solo para limpieza interna/cancelación de sesión activa.)
  - `listRouteEvents` y derivados: agregar filtro `.is('voided_at', null)` por defecto, con opción para incluir anulados en la vista de historial.
  - `updateRouteEvent` ya existe (empresa, área); `setRouteContainersDirty/Clean` ya existen (tachos).
- **weighing.ts:**
  - `voidWeighingSession(db, id, voidedBy, reason)` — set `voided_*` en la sesión y anular en cascada sus recepciones no anuladas (`voidReception` por cada una, o un `update ... where weighing_session_id = id and voided_at is null`).
  - `voidReception` ya existe; `updateReception` ya existe (peso, tipo, tacho).
  - Listados: filtrar `voided_at is null` salvo en la vista de historial.

### 3. Derivación de fase (correctitud crítica)

Filtrar registros anulados en **toda** la derivación, para que anular reordene los colores del dashboard automáticamente:

- `getPendingWeighingContainerIds` y `computeCirculationBreakdown` (`src/lib/data/containers.ts`, `src/lib/data/dashboard-metrics.ts`): al construir los IDs de recorrido de un tacho, **ignorar `route_events` con `voided_at != null`** (hoy solo se ignoran las recepciones anuladas). Helper afectado: `getRouteEventIdsForContainer` / `getRouteEventIdsAnyDirection`.
- Reportes (`src/lib/data/reports.ts`): excluir recorridos y recepciones anulados.

Efectos esperados: anular un **recorrido** de recogida sucia saca al tacho de "Pendiente por pesar"; anular un **recorrido** de entrega limpia lo saca de "En cliente"; anular un **pesaje** devuelve el tacho de "Pendiente por tratar" a "Pendiente por pesar".

### 4. Acciones de store (`src/lib/store.ts`)

Agregar/usar acciones con write-through (mismo patrón que `handleVoidEditing` en pesaje): `voidRouteEvent`, `voidWeighingSession`, y reuso de `updateRouteEvent`, `updateReception`, set de tachos limpios/sucios. Cada acción persiste a Supabase primero y luego refleja el cambio (incluido `voided_*`) en el store local.

### 5. UI

**Componentes nuevos:**
- `RegisterTabs` (o reuso del patrón `tabs` de `src/components/ui/tabs.tsx`): envuelve cada pantalla de registro con pestañas "Registrar" / "Historial".
- `RouteHistory` — lista de `route_events` (fecha, horario/morgue, empresa, nº limpios/sucios, badge "anulado"), con filtro de rango de fechas (default semana, como reportes). Al abrir un registro: detalle con edición de campos (coordinador) y botón "Anular recorrido".
- `WeighingHistory` — lista de sesiones (fecha, horario, nº tachos, kg total, badge "anulado"); al abrir, lista de recepciones con edición por recepción (peso/tipo/tacho), "Anular pesaje" por recepción y "Anular sesión".
- Diálogos: reutilizar el patrón de `ConfirmVoidDialog` (`src/app/register/weighing/page.tsx`) — confirmación + **motivo obligatorio** para anular; diálogo de confirmación simple para guardar ediciones.

**Gating:** los controles de edición/anulación se renderizan solo si `useStore(s => s.currentRole) === 'coordinator'`. La pestaña "Historial" es visible para todos.

**Navegación:** sin entradas nuevas en sidebar/bottom-nav; el historial vive dentro de "Recorrido" y "Pesaje".

### 6. Confirmaciones (requisito explícito)

- **Editar** un campo → diálogo de confirmación antes de persistir.
- **Anular** (recorrido / pesaje / sesión) → diálogo de confirmación con **motivo obligatorio** (textarea, igual que "deshacer pesaje").

## Testing

- **Derivación:** `computeCirculationBreakdown` y `getPendingWeighingContainerIds` ignoran `route_events` anulados (un tacho con recorrido anulado no aparece como pendiente; un tacho con pesaje anulado vuelve a pendiente). Extender `src/__tests__/lib/containers.test.ts` y `dashboard-metrics.test.ts`.
- **Reportes:** excluir recorridos/recepciones anulados (`reports.test.ts`).
- **Queries:** `voidRouteEvent`/`voidWeighingSession` setean `voided_*` y filtran en listados.
- **Componentes:** la pestaña Historial es visible para operador pero los controles de editar/anular no; el diálogo de anulación exige motivo no vacío.

## Fuera de alcance (YAGNI)

- Edición de fotos del historial (las fotos siguen su flujo actual).
- Edición de empresa en el pesaje (se corrige en el recorrido).
- "Des-anular" (restaurar) un registro anulado — no pedido; si se necesita, es un follow-up.
- Paginación/virtualización del historial (volumen del piloto es bajo; el filtro por fecha basta).

## Riesgos / notas

- **Doble fuente de verdad:** mantener eventos como fuente de verdad. El soft-delete NO debe escribirse "a mano" saltándose el filtro en derivación; el requisito crítico es que *todas* las queries de derivación/reporte filtren `voided_at is null`.
- **Cascada de anulación de sesión:** anular una sesión debe anular sus recepciones; verificar que no queden recepciones "vivas" colgando de una sesión anulada (inconsistencia que el dashboard interpretaría mal).
