---
title: Offline — outbox de campo (local-first)
tags:
  - log
  - offline
  - pwa
  - supabase
updated: 2026-06-19
---

> [!info] Reemplazado (2026-07-23)
> Este outbox de IndexedDB fue reemplazado por el motor SQLite local-first (backend dual
> IndexedDB/SQLite detrás del contrato `LocalStore`). Ver `logs/2026-07-23-offline-sqlite-local-first.md`.

# Log 2026-06-19 — Resiliencia offline: outbox de campo

## Contexto

En ciertos sitios los teléfonos pierden conexión y las subidas no se completaban, bloqueando al
operador a mitad de un recorrido o pesaje. El flujo era "servidor primero" (insertar en Supabase
para obtener el `id` y recién entonces subir fotos y avanzar). Esta entrega ("Situación 2") vuelve
los flujos de campo **local-first**: guardan en el dispositivo, la app avanza al instante, y una
cola sincroniza al recuperar señal. Sin migrar a APK.

Spec: `docs/superpowers/specs/2026-06-19-offline-outbox-campo-design.md`.
Planes: `docs/superpowers/plans/2026-06-19-offline-outbox-A-infraestructura.md` y
`…-B-integracion.md`.

## Qué se hizo

### Plan A — Motor de sincronización (infraestructura)
- **`src/lib/idb.ts`**: apertura centralizada de la base IndexedDB `hospiwaste-offline` (v3),
  unificando un conflicto de versiones previo entre `offline-queue` (v1) y `active-session` (v2).
  Crea los stores `queue` (legacy), `active_sessions`, `outbox` y `photo_blobs`.
- **`src/lib/offline-queue.ts`**: store `outbox` (operaciones `OutboxOp`) + `photo_blobs` (blobs de
  foto) con helpers (`enqueueOp`, `listOps`, `removeOp`, `bumpAttempts`, `countPendingOps`,
  `putPhotoBlob`/`getPhotoBlob`/`removePhotoBlob`).
- **`src/lib/outbox-sync.ts`**: `applyOp` aplica una operación con **upsert idempotente** por `id`
  (fotos a ruta de Storage determinística `{event_type}/{event_id}/{photo_id}.{ext}` con
  `upsert:true`); `isNetworkError` clasifica red vs rechazo; `drainOutbox` drena por
  **dependencias** (una atascada no bloquea a las independientes; reintento indefinido entre
  llamadas, sin loop infinito gracias a un set de atascadas por-invocación).
- **`src/hooks/use-offline-sync.ts`**: drena la cola al volver online, al enfocar, por intervalo
  (30 s) y al recibir `hospiwaste:outbox-changed`; expone el conteo de pendientes. Indicador
  (`sync-indicator.tsx`) con texto honesto.

### Plan B — Cableado local-first (integración)
- **`src/lib/data/photos.ts`** → `enqueueEventPhotos`: convierte data URLs a Blob, los guarda en
  `photo_blobs` y encola una op `upload_photo` por foto (dep = evento padre). Devuelve `Photo` con
  object URL local para mostrar al instante. (`uploadEventPhotos` original se conserva para flujos
  no-campo.)
- **`src/lib/data/field-writes.ts`**: funciones que generan ids de cliente, encolan las
  **creaciones** con `op_id` prefijado y dependencias (`ws:`/`rec:`/`re:`/`rc:…:dirty|clean`/`tr:`/
  `se:`/`cl:`), y emiten `hospiwaste:outbox-changed`.
- **`src/lib/data/hydrate-merge.ts`** + hydrator: `mergeById` conserva los registros locales que
  aún están en el outbox, de modo que una recarga **no borra** un pendiente no sincronizado (sin
  duplicar los que ya subieron).
- **Handlers de campo** cableados: pesaje (`handleStart`, `handleCreateReception`, derivados de
  `handleFinish`), recorrido andén (`handleCreateAnden`, `handleFinish`), recorrido morgue
  (`handleStart`, `handleFinish`). Todos generan uuid de cliente, encolan y reflejan en el store
  con el **mismo id** (clave para el merge).

## Decisiones

- **Local-first siempre** (no "encolar solo al fallar").
- **Reintento indefinido** ante rechazo no-red; sin bloquear independientes.
- **La cola es del dispositivo**: sincroniza con cualquier sesión autenticada activa (cada registro
  lleva su `operator_id`); si no hay sesión, drena en el próximo login.
- **Idempotencia por id de cliente** (upsert) → reintentos no duplican.
- **Alcance = CREACIÓN.** Edición, cancelación, anulación y borrado siguen **online** (ocurren al
  revisar, con señal). Ver [[2026-06-19-login-tarjetas-auto-logout-operador]] (la cola sobrevive al
  auto-logout del operador).

## Verificación

- `jest`: suites de `offline-queue`, `outbox-sync-apply`, `outbox-sync-drain`, `enqueue-photos`,
  `field-writes`, `hydrate-merge` en verde (suite total verde tras Plan A: 120/120; Plan B agrega
  las suyas).
- `next build`: OK (21/21 páginas).
- Cada tarea pasó revisión de subagente (spec + calidad) y Plan A pasó review final (opus): sin
  Critical.

## Pendiente / deuda conocida

- **E2E manual en modo avión:** crear recorrido/pesaje sin red → la pantalla avanza y muestra el
  registro → recuperar conexión → la cola drena a 0 → verificar en Supabase que no hay duplicados;
  recargar a mitad (con pendientes) → el registro local no desaparece.
- **Edición offline fuera de alcance:** `handleUpdateAnden`/`handleSaveEdit`/`handleCancel` y las
  anulaciones siguen online; si actúan sobre un registro aún en cola, fallan silenciosamente.
- Un `upload_photo` atascado permanente no limpia su blob (volumen ~50, tolerable).

## Relacionado

- `decisions/2026-06-01-roles-acceso.md` — RLS (tablas operativas abiertas a `authenticated`).
- `logs/2026-05-25-fotos-supabase-storage.md`, `logs/2026-05-25-recorridos-supabase-writethrough.md`.
