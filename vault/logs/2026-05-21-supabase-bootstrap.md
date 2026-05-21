---
title: Bootstrap de Supabase para el piloto
tags:
  - log
  - supabase
  - backend
  - pilot
date: 2026-05-21
---

# Bootstrap de Supabase

## Qué se hizo

Preparativos para integrar la app con Supabase antes del piloto (todavía no se reemplazó el store Zustand; eso es la siguiente fase, después de que termine el agente paralelo).

### Infraestructura
- Proyecto **`hospiwaste`** creado en org Oito, región us-east-2, plan Free.
- Ref: `xqqnthyipkdkwyknbtnw` · URL: `https://xqqnthyipkdkwyknbtnw.supabase.co`.

### Schema (`supabase/migrations/20260521000000_initial_schema.sql`)
- 9 enums (`waste_type`, `container_size`, `container_phase`, `location_type`, `photo_event_type`, `route_slot`, etc.).
- 14 tablas: `profiles`, `clients`, `client_locations`, `companies`, `containers`, `photos`, `route_events`, `route_event_containers_dirty/clean` (join), `weighing_sessions`, `container_receptions`, `storage_events`, `treatment_runs`, `external_transfers`, `container_locations`.
- Vista `container_receptions_with_net` (`security_invoker`) que computa `net = gross − tare`.
- Trigger `on_auth_user_created` → autocrea `profiles` cuando se inserta en `auth.users`.

### Seguridad
- RLS habilitado en las 14 tablas + `storage.objects` (bucket `photos`).
- Policies: `authenticated` con acceso full a tablas operativas (decisión piloto — ver ADR `decisions/2026-05-21-supabase-integracion.md`).
- `handle_new_user()` con `EXECUTE` revocado de `public/anon/authenticated` (solo el trigger la invoca).

### Storage
- Bucket privado `photos`, 10 MB max, MIME: jpeg/png/webp/heic.
- Policies para `select/insert/update/delete` por `authenticated` sobre `bucket_id = 'photos'`.

### Código Next.js
- Instalados `@supabase/supabase-js` + `@supabase/ssr`.
- `src/lib/supabase/{client,server,middleware,index}.ts`
- `src/lib/supabase/database.types.ts` (tipos generados desde el schema real).
- `src/middleware.ts` que refresca la sesión vía `updateSession`.
- `.env.local.example` con URL + publishable key.
- `.gitignore` permite `.env.local.example` y `.env.example`.

### Vault
- `vault/project/Architecture.md` — Supabase agregado al stack e integraciones.
- `vault/decisions/2026-05-21-supabase-integracion.md` — ADR completo de las decisiones.

## Lo que NO se hizo (y por qué)

- **Migrar el store Zustand a Supabase**: esperando a que termine el agente paralelo. Es la siguiente fase.
- **Seed de datos**: usuario eligió "empezar 100% vacío" para el piloto. El histórico Airkem (189 carros, 14k recepciones) NO se cargó en Supabase — sigue viviendo en `src/lib/data/historical-data.json`.
- **Página `/login`**: pendiente para la fase de integración.
- **Subida de fotos a Storage**: las pantallas hoy guardan blobs en IndexedDB; hay que reemplazar por `supabase.storage.from('photos').upload(...)` en la fase de migración.

## Hallazgo de advisors

Tras `get_advisors` aparecen 42 warnings `rls_policy_always_true` sobre policies de `authenticated`. Es **intencional** durante el piloto (ver ADR). El advisor que sí se atendió fue `anon_security_definer_function_executable` sobre `handle_new_user` — se le revocó el EXECUTE.
