# Diseño — Offline robusto con SQLite local-first (modelo Ponce-Benzo)

**Fecha:** 2026-07-22
**Estado:** Propuesto — pendiente de plan de implementación
**Alcance:** Reestructurar la capa offline de `app/` (APK operadores) para que una base
SQLite local sea la fuente de verdad de la UI de campo, con fotos en Filesystem, motor de
sync con timeout/mutex/fases, y sincronización en background vía plugin Kotlin propio.
Reemplaza el outbox IndexedDB como mecanismo de durabilidad (el motor conceptual se
conserva). Referencia: arquitectura probada en producción en la app de campo Ponce-Benzo.

---

## 1. Evaluación de compatibilidad del stack

| Requisito del modelo de referencia | Estado en hospiwaste | Veredicto |
|---|---|---|
| Next.js App Router + React + Zustand + Supabase | Next 16.2.4, React 19.2.4, Zustand 5, `@supabase/supabase-js` 2.x | ✅ idéntico |
| Capacitor Android | `@capacitor/core` 8.4.1, `@capacitor/android` 8.4.1 | ✅ |
| `@capacitor-community/sqlite` | No instalado; v8.1.0 soporta `@capacitor/core >=8` | ✅ instalar |
| `@capacitor/filesystem` | No instalado; v8.1.2 soporta core 8 | ✅ instalar |
| `@capacitor/preferences` | No instalado; v8.0.1 soporta core 8 | ✅ instalar |
| `output: 'export'` sin SSR/middleware/route handlers | Ya así desde el 2026-06-23 (`app/next.config.ts`) | ✅ ya hecho |
| Sin `next-pwa`/service worker en el build Capacitor | Eliminado en el monorepo split (2026-07-22) | ✅ ya hecho |
| Separar target campo vs admin | Monorepo `hub/` (online) vs `app/` (APK) desde 2026-07-22 | ✅ ya hecho |
| Plugin Kotlin (foreground service + WorkManager) | `app/android/` existe (Capacitor 8, Gradle regenerable con `cap sync`) | ⚠️ viable, pero **no hay JDK en esta máquina** — la fase nativa requiere Android Studio/JDK |

**Correcciones al prompt de referencia:**
- La rama `feat/apk-capacitor` ya no es la base: fue absorbida por `feat/monorepo-split`
  y mergeada a `main`. El trabajo se hace sobre `main`, en `app/` + `shared/`.
- Los ajustes de build que pide (export estático, quitar SW, separar targets) **ya están
  hechos** — esa fase del roadmap desaparece casi completa.
- No existe pantalla de campo que lea "¿completado?" directo de Supabase; el equivalente
  del bug es la **no-durabilidad del store** (ver §3).

## 2. Solapamiento con el trabajo previo (qué se conserva, qué se reemplaza)

El outbox del 2026-06-19 (`logs/2026-06-19-offline-outbox-campo.md`) ya implementó una
parte sustancial del modelo de referencia. **Se conserva conceptualmente:**

- **Ids UUID de cliente + upsert idempotente** `onConflict: 'id'` (`outbox-sync.ts`) — regla 1 del motor, ya cumplida.
- **Ruta determinística de fotos** `{event_type}/{event_id}/{photo_id}.{ext}` con `upsert:true` — ya cumplida.
- **Fallo por ítem no bloquea a los demás** + clasificación red vs rechazo (`isNetworkError`) + reintento indefinido — ya cumplida.
- **Orden padre→hijo por dependencias** (`deps` en `OutboxOp`, drenado por rondas) — equivale al "orden de flush por FK"; el registro nunca espera a sus fotos (las fotos dependen del evento, no al revés).
- **Triggers de flush**: online, visibilitychange, intervalo 30 s, evento tras escritura (`use-offline-sync.ts`) — ya cumplida (falta agregar `appStateChange` nativo).
- **Merge por id donde lo local pendiente gana** (`hydrate-merge.ts` + hydrator) — ya cumplida.
- **Contador de pendientes + indicador honesto** (`sync-indicator.tsx`) — parcial (no separa registros de fotos, no expone rechazos repetidos).

**Se reemplaza / falta:**

| Gap | Hoy | Modelo nuevo |
|---|---|---|
| Durabilidad del estado de dominio | Store Zustand **en memoria**; solo el outbox (IndexedDB) es durable | Tablas de dominio en SQLite con `synced`, leídas al arrancar |
| Read-model tras reinicio offline | Hidratación desde Supabase falla sin red → pantallas vacías → **posible doble llenado** (el bug del prompt, versión hospiwaste) | UI hidrata desde SQLite siempre; Supabase solo enriquece online |
| Blobs de foto | IndexedDB (`photo_blobs`) — frágil en WebView Android | Archivos vía Filesystem (`Directory.Data`), SQLite guarda la ruta |
| Timeout duro por request | No existe — un fetch colgado congela el flush | ~15 s por llamada; expira = fallo, sigue el siguiente |
| Mutex de flush | No existe — intervalo + online + evento pueden solapar drenados | `isFlushing` (los drenados solapados hoy no corrompen por idempotencia, pero duplican trabajo) |
| Flags `synced`/`photos_synced` separados | Implícito en deps del outbox | Explícito por fila; contador separado para la UI |
| Error visible por rechazo repetido | `attempts` se cuenta pero no se muestra | Estado de error por ítem en el indicador |
| Edición de registro aún no sincronizado | Online-only, **falla silenciosa** (deuda conocida del log) | `synced=0` → reescribe fila local; `synced=1` → online con error visible |
| Sync en background | Nada — solo con el WebView vivo | Plugin Kotlin: foreground service + WorkManager |
| Sesión | `sessionStorage` (efímera por diseño) | Ver decisión §6 |

## 3. El bug del duplicado, versión hospiwaste

El flujo actual es local-first solo mientras el proceso vive: la escritura va al store
Zustand (memoria) + outbox (IndexedDB). Si el operador **mata la app sin señal**, al
reabrir el store está vacío, el hydrator no puede leer Supabase, y `mergeById` no tiene
`localRows` que preservar → las pantallas (Home/semáforo de slots, historial del día)
muestran el día como no trabajado, invitando a llenar de nuevo. El outbox sí conserva los
datos → al volver la señal suben **ambas** versiones (ids distintos) = duplicados.
La base local como fuente de verdad elimina esto por diseño: el `SELECT` local responde
"completado" desde el milisegundo del guardado, sobreviva o no el proceso.

## 4. Arquitectura objetivo

### 4.1 Interfaz `LocalStore` (dos backends)

`shared/src/lib/local-store/` define la interfaz; el motor de sync y la UI solo hablan
con ella:

- **`sqlite-store.ts`** (APK): `@capacitor-community/sqlite`, WAL activado, base
  `hospiwaste.db`. Fotos como archivos (`@capacitor/filesystem`, `Directory.Data`,
  ruta `photos/{photo_id}.{ext}`); la fila guarda `photo_uri` (JSON array de rutas).
- **`idb-store.ts`** (web/dev): misma interfaz sobre IndexedDB (reusa `idb`). Permite
  `npm run dev:app` en navegador y conserva un fallback PWA si se necesitara.
- Selección por `Capacitor.isNativePlatform()` (patrón ya usado en `capture-photo.ts`).

### 4.2 Esquema SQLite (filas de dominio, no cola)

*(Refinado al planificar, 2026-07-22.)* En lugar de DDL por entidad, una tabla genérica
de filas de dominio — el payload es el mismo JSON que se upsertea en Supabase, lo que
permite al service Kotlin subirlo directo por REST sin mapear columnas por tabla:

```sql
CREATE TABLE local_rows (
  tbl        TEXT NOT NULL,   -- tabla Supabase destino
  id         TEXT NOT NULL,   -- id de cliente (o clave compuesta serializada)
  payload    TEXT NOT NULL,   -- JSON de la fila tal como se upsertea
  synced     INTEGER NOT NULL DEFAULT 0,
  attempts   INTEGER NOT NULL DEFAULT 0,
  sync_error TEXT,            -- último rechazo no-red (para la UI)
  created_at TEXT NOT NULL,
  PRIMARY KEY (tbl, id)
);
CREATE TABLE local_photos (   -- metadatos + ruta del archivo; el blob vive en Filesystem
  photo_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, event_id TEXT NOT NULL,
  label TEXT NOT NULL, uploaded_by TEXT, taken_at TEXT NOT NULL, role TEXT,
  ext TEXT NOT NULL, content_type TEXT NOT NULL, file_uri TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, sync_error TEXT
);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

`photos_synced` por entidad se **deriva** (fotos con `event_id=X AND synced=0`), no se
duplica como flag. `meta` guarda: versión de esquema, flag de migración desde IndexedDB,
lock JS/nativo (§4.5). El orden padre→hijo del flush lo da una constante `SYNC_ORDER`
sobre `tbl` (los `local_rows` de una tabla hija solo suben cuando su padre está
`synced=1`).

### 4.3 Motor de sync (`shared/src/lib/local-store/sync-engine.ts`)

Evolución de `drainOutbox` con las reglas del modelo de referencia:

1. Upserts idempotentes por id de cliente (sin cambio).
2. **Fase registros**: entidades padre → hijas (mismo orden de FK que las deps
   actuales), subiendo registros **sin esperar fotos**; marca `synced=1`.
3. **Fase fotos**: para filas `synced=1 AND photos_synced=0`, sube cada archivo a
   Storage (misma ruta determinística) + upsert en `public.photos`; al completar todas,
   `photos_synced=1` y borra los archivos locales ya subidos (o los conserva según
   política de caché — decidir en plan).
4. **Timeout 15 s** por request (`AbortController` envolviendo cada llamada Supabase);
   timeout = fallo de red del ítem, el flush continúa.
5. **Mutex `isFlushing`**: trigger con flush en curso → no-op.
6. Try/catch por fila; rechazo no-red → `attempts++`, `sync_error`, sigue.
7. Triggers: online, `appStateChange` (foreground), intervalo 30–60 s, tras cada
   escritura local — todos convergen en `flush()`.
8. `pendingCounts()`: `{records: COUNT(synced=0), photos: COUNT(synced=1 AND
   photos_synced=0), rejected: COUNT(sync_error IS NOT NULL)}` → banner
   "N registros y M fotos por sincronizar" + estado de error visible.

### 4.4 Read-model local-first en la UI

- Al arrancar, el store Zustand se **hidrata primero desde `LocalStore`** (síncrono a
  efectos prácticos, sin red). El hydrator de Supabase pasa a ser enriquecimiento:
  merge por id donde **lo local con `synced=0` gana** (evolución de `mergeById`, que hoy
  solo agrega, nunca pisa — se conserva esa semántica).
- Toda escritura de campo va en una operación: fila(s) en SQLite + reflejo en el store
  con el mismo id (los handlers de `field-writes.ts` cambian de "encolar op" a
  "insertar fila con `synced=0`").
- Chequeos de "¿ya se llenó?" (semáforo de slots del Home, bloqueo de formularios) leen
  del store hidratado desde local — nunca dependen de red.
- Edición: `synced=0` → `UPDATE` local directo (el upsert sube la versión final);
  `synced=1` → online-only con **error visible** si falla (elimina la deuda de fallo
  silencioso del 2026-06-19).

### 4.5 Background sync (plugin Kotlin propio, `app/android/`)

`@capacitor/background-runner` descartado (sin acceso a SQLite/Filesystem). Plugin:

1. **Foreground service**: arranca cuando hay pendientes y red (o al recuperarla, vía
   `ConnectivityManager`); notificación "Sincronizando N registros…"; abre la **misma**
   base SQLite (ruta de `@capacitor-community/sqlite`); replica el flush vía REST de
   Supabase (mismos upserts, misma ruta de Storage); marca flags; se apaga al drenar.
2. **WorkManager** periódico con constraint de red + re-agenda tras `BOOT_COMPLETED`.
3. **Lock JS/nativo** en la tabla `meta` (owner + expiración): el flush del WebView y el
   del service nunca corren a la vez; una colisión no corrompe (idempotencia) pero se
   evita trabajo duplicado.
4. **Token para el service** en EncryptedSharedPreferences (ver §6).

### 4.6 Migración desde el outbox IndexedDB

Al primer arranque de la versión nueva: si `hospiwaste-offline` tiene ops pendientes,
convertirlas a filas de dominio en SQLite (`synced=0`) y blobs → archivos Filesystem;
marcar `migrated_outbox=1` en `meta`; recién entonces limpiar IndexedDB. Riesgo bajo:
el APK previo (`app-debug.apk`) es de prueba, pero la migración es barata y protege
cualquier dispositivo con cola viva. Los datos de la PWA web en navegador **no migran**
al APK (origin distinto): drenar la cola en la PWA antes de instalar el APK en cada
teléfono (checklist de despliegue).

## 5. Fases de trabajo

1. **`LocalStore`** (interfaz + SQLite + Filesystem + adapter IDB web) + migración
   desde IndexedDB. Tests jest de la lógica pura (esquema, migración idempotente).
2. **Read-model local-first**: hidratación desde local, handlers de `field-writes` a
   filas de dominio, merge; elimina el bug del duplicado. Tests de merge y conteo.
3. **Motor de sync**: fases registro/fotos, timeout, mutex, triggers, `pendingCounts`,
   error visible, edición local/online. Tests de orden de flush y split registro/fotos.
4. **Sesión** según decisión §6 (`@capacitor/preferences` + token nativo).
5. **Plugin Kotlin**: foreground service + WorkManager + lock. ⚠️ Bloqueada por
   JDK/Android Studio en la máquina de build.
6. **E2E manual en dispositivo real** (criterios §7) + log en el vault.

Cada fase deja la app funcionando con sus tests (la 5 es aditiva; hasta la 4 el sync
sigue funcionando solo-WebView como hoy).

## 6. Decisión: sesión persistente vs. efímera

> [!info] RESUELTO (2026-07-22, usuario)
> En el APK la sesión **persiste en `@capacitor/preferences`** y expira solo por
> **inactividad de 1 h** (chequeada al arrancar y al volver a foreground) — ya no muere
> al cerrar la app. Web (hub/dev) mantiene `sessionStorage`. El refresh token nativo en
> EncryptedSharedPreferences **se conserva tras el logout** para drenar pendientes
> post-logout; se borra en el logout solo si la cola está en 0.
> Implementación: Plan A Task 10 y Plan B Task 2.

Conflicto real entre el modelo de referencia y una decisión previa deliberada
(spec 2026-06-23 + `logs/2026-06-19-login-tarjetas-auto-logout-operador.md`): la sesión
es **efímera a propósito** (teléfonos compartidos, login por tarjeta, auto-logout 1h),
mientras que el background sync exige un token válido sin la app abierta.

**Propuesta:** separar sesión de UI y credencial de sync.
- La sesión de UI mantiene su política actual (efímera + auto-logout 1h) — puede migrar
  de `sessionStorage` a `@capacitor/preferences` con limpieza explícita en logout, para
  robustez del WebView, sin cambiar la semántica.
- En login, el plugin guarda un refresh token dedicado en EncryptedSharedPreferences,
  usado **solo** por el service/WorkManager. Cada registro ya lleva su `operator_id`,
  así que "quién sube" no altera la traza (decisión del 2026-06-19: la cola es del
  dispositivo). Se invalida al hacer logout explícito… o se conserva para drenar
  pendientes post-logout — **confirmar con el usuario** cuál de las dos.

## 7. Criterios de aceptación (E2E manual en dispositivo real)

Los 6 del modelo de referencia, adaptados:

1. **Modo avión total**: jornada completa (recorridos + pesajes, 5+ fotos c/u) sin señal
   → todo aparece completado al instante y bloqueado → matar la app → reabrir sin señal
   (todo sigue) → activar red → todo en Supabase sin duplicados, fotos incluidas.
2. **Doble llenado imposible**: completar un slot/registro y reintentarlo (sync en curso
   o sin red, y tras recargar) → bloqueado siempre.
3. **Señal intermitente**: avión on/off durante flush → sin duplicados ni pérdidas,
   pendientes converge a 0.
4. **Background**: completar sin señal, cerrar la app (swipe), recuperar señal → los
   datos llegan sin reabrir (service/WorkManager).
5. **Señal débil** (throttling): ningún request cuelga el flush >15 s.
6. **Fotos pesadas** (>8 MB): el registro llega aunque las fotos sigan pendientes;
   `photos` completa después y los contadores convergen.

## 8. Riesgos / notas

- **JDK ausente**: las fases 1–4 son 100 % TypeScript y compilables hoy; la 5 y el E2E
  exigen Android Studio/JDK. Conseguir el entorno antes de llegar a la fase 5.
- **`@capacitor-community/sqlite` es community**: API verbosa (connections/consistency);
  encapsularla entera detrás de `LocalStore` para poder cambiar de driver.
- **Doble escritura de fase 2→3**: entre fases el outbox viejo y el nuevo no deben
  convivir activos; el plan debe cortar en un solo release (o feature flag).
- **RLS**: el service usa REST con el token del operador; las policies actuales
  ("authenticated full access") lo permiten — revisar si cambian.
- **Hub no se toca**: `hub/` sigue online-only; todo esto vive en `shared/` (motor) y
  `app/` (integración + nativo).

## Relacionado

- `vault/logs/2026-06-19-offline-outbox-campo.md` — outbox actual (base conceptual)
- `docs/superpowers/specs/2026-06-23-apk-capacitor-design.md` — decisión Capacitor + sesión efímera
- `vault/decisions/2026-07-22-separacion-hub-app.md` — monorepo hub/app/shared
