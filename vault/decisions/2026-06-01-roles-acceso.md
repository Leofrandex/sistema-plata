---
title: Roles de acceso — coordinador / operador
tags:
  - decisions
  - auth
  - rls
  - supabase
updated: 2026-06-01
---

# ADR: Roles de acceso (coordinador / operador)

**Fecha:** 2026-06-01
**Estado:** Aceptado
**Contexto:** El piloto arrancó con todos los usuarios equivalentes (cualquier `authenticated` lee/escribe todo, ver `decisions/2026-05-21-supabase-integracion.md` §3). Tras el lanzamiento surge la necesidad de distinguir **coordinadores** (Karolyne, Marelys — oficina) de **operadores** (ayudantes de planta/recorrido).

## Decisión

Dos roles en `public.profiles.role` (enum `user_role`):

- **coordinator:** acceso total (igual que antes).
- **operator:** solo Inicio (Dashboard), Recorrido, Pesaje y Tratamiento.

El rol es la **fuente de verdad en `profiles.role`** (no en `user_metadata`, que es editable por el usuario y por tanto inseguro para autorización).

### Aplicación en tres capas

1. **Navegación (cliente):** `currentRole` en el store (lo carga el hydrator). `sidebar` y `mobile-bottom-nav` ocultan a operadores: Reportes, Tachos, Traslado externo y Admin. El operador ve sus 4 tabs y el logout pasó al `mobile-header`.
2. **Rutas (middleware):** `OPERATOR_PATHS` define lo permitido; si la ruta no es operador-permitida se consulta `profiles.role` y, si es operador, redirige a `/dashboard`. Las rutas del operador no pagan query extra.
3. **RLS (base):** escritura (`INSERT/UPDATE/DELETE`) restringida a `public.is_coordinator()` en `containers`, `clients`, `client_locations`, `companies` y `external_transfers`. La **lectura** sigue abierta a `authenticated` (recorrido/pesaje necesitan leer tachos y empresas). Las tablas operativas (`route_events`, `receptions`, `treatment_runs`, `container_locations`, `photos`, etc.) siguen abiertas a escritura — el operador trabaja ahí.

### Detalles de seguridad

- `public.is_coordinator()` es `SECURITY DEFINER` (lee `profiles` sin recursión de policies); solo devuelve un booleano sobre el propio `auth.uid()`. `EXECUTE` revocado a `public`/`anon`, concedido a `authenticated`. El advisor lo marca como "authenticated puede ejecutar SECURITY DEFINER" → **intencional**.
- `REVOKE UPDATE (role) ON profiles FROM authenticated, anon` impide el auto-ascenso (un operador no puede cambiarse el rol vía la Data API). Los cambios de rol se hacen por `service_role` / SQL admin.
- Las cuentas de operador (sin correo real) se crearon vía SQL en `auth.users` + `auth.identities` con `email_confirmed_at = now()` y contraseña con `extensions.crypt(..., gen_salt('bf'))`. **Gotcha:** GoTrue falla con "Database error querying schema" si las columnas de token (`confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`) quedan en NULL — deben ser `''`.

## Alternativas descartadas

- **Rol en JWT vía custom access token hook:** evita la query de rol en middleware, pero agrega configuración y el claim no refresca al instante. Se evaluará si la query resulta costosa.
- **Solo UI + middleware (sin RLS):** más simple pero un operador podría escribir admin saltándose la app. Descartado: se quiso defensa en la base.

## Relacionado

- `decisions/2026-05-21-supabase-integracion.md` (RLS piloto "authenticated full")
- `logs/2026-06-01-roles-coordinador-operador.md`
- Spec: `docs/superpowers/specs/2026-06-01-roles-acceso-supabase-design.md`
