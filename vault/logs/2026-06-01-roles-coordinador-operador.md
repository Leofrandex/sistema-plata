---
title: Roles coordinador / operador + cuentas reales
tags:
  - log
  - auth
  - rls
  - supabase
updated: 2026-06-01
---

# Log 2026-06-01 — Roles de acceso y alta de cuentas

## Qué se hizo

Se introdujeron dos roles (**coordinador** / **operador**) con control de acceso en tres capas y se dieron de alta las cuentas reales del equipo.

### Base de datos (migración `20260601030000_roles_and_access_control`)
- Enum `public.user_role` + columna `profiles.role` (default `operator`).
- `handle_new_user` ahora siembra `role` desde `raw_user_meta_data`.
- `public.is_coordinator()` (SECURITY DEFINER) para RLS.
- `REVOKE UPDATE (role) ON profiles` → sin auto-ascenso.
- RLS coordinator-only para escritura en `containers`, `clients`, `client_locations`, `companies`, `external_transfers`. Lectura sigue abierta.

### Cuentas (vía MCP, SQL sobre `auth.users` + `auth.identities`)
- **Coordinadores:** `demo@` (pruebas), `kmurray@hospiwaste.com` (Karolyne), `plantaptdp@hospiwaste.com` (Marelys).
- **Operadores (7):** Nodier Pinilla, Gregory Tenorio, Elias Rodriguez, Aldair Díaz, Elias Castillo, Miguel Rangel, Aaron Vasquez — correos `nombre.apellido@hospiwaste.com`.
- Contraseñas temporales entregadas a Sebastián por separado (no se versionan).

### Cliente (Next.js)
- `database.types.ts`: `role` en profiles + enum `user_role`. `types.ts`: `UserRole`.
- Store: `currentRole` + `setCurrentRole`; hydrator lo setea desde `getCurrentProfile`.
- `sidebar.tsx` y `mobile-bottom-nav.tsx`: navegación filtrada por rol; operador ve 4 tabs sin "Más".
- `mobile-header.tsx`: botón "Cerrar sesión" (antes vivía dentro de "Más").
- `middleware.ts`: gate por rol con `OPERATOR_PATHS` (redirige operador a `/dashboard`).

## Verificación
- `next build` OK. `jest` 75/77 (los 2 fallos son tests de vitest que jest agarra por `vi`, pre-existentes, ajenos al cambio).
- RLS probado: operador → `INSERT companies` rechazado (42501); coordinador → permitido.
- E2E (Playwright): operador ve `Inicio·Recorrido·Pesaje·Tratamiento`, `/reports` y `/admin/*` redirigen a `/dashboard`; coordinador ve barra completa y accede a todo.
- Advisors: `containers/clients/companies/external_transfers` salieron de la lista "always true". Warnings restantes (tablas operativas "always true", `is_coordinator` SECURITY DEFINER, leaked-password protection off) son pre-existentes/intencionales.

## Pendiente / notas
- No hay pantalla de cambio de contraseña en la app: las temporales son las de trabajo. Cambios de rol o password se hacen por Supabase (service_role/SQL).
- Considerar activar "Leaked Password Protection" en Auth si se endurece el acceso.

Decisión: `decisions/2026-06-01-roles-acceso.md`. Spec: `docs/superpowers/specs/2026-06-01-roles-acceso-supabase-design.md`.
