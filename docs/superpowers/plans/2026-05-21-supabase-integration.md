---
title: Plan — Integración Supabase para el piloto
date: 2026-05-21
status: pending
owner: Sebastian Castro
related:
  - vault/decisions/2026-05-21-supabase-integracion.md
  - vault/logs/2026-05-21-supabase-bootstrap.md
  - docs/superpowers/plans/2026-05-21-sesion1-pesaje-recorridos-dashboard.md
---

# Plan — Integrar la app con Supabase (piloto 2026-05-21)

## Contexto

El bootstrap de Supabase ya está hecho: proyecto `hospiwaste` provisionado, schema
aplicado (incluyendo ajustes `route_kind` + `observations`), Storage configurado,
clientes Next.js (`browser/server/middleware`) instalados y `.env.local` creado.

Lo que falta es **conectar la app al backend**: hoy `src/lib/store.ts` lee de
`MOCK_*` y todo es in-memory. Hay que pasar a leer/escribir contra Supabase, con
un catálogo real de 189 envases (`A-001..A-189`) sin asignación de cliente para
el piloto.

## Restricciones del piloto

- El piloto del **2026-05-21 ~10am Panamá es solo de pesaje** (no recorrido, no
  reportes). El resto del flujo igual debe seguir funcionando como hoy con datos
  vacíos.
- Los 189 envases **no tienen cliente asignado** — todos disponibles para
  cualquier sesión de pesaje.
- El histórico de Airkem (`src/lib/data/historical-data.json`) **NO se sube** a
  Supabase. Sigue alimentando el dashboard como hoy.
- Operadores autenticados con Supabase Auth (email/password) — no signup público.

## Fases

### Fase 0 — Schema: company_id nullable (5 min)

Migración corta para permitir envases sin empresa.

- `alter table containers alter column company_id drop not null`
- Regenerar `database.types.ts`
- Nueva migration: `supabase/migrations/20260521020000_containers_company_id_nullable.sql`

### Fase 1 — Seed del catálogo de envases (15 min)

Cargar los 189 envases (A-001..A-189) sin `company_id`, con su tara real.

- Script `scripts/seed-containers-supabase.py` (o `.ts`) que:
  1. Lee `src/lib/data/historical-data.json`.
  2. Inserta `containers` vía `execute_sql` (o REST con service-role en local).
  3. Usa `on conflict (id) do nothing` para que sea idempotente.
- Verificar `select count(*) from containers` → 189.
- Documentar en `vault/logs/2026-05-21-seed-envases.md`.

### Fase 2 — Capa de queries tipadas (1 h)

Funciones por dominio que envuelven `supabase.from(...)`. Sirven igual desde
Server Components y Client Components.

```
src/lib/supabase/queries/
├── containers.ts       listContainers, getContainer, updateContainerTare
├── clients.ts          listClients, getClient
├── companies.ts        listCompanies
├── route-events.ts     listRouteEvents, createRouteEvent, addContainersToRoute
├── weighing.ts         createWeighingSession, endWeighingSession,
│                       addReception, updateReception, listReceptionsBySession
├── photos.ts           uploadPhoto, getSignedUrl, listPhotosByEvent
└── profiles.ts         getCurrentProfile, listOperators
```

- Cada función tipada con `Tables<>`, `TablesInsert<>`, `TablesUpdate<>`.
- Lanzan error si `supabase.error != null` (no devolver `{data, error}` al
  caller; eso explota fácil).

### Fase 3 — Página `/login` + flujo de auth (45 min)

- `src/app/login/page.tsx`: form email/password, llama a `signInWithPassword`,
  redirect a `/` (o `?next=...`).
- `src/app/auth/signout/route.ts`: route handler POST que llama `signOut()`.
- Botón "Cerrar sesión" en sidebar / bottom-nav.
- Middleware: si `getUser()` retorna null y la ruta no es `/login`, redirect a
  `/login`.
- Verificar visualmente login → home → logout → vuelve a login.

### Fase 4 — Reemplazar `src/lib/store.ts` por hooks Supabase (2 h)

Punto más delicado. Estrategia: **mantener la API pública del store** para no
tocar componentes; por dentro las acciones llaman a las queries.

- Renombrar el actual a `store.legacy.ts` para referencia.
- Nuevo `store.ts` con misma interfaz `HospiwasteStore`, pero:
  - El estado inicial se hidrata vía `useEffect` con queries Supabase (o el
    componente raíz lo pasa por contexto).
  - Las acciones (`addContainer`, `addReception`, `addWeighingSession`,
    `updateReception`, `deleteWeighingSession`, etc.) llaman a la query
    correspondiente y luego actualizan el state local con la fila devuelta por
    Supabase (id real, defaults, etc.).
- Validación: la pantalla de pesaje funciona end-to-end contra Supabase.
- **Lo que NO migra ahora** (queda con mock o stubs): recorridos, fotos
  (`MOCK_PHOTOS`), reports. El piloto solo es pesaje.

### Fase 5 — Upload de fotos al bucket (40 min) — *parte del flujo de pesaje*

Pesaje captura foto de envase + balanza. Si en la sesión 1 ya hay fotos en el
flujo, hay que migrarlas.

- Helper `uploadPhoto(file, { eventType, eventId, label })` en
  `queries/photos.ts`:
  1. `supabase.storage.from('photos').upload(path, file)` con path
     `{event_type}/{event_id}/{uuid}.{ext}`.
  2. `insert into photos (storage_path, event_type, event_id, label,
     uploaded_by, taken_at)`.
- Render con `createSignedUrl(path, 3600)` (1 h).
- Reemplazar `URL.createObjectURL` en el componente de captura.
- Stub: si la sesión 1 todavía no terminó de mover el flujo, dejar la captura
  como hoy (local) y hacer upload diferido — bandera `NEXT_PUBLIC_USE_REMOTE_PHOTOS`.

### Fase 6 — Smoke test del flujo pesaje contra Supabase (30 min)

Antes de declarar el piloto listo:

1. Login con un operador real.
2. Crear sesión de pesaje.
3. Agregar 3 receptions (gross, observations).
4. Editar la observation de una.
5. Cerrar sesión.
6. Verificar en Supabase Dashboard que las filas están bien.
7. Recargar la app → la sesión histórica aparece.

## Lo que NO entra en este plan (explícito)

- Recorridos contra Supabase → fuera del piloto, queda con mock funcional.
- Reports / PDF semanal contra Supabase → mock.
- Migración del histórico Airkem → decisión del usuario, queda en JSON local.
- Dashboard contra Supabase → sigue leyendo `historical-data.json`.
- Roles / permisos finos → todos los operadores autenticados con acceso full
  (decisión piloto).

## Decisión pendiente del usuario

- **Alta de operadores**: tú creas los usuarios en `Supabase Dashboard → Auth →
  Users → Invite user`. Avísame cuándo, y te paso la lista exacta de qué
  ingresar como `raw_user_meta_data.name` para que el trigger cree los
  `profiles` con buen display name.

## Orden de ejecución sugerido

1. Fase 0 (5 min)
2. Fase 1 (15 min) — desbloquea pruebas con datos reales
3. Fase 2 (1 h) — desbloquea todo lo demás
4. Fases 3 y 4 en paralelo (auth y store son ortogonales) (~2 h)
5. Fase 5 (40 min)
6. Fase 6 (30 min)

**Total estimado: ~4.5 horas**. Si la sesión 1 (cambios pesaje/recorridos/dashboard) sigue corriendo, las fases 0–2 se pueden hacer ya; 3–6 esperan al merge.

## Criterio de éxito

Un operador puede:
- Entrar a `https://hospiwaste/login`, autenticarse.
- Abrir `/register/weighing`, iniciar sesión.
- Ver los 189 envases disponibles (sin filtro de cliente).
- Pesar un envase, agregar observaciones, capturar fotos.
- Cerrar la sesión.
- Cerrar el navegador y al volver, ver la sesión y sus receptions.

Todo persistido en Supabase Postgres + Storage. Cero datos mock involucrados en
el flujo de pesaje.
