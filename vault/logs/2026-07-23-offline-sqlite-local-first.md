---
title: Offline — motor SQLite local-first (Plan A)
tags:
  - log
  - offline
  - apk
  - sqlite
  - supabase
updated: 2026-07-23
---

# Log 2026-07-23 — Motor offline SQLite local-first (Plan A: motor TS)

## Contexto

El outbox de IndexedDB (`logs/2026-06-19-offline-outbox-campo.md`) resolvía la pérdida de señal en
la PWA web, pero la app pasó a distribuirse como APK (Capacitor, ver
`logs/2026-07-22-monorepo-hub-app-dashboard.md`) y el operador puede pasar tramos largos sin red en
sitios reales. Se diseñó un motor local-first nuevo con backend dual: IndexedDB en web/dev y SQLite
+ Filesystem en el APK, detrás de un mismo contrato `LocalStore`.

Spec: `docs/superpowers/specs/2026-07-22-offline-sqlite-local-first-design.md`.
Plan A (este log): `docs/superpowers/plans/2026-07-22-offline-sqlite-A-motor-ts.md`.
Plan B (nativo, pendiente): `docs/superpowers/plans/2026-07-22-offline-sqlite-B-nativo.md`.

Ejecutado con subagent-driven-development, 10 tareas + este cierre, cada una con review de
subagente (spec + calidad). Rama `feat/offline-sqlite-local-first`, base `85f3abb`.

## Qué se hizo (por área)

### Contrato y backends (`shared/src/lib/local-store/`)
- **`types.ts`**: contrato `LocalStore` (filas de dominio + fotos + `SYNC_ORDER`) y dependencias
  nuevas (`@capacitor-community/sqlite`, `@capacitor/filesystem`, `@capacitor/preferences`).
- **`idb-store.ts`**: backend IndexedDB (web/dev), continuador espiritual del outbox anterior pero
  sobre el contrato genérico nuevo. Incluye polyfill de `structuredClone` que preserva `Blob`s (con
  assert de round-trip) porque el polyfill por defecto los corrompía.
- **`sqlite-store.ts`**: backend SQLite (APK) + Filesystem para blobs de fotos, con factory por
  plataforma en `index.ts` (Capacitor nativo → sqlite; web → idb).
- **`migrate-outbox.ts`**: migración idempotente del outbox IndexedDB legacy → LocalStore nuevo.

### Sincronización
- **`sync-engine.ts`**: `drainRegistros`/`drainPhotos` en dos fases, timeout de 15s por operación y
  mutex para no drenar en paralelo.
- Hook de sync + indicador de UI (registros/fotos pendientes, rechazos siempre visibles).

### Escrituras y lectura de campo
- Handlers de campo (pesaje, recorrido andén/morgue) escriben directo al LocalStore en vez de al
  outbox IndexedDB, que queda retirado.
- **`hydrate-local.ts`**: hidratación local-first — la UI lee primero del dispositivo y mergea por
  id con lo que trae el server.
- Edición local/online con error visible cuando la operación requiere red y no hay.

### Sesión APK
- Sesión persistida en `@capacitor/preferences` con expiración por 1h de **inactividad** (no por
  tiempo fijo desde login) — decisión de usuario 2026-07-22. Web sin cambios (sigue con el
  mecanismo de auto-logout existente).

## Decisiones

- **Tabla genérica `local_rows`** (`tbl`, `id`, `payload` JSON, `synced`, `attempts`, `sync_error`)
  en vez de una tabla SQLite por entidad — evita 10 DDLs paralelos al modelo de Supabase y sus
  migraciones futuras; el precio es perder tipado a nivel SQL (se paga en TS vía el contrato).
- **Fotos en `local_photos` con su propio flag `synced`**, no un `photos_synced` colgado de la fila
  padre — una foto puede terminar de subir independientemente de su registro, y el gate de UI no
  necesita saber cuántas fotos tiene cada entidad.
- Tabla **`meta`** para valores sueltos del motor (versión de esquema, etc.).
- **`event_type` de fotos usa el enum real de la base de datos** (`route` / `weighing`), no
  `route_event`/`reception` como decía el plan original — los paths de Storage quedan compatibles
  con el legacy sin necesidad de migrar fotos ya subidas. **Nota para Plan B (Kotlin):** el mapeo
  `drainPhotos` nativo debe usar `route → route_events`, `weighing → container_receptions`, no los
  nombres que trae el plan.
- **Hidratación local corre 1×/mount con `unionById`**: un Critical de la Tarea 7 detectó que
  recargar sin este gate pisaba estado que ya había llegado del server; la hidratación local se
  ejecuta una sola vez por montaje y une (no reemplaza) por id.
- **La migración del outbox legacy no descarta operaciones silenciosamente**: si algo no migra,
  queda un warning y la operación permanece en el outbox viejo en vez de perderse.
- **Fotos sin fila padre local no bloquean el drenado**: si el padre ya está en el server (histórico
  pre-migración), la foto sincroniza igual en vez de quedar atascada esperando una fila que nunca
  va a aparecer localmente.

## Verificación

- `npm test` (root, 3 workspaces): `@hospiwaste/shared` 26 suites / 152 tests, `@hospiwaste/hub` 6
  suites / 35 tests, `@hospiwaste/app` 7 suites / 17 tests — **todo verde** (204 tests).
- `npm run build:app`: `next build --webpack` OK, 20 páginas generadas (incluye
  `/register/route/anden/[slot]` con 6 slots estáticos).
- `npm run build:hub`: `next build --webpack` OK, 16 páginas generadas.
- `npm run test:ui` (vitest de `shared/src/components/ui`): 2 archivos / 12 tests verdes.
- `cd app && npx cap sync android`: registra los 6 plugins de Capacitor (incluye
  `@capacitor-community/sqlite`, `@capacitor/filesystem`, `@capacitor/preferences` nuevos);
  regenera `app/android/app/capacitor.build.gradle` y `app/android/capacitor.settings.gradle`
  (commiteados, no editados a mano — se regeneran siempre así desde `app/`).
- Cada tarea (1–10) pasó review de subagente; Críticos encontrados en tarea se resolvieron en la
  misma tarea (ver decisiones arriba: event_type de fotos, hidratación 1×/mount, migración sin
  descartes, gate de fotos sin padre).

## Pendiente / deuda conocida

- **Plan B (nativo, Kotlin)** — `docs/superpowers/plans/2026-07-22-offline-sqlite-B-nativo.md`:
  bloqueado por falta de JDK en la máquina de desarrollo (mismo bloqueo que el APK de
  `logs/2026-07-22-monorepo-hub-app-dashboard.md`). Cuando se ejecute, el mapeo `drainPhotos` debe
  usar `route`/`weighing` (ver decisión arriba), no los nombres del plan original.
- **E2E en dispositivo real**: modo avión completo (SQLite + Filesystem + Preferences) sin poder
  compilar el APK localmente — queda pendiente hasta resolver el JDK.
- El outbox de IndexedDB queda retirado del flujo de escritura (Tarea 9) pero la migración legacy
  sigue viva para dispositivos que aún tengan operaciones en la cola vieja.

## Relacionado

- `logs/2026-06-19-offline-outbox-campo.md` — outbox anterior, reemplazado por este motor (ver nota
  al tope de ese log).
- `logs/2026-07-22-monorepo-hub-app-dashboard.md` · `decisions/2026-07-22-separacion-hub-app.md` —
  monorepo hub/app/shared sobre el que corre este motor.
- `logs/2026-06-19-login-tarjetas-auto-logout-operador.md` — mecanismo de sesión web que la sesión
  APK complementa (no reemplaza).
