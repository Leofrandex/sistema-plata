---
title: Login por tarjetas + auto-logout de operador
tags:
  - log
  - auth
  - supabase
updated: 2026-06-19
---

# Log 2026-06-19 — Login por tarjetas y auto-logout de operador

## Contexto

El teléfono de campo es **compartido por todos los operadores**. Cerrar sesión y escribir
usuario+contraseña en cada relevo es tedioso, y las sesiones quedaban abiertas indefinidamente en
un dispositivo compartido. Esta entrega ("Situación 1" del lote previo al merge) acelera el login y
acota la duración de la sesión de los operadores.

Spec: `docs/superpowers/specs/2026-06-19-login-tarjetas-auto-logout-operador-design.md`.
Plan: `docs/superpowers/plans/2026-06-19-login-tarjetas-auto-logout-operador.md`.

## Qué se hizo

### Login por tarjetas
- Nueva vista pública **`public.login_directory`** (`security_invoker = false`, `GRANT SELECT` a
  `anon`/`authenticated`) que expone solo `id, name, role, email` y excluye la cuenta `demo@`.
  Migración `20260619000000_login_directory_view`. La pantalla de login es anónima, por eso la
  lista de usuarios necesita ser legible sin sesión.
- Query `getLoginDirectory()` (`src/lib/supabase/queries/login-directory.ts`).
- `/login` (`src/app/login/page.tsx`) reescrita: arranca con **tarjetas** agrupadas en
  **Operadores** y **Coordinadores** (avatar de iniciales + nombre). Tocar una tarjeta lleva al
  paso de **solo contraseña** (con botón "‹ Cambiar usuario"); login con el email de la tarjeta.
  *Fallback* "Ingresar con correo" para el formulario manual; si el directorio falla, degrada al
  formulario de correo.

### Auto-logout de operador (1 h absoluta)
- Lógica pura en `src/lib/session-timeout.ts`: corte **absoluto** a los 60 min desde el login
  (`SESSION_DURATION_MS`), aviso a los 5 min (`WARNING_MS`); ancla `login_at` en `localStorage`
  (`hospiwaste:login_at`). Helpers `setLoginAt/getLoginAt/clearLoginAt` y `computeSessionState`,
  `formatRemaining`. Cubierto por tests (jest).
- Hook `useOperatorCountdown` (`src/hooks/use-operator-countdown.ts`): solo lectura; emite el
  estado restante con tick de 1 s; inactivo para coordinadores o sin `login_at`.
- `OperatorSessionGuard` (`src/components/layout/operator-session-guard.tsx`), montado una vez en
  `app/layout.tsx`: único dueño de los efectos — ancla `login_at` si falta (operador), lo limpia
  para no-operadores, hace `signOut` firme al expirar y muestra el banner de aviso en los últimos
  5 min.
- Chip de cuenta regresiva **mm:ss** en `mobile-header.tsx`, visible solo para operadores (estado
  de alerta en los últimos 5 min); el botón "Salir" ahora limpia `login_at` al hacer logout manual.
- `login_at` se ancla en **todo** login exitoso; el guard lo ignora para coordinadores (nunca
  expiran). El trabajo en curso de recorrido/pesaje sobrevive en IndexedDB (`active-session.ts`),
  así que el siguiente operador puede retomarlo.

## Decisiones

- **Enumeración de usuarios aceptada:** la vista pública revela nombres y correos sintéticos del
  roster (no contraseñas). Tradeoff aceptado para una herramienta interna de planta.
- **Timeout absoluto, no por inactividad:** se mide desde el login, no se reinicia con la
  actividad. Más predecible para el caso del dispositivo compartido.
- **Solo operadores expiran:** coordinadores (oficina) mantienen sesión.

## Verificación

- `jest`: tests nuevos de `session-timeout` (6/6) y `use-operator-countdown` (2/2) en verde.
- `next build`: OK (21/21 páginas).
- Vista `login_directory` aplicada al piloto y verificada (2 coordinadores, 7 operadores; `demo@`
  excluido). Tipos regenerados en `src/lib/supabase/database.types.ts`.

## Roster (aplicado 2026-06-19)

Vía SQL admin sobre el piloto (mismo patrón del ADR de roles, tokens en `''`):
- **Altas (operadores):** Juan Pérez (`juan.perez@`), Ovidio Montalvo (`ovidio.montalvo@`),
  Luis Soto (`luis.soto@`). Contraseñas temporales entregadas a Sebastián por separado (no se
  versionan).
- **Baja:** Miguel Rangel (`miguel.rangel@`) — sin registros operativos asociados, borrado de
  `auth.users` (profile cae por cascade).
- Verificado en `login_directory`: 2 coordinadores + 9 operadores; `demo@` excluido.

## Pendiente

- **E2E manual:** smoke del login por tarjeta/correo y de la expiración real a la hora (se puede
  forzar bajando `SESSION_DURATION_MS` temporalmente).
- Minor (UX, no bloqueantes): el botón "Ingresar con correo" se ve mientras carga el directorio;
  `showPassword` no se resetea al pulsar "Cambiar usuario".

## Relacionado

- `decisions/2026-06-01-roles-acceso.md` — roles coordinador/operador (UI + middleware + RLS).
- `decisions/2026-05-21-supabase-integracion.md` — RLS del piloto.
- Pendiente: spec hermana de resiliencia offline ("Situación 2").
