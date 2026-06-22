# Resiliencia offline — Outbox de campo (local-first) — Design

**Fecha:** 2026-06-19
**Estado:** Aprobado (diseño) — pendiente plan de implementación
**Contexto:** En ciertos sitios los teléfonos pierden conexión y las subidas no se completan,
bloqueando al operador a mitad de un recorrido o pesaje. Esta spec ("Situación 2" del lote previo
al merge) hace que la app **avance sin conexión** y **sincronice la cola** al recuperar señal, sin
necesidad de migrar a una APK. Es la spec hermana de
`2026-06-19-login-tarjetas-auto-logout-operador-design.md` (Situación 1, ya implementada).

---

## Objetivos

1. **No bloquear nunca al operador por falta de red.** Cada registro de campo se guarda primero en
   el dispositivo y la app avanza al instante.
2. **Sincronizar automáticamente** la cola pendiente al recuperar conexión, atribuyendo cada
   registro a su operador.
3. **Sin pérdida silenciosa ni duplicados** al reintentar.

No-objetivos (fuera de alcance):
- Offline para escrituras de **admin/coordinador** (tachos, clientes, empresas, traslado externo):
  se hacen en oficina con señal → siguen online-only, sin cambios.
- Resolución de conflictos multi-dispositivo / edición concurrente: cada registro de campo es una
  creación nueva con id propio; no hay edición concurrente del mismo registro offline.
- Gestión avanzada de cuota de almacenamiento (el volumen esperado es de decenas de fotos).
- Pantalla dedicada de gestión de cola (basta el indicador de pendientes).

---

## Decisiones tomadas (brainstorming)

| Tema | Decisión |
|------|----------|
| Modelo | **Local-first siempre**: guardar local y sincronizar en segundo plano (no "encolar solo al fallar") |
| Fallo no-red (servidor rechaza) | **Reintentar indefinidamente**; pero una operación atascada **no bloquea** a las independientes |
| Cola vs sesión | La cola es **del dispositivo**; sincroniza con cualquier sesión activa; cada registro lleva su `operator_id`. Si no hay sesión, drena en el próximo login |
| Volumen de fotos | Decenas (~50) en el peor caso → sin gestión agresiva de cuota |
| Arquitectura | **Outbox acotado a flujos de campo** (no cola genérica, no librería de sync) |

---

## Estado actual relevante

- **Escritura "servidor primero":** los handlers de campo insertan en Supabase para obtener el `id`
  real y recién entonces suben fotos y actualizan la pantalla. Ej.
  `src/app/register/weighing/page.tsx:234` (`createReception` → `receptionId = row.id` →
  `persistWeighingPhotos` → `addReception`). Sin red, el primer `await` falla y todo se detiene.
- **Andamiaje offline inerte:** `src/lib/offline-queue.ts` (cola IndexedDB: `enqueue`,
  `dequeueAll`, `clearAll`, `getQueueCount`), `src/hooks/use-offline-sync.ts` (escucha
  `online`/`offline` pero su `sync()` solo limpia la cola con un `console.log("mock mode")`) y
  `src/components/layout/sync-indicator.tsx` (contador de pendientes). Ningún flujo real usa
  `enqueue`.
- **Fotos:** `src/lib/data/photos.ts` (`uploadEventPhotos`, best-effort) sube data URLs a Storage
  vía `q.uploadPhotoFromDataUrl` y registra en `public.photos`. Hay `src/lib/photo-watermark.ts`.
- **Sesiones de trabajo en curso** ya persisten en IndexedDB (`src/lib/active-session.ts`),
  independientes de la red.
- **Hidratación:** `src/components/supabase-hydrator.tsx` **sobrescribe** el store con datos de
  Supabase al montar, al enfocar y al volver `online` (`useStore.getState().hydrate({...})`).
- IDs de las tablas son `uuid` con default; los tipos `TablesInsert<...>` permiten pasar `id`.

---

## Diseño

### 1. IDs generados en el cliente

Los flujos de campo generan `crypto.randomUUID()` para el `id` antes de escribir, en vez de leerlo
de la respuesta del insert. Aplica a: `weighing_sessions`, `container_receptions`, `route_events`,
`photos`, y los derivados del pesaje (`treatment_runs`, `container_locations`, `storage_events`).
El id estable es la base de la **idempotencia** (reenviar usa el mismo id → upsert, no duplica).

### 2. Outbox en IndexedDB

Extender `offline-queue.ts` (misma DB `hospiwaste-offline`):

- **Store `outbox`** — operaciones encoladas:
  ```ts
  interface OutboxOp {
    op_id: string            // uuid de la operación
    type: OutboxOpType
    payload: Record<string, unknown>  // ya con el id de cliente del registro
    deps: string[]           // op_ids que deben completarse antes
    created_at: string
    attempts: number
  }
  type OutboxOpType =
    | 'create_route_event' | 'add_route_containers'
    | 'create_weighing_session' | 'create_reception'
    | 'create_treatment_run' | 'create_container_location' | 'create_storage_event'
    | 'upload_photo'
  ```
- **Store `photo_blobs`** — `{ photo_id, blob, content_type }`. La operación `upload_photo` referencia
  `photo_id`; el blob se guarda aparte para no inflar la operación y para subirlo en streaming. Las
  fotos se convierten de data URL a Blob al encolar (opcionalmente recomprimidas; reusar
  `photo-watermark.ts` si aplica).

Helpers: `enqueueOp(op)`, `listOps()` (orden FIFO por `created_at`), `removeOp(op_id)`,
`bumpAttempts(op_id)`, `putPhotoBlob`, `getPhotoBlob`, `removePhotoBlob`, `countPendingOps()`.

### 3. Escritura local-first

Refactor de los handlers de campo (pesaje: `handleCreateReception`, cierre de sesión y derivados;
recorrido andén `…/anden/[slot]/page.tsx` y morgue `…/morgue/page.tsx`):

1. Generar uuid(s) de cliente.
2. Escribir al store Zustand inmediatamente (ya se hace con `addReception`, etc.) — la pantalla
   avanza sin esperar la red.
3. **Encolar** la(s) operación(es) con sus `deps` en vez de `await`-ear la query de red.
4. Convertir las fotos a Blob y encolar `upload_photo` (dep = evento padre).

El `uploadEventPhotos` actual (online directo) se reemplaza por el encolado; la URL para mostrar al
instante se deriva localmente del data URL/Blob (object URL) hasta que el hydrator traiga la firmada.

### 4. Motor de sincronización

Reescribir `use-offline-sync.ts` (`sync()` real) + un módulo puro `outbox-sync.ts` con la lógica
drenable y testeable:

- **Disparadores:** evento `online`, foco de la pestaña (`visibilitychange`), intervalo, y tras
  cada `enqueueOp` si hay conexión. Requiere cliente Supabase autenticado.
- **Drenado por dependencias:** recorre las operaciones cuyo `deps` ya está satisfecho (todas sus
  deps removidas de la cola) y las ejecuta. Una operación **atascada no bloquea** a las
  independientes; solo esperan las que dependen de ella.
- **Mapeo op → query:** cada `type` llama a su función existente en `src/lib/supabase/queries/*`,
  pero en modo **upsert idempotente** (`onConflict: 'id'`). `upload_photo` sube el Blob a una ruta
  de Storage determinística por `photo_id` (overwrite-safe) y hace upsert de la fila `public.photos`.
- **Resultado:**
  - Éxito → `removeOp` (+ `removePhotoBlob` si aplica).
  - Error de **red** (offline / fetch falla) → dejar la operación, reintentar luego.
  - Rechazo **no-red** (4xx/validación/RLS) → `bumpAttempts` y reintentar indefinidamente; no
    bloquea otras. (El contador de pendientes que no baja es la señal de "algo atascado".)

### 5. Merge al hidratar (correctitud clave)

`supabase-hydrator.tsx` deja de **sobrescribir** ciego. Tras traer los datos del servidor, hace
**merge**: los registros locales cuyo id aún figura en el `outbox` (no sincronizados) se conservan
y se superponen a los del servidor. Así una recarga/refoco **no hace desaparecer** un pendiente.
Regla: para cada colección, `merged = serverRows ∪ {registros locales con op pendiente}` (el id de
cliente evita duplicar cuando el registro ya subió y aparece en el servidor).

### 6. UX / visibilidad

- Reutilizar `sync-indicator.tsx`: contador honesto de pendientes (`countPendingOps`) + estado
  offline. Textos: "Sin conexión · N en cola" / "N pendientes · sincronizando…".
- Cada pantalla de campo confirma "guardado" aunque sea offline (el registro ya está en el store).
- Sin pantalla de gestión de cola dedicada (acorde a "reintentar indefinidamente").

### 7. Alcance / límites

- Solo flujos de campo se vuelven local-first: **recorrido (andén + morgue), pesaje (sesión +
  recepción + derivados) y sus fotos**.
- Escrituras de admin/coordinador siguen **online** sin cambios. Offline, una acción de coordinador
  se comporta como hoy (falla/avisa) — aceptable: los coordinadores tienen señal.

### Componentes / unidades

| Unidad | Archivo | Responsabilidad |
|--------|---------|-----------------|
| Outbox store | `src/lib/offline-queue.ts` (extender) | persistencia IndexedDB de operaciones + blobs |
| Lógica de drenado | `src/lib/outbox-sync.ts` (nuevo, puro) | orden por dependencias, mapeo op→query, idempotencia |
| Hook de sync | `src/hooks/use-offline-sync.ts` (reescribir) | disparadores + invocar el drenado + exponer conteo |
| Indicador | `src/components/layout/sync-indicator.tsx` | mostrar estado/pendientes |
| Merge de hidratación | `src/components/supabase-hydrator.tsx` | unir server + pendientes locales |
| Handlers de campo | `register/weighing/page.tsx`, `register/route/anden/[slot]/page.tsx`, `register/route/morgue/page.tsx` | generar uuid + store + encolar |

---

## Manejo de errores

- **Red caída al escribir:** no se intenta; se encola. La app avanza.
- **Red caída a mitad del drenado:** la operación queda; se reintenta al próximo disparo.
- **Éxito parcial (insert ok, ack perdido):** el reintento con upsert sobre el mismo id es no-op
  idempotente.
- **Rechazo del servidor (validación/RLS):** reintento indefinido sin bloquear otras; visible como
  pendiente que no baja.
- **Foto que falla:** su `upload_photo` reintenta; el registro padre no depende de la foto para
  considerarse guardado.

## Pruebas

- **Unitarias (jest + fake-indexeddb):** `offline-queue` (enqueue/list/remove/deps/blobs);
  `outbox-sync` (orden por dependencias; idempotencia vía upsert; atascada-no-bloquea-independientes;
  red vs no-red); merge-al-hidratar (conserva pendientes, no duplica los ya subidos).
- **Integración ligera:** motor de sync con cliente Supabase simulado (mock de queries) verificando
  el orden de llamadas y el removeOp tras éxito.
- E2E manual: recorrido/pesaje en modo avión → registros guardados y visibles → recuperar red →
  la cola drena y el conteo llega a 0; verificar en Supabase que no hay duplicados.

## Riesgos / consideraciones

- **Object URLs locales vs URL firmada:** mientras la foto no suba, se muestra desde el Blob local;
  tras el sync, el hydrator trae la firmada. Liberar object URLs para no fugar memoria.
- **Cuota de IndexedDB:** baja prioridad (decenas de fotos), pero conviene un aviso si el navegador
  reporta cuota cercana al límite (best-effort, opcional).
- **Drenado sin sesión:** requiere una sesión autenticada por RLS; documentar que sin login la cola
  espera.
- **Orden de migración:** no requiere cambios de schema (los ids ya son uuid con default).

## Relacionado

- `2026-06-19-login-tarjetas-auto-logout-operador-design.md` — Situación 1 (cola es del dispositivo,
  sincroniza pese al auto-logout).
- `logs/2026-05-25-fotos-supabase-storage.md`, `logs/2026-05-25-recorridos-supabase-writethrough.md`
  — caminos de escritura actuales.
- `decisions/2026-06-01-roles-acceso.md` — RLS (las tablas operativas permiten escritura a
  `authenticated`).
