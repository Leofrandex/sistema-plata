---
title: Rediseño operativo — Recorridos, Pesaje, Reportes, Dashboard
tags:
  - log
  - feature
  - rediseño-operativo
date: 2026-05-17
---

# Rediseño operativo del sistema Hospiwaste

## Resumen

Plan de cambios en cinco fases secuenciales sobre la rama `feat/recorridos-pesaje-reportes-dashboard`. Spec/plan completo en `bubbly-wandering-lighthouse.md`. ADR de las decisiones de modelo: `decisions/2026-05-17-cliente-empresa-recorrido.md`.

## Fases

### Fase 1 — Modelo Cliente/Empresa + rename intercambio→recorrido (✅ completada)

Cambios estructurales sin nueva UX:

**Modelo (`src/lib/types.ts`):**
- Nueva entidad `Company` (Empresa) con `client_id`, `name`, `code_letter`.
- `Client` pierde `code_letter`.
- `Container` cambia `client_id` por `company_id`.
- `ExchangeEvent` → `RouteEvent` con campos nuevos: `slot`, `date`, `started_at`, `ended_at`, `status`, `floor`, `area`, `dock`, `photo_ids` ilimitadas.
- Nueva entidad `WeighingSession` que agrupa receptions por turno de pesaje.
- `ContainerReception` agrega `weighing_session_id` y pierde `batch_id`.
- `ContainerPhase.exchange` → `route`; `PhotoEventType.exchange` → `route`.
- Nuevo tipo `RouteSlot` con 6 valores fijos.
- **Eliminado** `Batch` y `BatchStatus`.

**Store y mock data:**
- `src/lib/store.ts` agrega state y mutaciones de `companies`, `routeEvents`, `weighingSessions`, `updateReception`. Elimina batches.
- `src/lib/mock-data.ts` reescrito con `Centro de la Salud` (1 cliente) → `ION` (I, 10 envases) + `Airkem` (A, 10 envases). 2 recorridos completados hoy y 1 sesión de pesaje con 2 receptions.
- `src/lib/constants.ts` agrega `ROUTE_SLOTS` y `getRouteSlotDefinition`.

**UI:**
- Sidebar: nueva entrada "Reportes" + "Recorrido" (reemplaza "Intercambio") + nueva sub-entrada admin "Empresas".
- `/admin/clients` muestra empresas hijas con sus contadores. Nueva ruta `/admin/companies`.
- `/admin/containers` y forms en cascada Cliente → Empresa.
- `ContainerSelector` ahora muestra empresa, no cliente.
- `ContainerTable` agrega columna Empresa.
- `ContainerLifeline` y `PhasePhotoGallery` usan `route` en vez de `exchange`.
- `/dashboard` simplificado (placeholder hasta Fase 5).
- `/register/route` placeholder de Fase 2.
- `/register/weighing`, `/register/transfer`, `/register/treatment`, `/register/location` ajustados al modelo nuevo (sin `batch_id`, usan `company_id` de Container).

**Eliminados:**
- `src/app/batches/` (toda la subruta)
- `src/components/batches/` (toda la carpeta)
- `src/components/dashboard/batch-card.tsx`, `batch-status-toggle.tsx`, `completed-batches-filters.tsx`
- `src/components/reports/batch-report-document.tsx`, `report-preview.tsx` (se rehacen en Fase 4)
- `src/lib/data/batches.ts`
- `src/__tests__/lib/batches.test.ts`
- `src/app/register/exchange/page.tsx`

**Tests actualizados:**
- `containers.test.ts` — usa `route` en vez de `exchange`, agrega tests para `getRouteEventIdsForContainer`.
- `container-lifeline.test.tsx` — usa `route`.
- `phase-metrics.test.tsx` — sin `batch_id` en receptions/storage.
- `metrics-cards.test.tsx` — usa `MOCK_ROUTE_EVENTS` y nueva signature de `computeDashboardMetrics`.
- `types.test.ts` — Container con `company_id`, agregado test de Company.
- `container-selector.test.tsx` — Container con `company_id`.

**Verificación Fase 1:**
- `npm run build` ✅ (16 rutas generadas)
- `npm test` (vitest) ✅ 12 tests passed
- `npm run test:jest` ✅ 38/40 tests passed (los 2 fallidos son pre-existentes: `button.test.tsx` y `input-field.test.tsx` usan `vi.fn()` de vitest en archivos de jest)

### Fase 2 — Recorridos con cronómetro persistente (✅ completada)

**Building blocks:**
- `src/lib/active-session.ts` — módulo IndexedDB reutilizando `hospiwaste-offline` DB (versión bumped a 2) con nuevo store `active_sessions`. Keys compuestas: `route:{date}:{slot}` y `weighing:{date}`. API: `startSession`, `getActiveSession`, `endSession`, `listActiveSessions`. Helper `todayLocal()` para fecha local en `YYYY-MM-DD`.
- `src/hooks/use-elapsed.ts` — hook que devuelve segundos transcurridos desde `started_at`, actualizándose cada segundo con `setInterval`. Helper `formatElapsed(seconds)` para `HH:MM:SS` / `MM:SS`.

**Componentes:**
- `src/components/register/photo-capture-multi.tsx` — grid de fotos con "+ Agregar" siempre visible. Cada foto tiene botón eliminar.
- `src/components/register/route-form.tsx` — formulario completo: ContainerSelector multi-select acumulativo + inputs piso/área/andén + `PhotoCaptureMulti`. Prop `locked` aplica `opacity-50 pointer-events-none`.
- `src/components/register/route-slot-card.tsx` — card individual de slot con tres estados visuales: `available` (clickable, decoración accent), `in_progress` (cronómetro live), `completed` (gris, no clickable, muestra hora de cierre).

**Páginas:**
- `src/app/register/route/page.tsx` — lista de los 6 slots. Lee `routeEvents` del store y `listActiveSessions('route')` de IndexedDB para calcular el estado de cada slot.
- `src/app/register/route/[slot]/page.tsx` — pantalla individual:
  - Hidrata desde IndexedDB al montar (recupera el cronómetro si la app se cerró)
  - Si el slot ya está completado hoy: vista read-only con resumen
  - Si está en curso: banner con cronómetro + botón "Finalizar" (deshabilitado si no hay envases o fotos)
  - Si está disponible: form atenuado + botón "Iniciar recorrido"
  - Modal de confirmación al finalizar (recuento de envases, fotos, duración)
  - Mutaciones incrementales al store mientras se edita (no hay draft separado)
- Confirmación implementada con un dialog inline minimalista (sin agregar dependencia de modal).

**Decisiones técnicas:**
- Las fotos como dataURLs viven solo durante la sesión activa en el state del componente. Al finalizar se persisten al store como `Photo[]`. Si el operador cierra la app a mitad del recorrido, las fotos se pierden pero el cronómetro, ubicación y envases seleccionados se mantienen (porque esos sí se persisten incrementalmente al store).
- `RouteEvent.date` se setea al iniciar y NO se recalcula al finalizar — resuelve el caso de un recorrido nocturno que cruza medianoche.
- Slot completado bloquea re-inicio el mismo día calendario.

**Verificación Fase 2:**
- `npm run build` ✅ (17 rutas, incluida `/register/route/[slot]` dinámica)
- `vitest` 12/12 ✅
### Fase 3 — Pesaje dinámico multi-registro (✅ completada)

**Componentes:**
- `src/components/register/weighing-form.tsx` — formulario por envase con:
  - Dropdown tipo de desecho (5 valores)
  - Select de envase (filtrado por `waste_type` seleccionado)
  - Dos `PhotoCapture` (envase + balanza)
  - Input peso bruto con validación (debe superar la tara) y vista del peso neto estimado
  - Modos `create` ("Guardar y agregar otro") y `edit` ("Guardar cambios" / "Cancelar" / "Eliminar")
- `src/components/register/weighing-session-drawer.tsx` — drawer lateral derecho:
  - Tab flotante con contador, fixed al borde, visible cuando hay registros
  - Backdrop al abrir; cierre con click fuera o tecla Escape
  - Lista de receptions ordenada cronológicamente; click selecciona para edición

**Página `/register/weighing` reescrita:**
- Vista inicial: form bloqueado (opacity-50 + pointer-events-none) + botón "Iniciar pesaje"
- Tras iniciar:
  - Crea `WeighingSession { status: 'in_progress' }` en store
  - Persiste `ActiveSession` en IndexedDB con key `weighing:{today}`
  - Cronómetro arriba (HH:MM:SS)
- Flujo dinámico:
  - "Guardar y agregar otro" persiste el reception + 2 photos al store, lo agrega a la sesión y resetea el form
  - Click en un registro del drawer carga el reception al form en modo `edit`; oculta "Agregar otro" y muestra banner ámbar "Editando…"
  - "Eliminar" en modo edit remueve el reception de la sesión (soft, queda en store huérfano)
- Finalización:
  - Dialog de confirmación inline (recuento + duración)
  - Marca la sesión como completed, crea un `StorageEvent` + `ContainerLocation` (cámara fría) por cada reception, borra la ActiveSession
  - Navega a `/dashboard`

**Decisiones técnicas:**
- Si el operador cierra la app a mitad de la sesión, todos los receptions ya guardados sobreviven (están en store) y el cronómetro se recupera de IndexedDB.
- Las fotos del form en edición se cargan desde el store (sus dataURLs persistidos), no como blob URLs nuevos.
- Estrategia de fotos al editar: se crean nuevas Photo records con IDs nuevos (las viejas quedan huérfanas en el store) — simplificación aceptable para el MVP.
- El select de envase se filtra por tipo de desecho activo: evita pesar un envase del tipo equivocado.

**Verificación Fase 3:**
- `npm run build` ✅ (17 rutas)
- `vitest` 12/12 ✅
### Fase 4 — Sección de reportes semanales (✅ completada)

**Data layer (`src/lib/data/reports.ts`):**
- `getMondayOfWeek(reference)` — devuelve lunes 00:00 local de la semana que contiene la fecha de referencia. Maneja correctamente domingo (retrocede 6 días).
- `isoDate(date)` — formatea Date como `YYYY-MM-DD` local.
- `buildPhotographicReportData(clientId, store, endOverride?)` — función pura que devuelve la estructura del reporte:
  - Encuentra empresas del cliente
  - Toma containers de esas empresas
  - Filtra RouteEvents por client_id, rango temporal y containers que tocan empresas del cliente
  - Filtra receptions por containers del cliente y rango temporal
  - Resuelve photos y agrega comentarios contextuales (envase, hora, peso neto, ubicación)
  - Agrupa: por etapa (recorrido → pesaje) y dentro de cada etapa por empresa (orden alfabético)
  - Casos especiales: si un RouteEvent toca varias empresas, sus fotos se replican en cada grupo (no podemos saber a qué envase específico corresponde cada foto).

**PDF (`src/components/reports/photographic-report-document.tsx`):**
- Replica el layout de los reportes históricos (screenshots):
  - **Portada**: título grande "REGISTRO FOTOGRÁFICO", cliente, rango de semana, caja con métricas (recorridos, envases pesados, total fotos, fecha de generación).
  - **Páginas de contenido**: orientación landscape (4 fotos por fila × 2 = 8 fotos por página… ajustado a 2 col × 3 filas = 6 por página para dejar espacio a las cajas de comentario).
  - Header por página (fixed) con un placeholder de logo de empresa (badge negro con letra grande + nombre debajo), título "REGISTRO FOTOGRÁFICO" centrado, y tabla a la derecha con `Edificio | Ubicación | Fecha`.
  - Cada celda de foto incluye una caja "Comentario:" con texto contextual.
  - Páginas se agrupan por etapa primero, luego por empresa.
  - Si no hay registros, página de cierre con nota.

**Preview & página (`/reports`):**
- `report-preview.tsx` — Card con métricas, desglose por empresa, y `PDFDownloadLink` (cargado dinámicamente con SSR off). Filename: `Hospiwaste_RegistroFotografico_{Cliente}_{weekStart}_{weekEnd}.pdf`. Spinner durante generación.
- `app/reports/page.tsx` — selector de cliente + banner de rango calculado automáticamente (lunes → hoy) + ReportPreview.

**Decisiones:**
- Logos de empresa: en lugar de imágenes externas, se renderiza un "badge" de texto con la letra y el nombre — funciona offline, sin assets adicionales, y mantiene la estética de cabecera. Cuando el cliente provea logos reales, basta con reemplazar el componente `CompanyBadge`.
- Orientación landscape elegida por permitir grids de fotos más amplios y por imitar mejor las screenshots de referencia.
- "Edificio" en la tabla del header queda como `—` por ahora (el dato no se captura en el flujo); "Ubicación" muestra el nombre de la etapa (Recorridos / Pesajes).

**Tests:**
- `src/__tests__/lib/reports.test.ts` — 8 tests cubriendo `getMondayOfWeek` con varios días de la semana y `buildPhotographicReportData` con casos: cliente inexistente, reporte popular, agrupación por empresa correcta, rango sin datos.

**Verificación Fase 4:**
- `npm run build` ✅ (18 rutas incluyendo `/reports`)
- `npm test:jest` ✅ 46/48 (8 nuevos pasan; los 2 fallidos siguen siendo pre-existentes button/input-field)
### Fase 5 — Dashboard rediseñado con Recharts (pendiente)

## Decisiones técnicas (Fase 1)

- **Persistencia del cronómetro** (para fases 2-3): IndexedDB con `started_at`; recálculo del elapsed al volver. Sin background workers. Se reutiliza el patrón de `src/lib/offline-queue.ts` (mismo `openDB`).
- **Slots compartidos por el equipo**: solo un `RouteEvent` por `(slot, fecha)`. Cualquier operador puede iniciar/finalizar.
- **`ExternalTransfer` no se renombra**: es traslado externo (tipos 2-5), distinto de un recorrido.
- **Eliminación de Batch**: las unidades operativas son ahora RouteEvent y WeighingSession. Los reportes consultan por cliente + rango de semana directamente.
- **Logos de empresa** (para Fase 4): placeholders en `public/logos/ion.png` y `airkem.png` hasta que el cliente los provea oficiales.
