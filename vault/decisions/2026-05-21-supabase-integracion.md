---
title: Integración con Supabase — decisiones de arquitectura
tags:
  - decisions
  - supabase
  - backend
  - auth
  - storage
updated: 2026-05-21
---

# ADR: Integración con Supabase para el piloto

**Fecha:** 2026-05-21
**Estado:** Aceptado
**Contexto:** primera prueba piloto inminente; necesitamos backend persistente para clientes, empresas, contenedores, recorridos, pesajes y fotos.

## Decisiones

### 1. Proyecto y plan
- Proyecto nuevo `hospiwaste` en la org **Oito** (`vcsdwhbojrxynzpulcsk`), ref `xqqnthyipkdkwyknbtnw`.
- Región **us-east-2** (mínima latencia hacia Panamá).
- Plan **Free** (suficiente para piloto: < 500 MB BD, < 1 GB Storage).

### 2. Autenticación
- **Supabase Auth con email/password**.
- Tabla `public.profiles` extiende `auth.users` (1:1 por id uuid).
- Trigger `on_auth_user_created` crea automáticamente el profile usando `raw_user_meta_data->>'name'` o el local-part del email como fallback.
- Operadores se crean desde el panel de Supabase (o desde un futuro `/admin`). No hay signup público.

### 3. Estrategia RLS (fase piloto)
- RLS **activado** en todas las tablas de `public` y en `storage.objects` (bucket `photos`).
- Policies: cualquier `authenticated` puede leer/escribir/borrar todas las tablas operativas. `profiles` solo se actualiza el propio row.
- **Razón:** todos los operadores son personal interno con permisos equivalentes durante el piloto. Granularidad por rol se introducirá después si aparece una distinción (admin vs operador) que la justifique.
- Los advisors marcan estos policies como "always true" → es **intencional y documentado**, no un hallazgo real.

### 4. Storage
- Un único bucket privado **`photos`**, 10 MB max por archivo, MIME: jpeg/png/webp/heic.
- Convención de path: `{event_type}/{event_id}/{photo_id}.{ext}` (ej: `route/{uuid}/{uuid}.jpg`).
- Las URLs se obtienen vía signed URL en el server cuando se necesita renderizar el PDF semanal.
- La tabla `public.photos` guarda `storage_path` (para el bucket) y/o `url` (para fotos externas/legacy).

### 5. Modelo de datos
- 1:1 con `vault/project/DataModel.md` (revision 2026-05-17).
- Container IDs son `text` (`'I-001'`, `'A-042'`) — coinciden con el negocio y son legibles en URLs.
- `route_event_containers_dirty` y `route_event_containers_clean` reemplazan los arrays JSON del mock (`containers_dirty_received`, `containers_clean_delivered`).
- Vista `container_receptions_with_net` (security_invoker) computa `net_weight = gross - tare` server-side.

### 6. Cliente en Next.js 16 (App Router)
- `@supabase/ssr` (no `@supabase/auth-helpers-nextjs`, deprecado).
- 3 entry points:
  - `src/lib/supabase/client.ts` — `createBrowserClient`, para Client Components.
  - `src/lib/supabase/server.ts` — `createServerClient` con cookies de Next, para Server Components / Server Actions / Route Handlers.
  - `src/lib/supabase/middleware.ts` — `updateSession` invocado desde `src/middleware.ts`, refresca cookies en cada request.
- **Llamar siempre `getUser()` en server (no `getSession()`)** — `getSession` no valida el JWT.
- Vars de entorno: solo `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Nunca** exponer service_role.

### 7. Migraciones y tipos
- SQL inicial en `supabase/migrations/20260521000000_initial_schema.sql`.
- Tipos TS en `src/lib/supabase/database.types.ts` — regenerar con `supabase gen types typescript --project-id xqqnthyipkdkwyknbtnw`.
- Iteraciones de schema: `execute_sql` (MCP) → cuando estable, generar nueva migration.

## Pendientes (post-decisión)

- **Migrar `src/lib/store.ts` (Zustand) a hooks que consulten Supabase.** Hoy todo lee de `MOCK_*`; hay que reemplazar por queries.
- Decidir si el offline-queue (`src/lib/offline-queue.ts`) sigue siendo necesario o si Supabase + service-worker bastan.
- Estrategia de subida de fotos desde la PWA (upload directo desde browser vs route handler).
- Crear página `/login` con `signInWithPassword`.
- Crear seed/admin para alta inicial de Cliente, Empresas (ION, Airkem) y carga del histórico cuando el cliente lo pida.
