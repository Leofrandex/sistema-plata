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

---

# Adenda 2026-07-23 — Plan B: background sync nativo (Kotlin)

Ejecutado el mismo día a continuación del Plan A (Tasks 2–5 de
`docs/superpowers/plans/2026-07-22-offline-sqlite-B-nativo.md`), también con
subagent-driven-development y review final de rama. **Falta solo la Task 6: E2E manual
en dispositivo real.**

## Hallazgo previo clave

No hay JDK "instalado": las compilaciones usan el **Temurin 21 embebido en la extensión
Java de Antigravity IDE** (`~\.antigravity-ide\extensions\redhat.java-*\jre\*`). El
Android SDK ya estaba en `%LOCALAPPDATA%\Android\Sdk`. Ni Android Studio ni EAS son
necesarios (EAS no soporta Capacitor).

## Qué se hizo (`app/android/.../sync/` + bridge TS)

- **`SyncCredentials.kt`** — EncryptedSharedPreferences (`hospiwaste_sync`): url, anon key,
  refresh token y `rotated_at` (0 = el token vino del WebView; >0 = lo rotó el nativo).
- **`SyncPlugin.kt`** (`NativeSync`) — `setCredentials` (login/TOKEN_REFRESHED),
  `getCredentials`, `clearCredentials` (cancela el work), `kick`.
- **`SyncEngine.kt`** — abre `hospiwasteSQLite.db` (WAL), **no rota el token si la cola
  está vacía**, sube `local_rows` en `SYNC_ORDER` (gating padre→hijo, `rev` anti-clobber,
  red≠rechazo con abort de pasada) y fotos (`route`→route_events, `weighing`→
  container_receptions; padre local unsynced bloquea, ausente no), REST con timeout 15 s,
  `sync_error` con código HTTP + snippet. Persistencia del refresh token rotado antes de usarlo.
- **`SyncLock.kt`** — lock en `meta` (`flush_lock`, owner único por drain + TTL 120 s +
  `renew` por tabla/foto).
- **`SyncService.kt`** — foreground service `dataSync`: notificación, drain en hilo,
  `stopSelf(startId)`, `startIfPending` (red + credenciales + EXISTS de pendientes).
- **`SyncWork.kt` + `BootReceiver.kt`** — periódico 15 min con constraint de red,
  `KEEP`, re-agenda tras reboot; sin credenciales → success (no churn).
- **Bridge TS** (`app/src/lib/native-sync.ts` + wiring): handoff del refresh token en
  login y TOKEN_REFRESHED; re-adopción de la rotación nativa al volver a foreground
  (**solo si hay sesión JS activa** — teléfono compartido); `clearCredentialsIfDrained`
  en los 3 logouts (scope `local` si hay pendientes, para no matar la familia de tokens);
  `kick` al ir a background.

## Decisiones

- Red vs rechazo replicado del motor TS: un corte a mitad de drain NO marca `sync_error`
  (evita falsas alarmas de "rechazados" en el indicador).
- Foto ya subida por el otro motor = skip silencioso (guard `synced=0` en markPhotoFailed
  de ambos lados) — mata el escenario "zombi" binario-borrado-pero-unsynced.
- Logout con cola pendiente → signOut `scope: 'local'` en nativo: el drain post-logout
  conserva una familia de tokens válida (decisión usuario 2026-07-22).

## Verificación

- `gradlew assembleDebug` verde en cada tarea (JDK Antigravity). jest 209 (3 workspaces)
  + vitest 12 verdes; `build:app`/`build:hub` OK.
- Reviews: 2 Critical (carrera de rotación de token; foto zombi) y 5 Important detectados
  por los reviewers y corregidos (commits `da86dda`, `f83398d`, `026ee79`, más los fixes
  por tarea). Veredicto final: **Ready for device E2E**.

## Pendiente — E2E en dispositivo real (Task 6)

Los 6 criterios del spec §7 **más** los deltas del review final: carrera de rotación
(app abierta >45 min con cola vacía → sesión sobrevive), re-adopción tras drain nativo,
foto en drenado concurrente (background→foreground rápido), Android 13+ sin permiso de
notificaciones, kick desde background en Android 12+ (FGS restrictions), Doze >1 h,
reboot con cola, logout online con pendientes, drain largo de fotos (>120 s). Registrar
resultados en un log nuevo.
