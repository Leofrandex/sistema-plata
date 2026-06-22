# Login por tarjetas + auto-logout de operador — Design

**Fecha:** 2026-06-19
**Estado:** Aprobado (diseño) — pendiente plan de implementación
**Rama:** `feat/historial-editable-recorridos-pesajes` (o rama nueva)
**Contexto:** El teléfono de campo es **compartido por todos los operadores**. Cerrar sesión y
escribir usuario+contraseña en cada relevo es tedioso, y las sesiones quedan abiertas
indefinidamente en un dispositivo compartido. Esta spec cubre la "Situación 1": acelerar el
login y acotar la duración de sesión de los operadores. La "Situación 2" (resiliencia offline)
se trata en una spec aparte.

---

## Objetivos

1. **Login rápido en dispositivo compartido:** elegir usuario de una lista de tarjetas y solo
   ingresar contraseña.
2. **Sesión acotada para operadores:** cierre de sesión automático **1 hora** después del login,
   con temporizador visible y aviso previo. Los coordinadores no expiran.
3. **Actualizar el roster** de cuentas como parte del cambio.

No-objetivos (fuera de alcance de esta spec):
- Resiliencia offline / cola de subidas (spec separada).
- PIN numérico, biometría u otros métodos de autenticación.
- Cambiar el modelo de roles (`coordinator`/`operator`) ya existente.

---

## Estado actual relevante

- `/login` (`src/app/login/page.tsx`): formulario correo + contraseña con
  `supabase.auth.signInWithPassword`. Tras login redirige a `next` o `/dashboard`.
- Roles en `public.profiles.role` (enum `user_role`: `coordinator`/`operator`), cargados al store
  por el hydrator (`currentRole`). Ver `decisions/2026-06-01-roles-acceso.md`.
- Cuentas de operador creadas vía SQL en `auth.users` + `auth.identities` (sin correo real,
  `email_confirmed_at = now()`, contraseña con `extensions.crypt(...)`). Gotcha conocido: las
  columnas de token deben ser `''`, no `NULL`.
- RLS: lectura abierta a `authenticated`, **no a `anon`**. La pantalla de login es anónima, por lo
  que hoy no puede leer la lista de usuarios.
- El operador ya tiene el logout en `mobile-header`; la nav de operador está restringida
  (sidebar/bottom-nav ocultan Reportes/Tachos/Traslado/Admin).
- Sesiones de recorrido/pesaje en curso se persisten en IndexedDB (`src/lib/active-session.ts`),
  independientes del usuario logueado (clave por fecha/slot).

---

## Diseño

### 1. Login por tarjetas

**Fuente de datos — vista/RPC pública.**
Crear una vista (o RPC `SECURITY DEFINER`) `public.login_directory` que exponga **solo**
`id, name, role, email`, legible **sin sesión** (`GRANT SELECT ... TO anon, authenticated`).
- Se mantiene sola al alta/baja de cuentas (deriva de `profiles` + `auth.users`).
- Orden: por rol y luego por nombre.
- Tradeoff aceptado: cualquiera que abra la app ve los **nombres y correos sintéticos** de los
  usuarios (no contraseñas). Aceptable para una herramienta interna de planta.

**UI.**
- `/login` arranca mostrando **tarjetas** en dos grupos con encabezado: **Operadores** y
  **Coordinadores**. Cada tarjeta: avatar de iniciales + nombre + etiqueta de rol.
- Al tocar una tarjeta → vista de **solo contraseña**: muestra el nombre/avatar elegido, campo
  de contraseña (con el botón ojo ya existente) y un botón **"‹ Cambiar usuario"** para volver a
  la lista. Submit → `signInWithPassword({ email: <email de la tarjeta>, password })`.
- *Fallback:* link discreto **"Ingresar con correo"** que muestra el formulario manual actual
  (por si alguna cuenta no está en el directorio o para soporte).
- Manejo de errores igual al actual (`traducir(...)`), mostrado en la vista de contraseña.

### 2. Auto-logout de operador (1 hora absoluta)

- Al completar el login se ancla un **`login_at`** (timestamp ISO) en el dispositivo
  (`localStorage`, p. ej. `hospiwaste:login_at`). Es el ancla del corte; **no** se reinicia por
  actividad (timeout absoluto, no de inactividad).
- El corte aplica **solo a operadores**. Para coordinadores no se arma el temporizador ni el corte.
- **Restante** = `login_at + 60min − now`.
  - Si la app se cierra y reabre dentro de la hora, el conteo continúa desde `login_at`.
  - Si al cargar la app ya pasó la hora (`restante ≤ 0`), se hace `signOut()` inmediato → `/login`.
- **Aviso previo:** en los últimos **5 minutos** se muestra un banner de advertencia
  ("Tu sesión se cerrará en mm:ss").
- **Al expirar (restante ≤ 0):** `supabase.auth.signOut()` firme + limpieza de `login_at` →
  redirige a `/login`. El recorrido/pesaje en curso permanece en IndexedDB
  (`active-session.ts`), de modo que el siguiente operador que entre puede retomarlo. No se borra
  trabajo no guardado del lado de la app por el logout en sí.

### 3. Temporizador visible

- Chip de cuenta regresiva **mm:ss** en el `mobile-header`, visible **solo para operadores**
  (junto al logout existente).
- Estado normal: neutro. Últimos 5 min: estado de alerta (color de advertencia) + el banner de
  aviso descrito arriba.

### Componentes / unidades

- **`public.login_directory`** (migración SQL): vista/RPC + grants a `anon`.
- **`getLoginDirectory()`** (`src/lib/supabase/queries/...`): lee el directorio con el cliente
  anónimo para poblar las tarjetas.
- **`/login` (page.tsx)**: estado de dos pasos (lista de tarjetas → contraseña) + fallback correo.
  Componentes de tarjeta y grupos.
- **`useOperatorSessionTimer()`** (hook nuevo): lee `login_at` + rol; con `setInterval` calcula el
  restante, expone `{ remainingMs, isWarning }`, dispara el `signOut` al expirar. No-op para
  coordinadores. Montado en el shell de layout (donde vive `mobile-header`).
- **Set de `login_at`**: en el handler de login exitoso.
- **Chip + banner**: componentes de presentación que consumen el hook.

### Roster de cuentas (migración / SQL admin)

- **Agregar como operadores:** Juan Pérez, Ovidio Montalvo, Luis Soto. Mismo patrón SQL del ADR
  de roles (auth.users + identities + profiles, tokens en `''`).
- **Eliminar:** Miguel Rangel (de `auth.users`; el profile cae por FK/cascade o se borra explícito).
- Confirmar contraseñas iniciales con el usuario al implementar.

---

## Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Fuente de la lista de usuarios | Vista/RPC pública en Supabase (no lista hardcodeada) |
| Exponer nombres/correos a anónimos | Aceptado (herramienta interna) |
| Tipo de timeout | **Absoluto** desde el login (no por inactividad) |
| Duración | 60 minutos |
| A quién aplica | Solo operadores; coordinadores no expiran |
| Comportamiento al expirar | Aviso a los 5 min restantes + corte firme con `signOut` |
| Trabajo en curso al cortar | Permanece en IndexedDB; retomable por el siguiente operador |
| Ubicación del temporizador | Chip en `mobile-header` (solo operadores) |
| Roster | +Juan Pérez, +Ovidio Montalvo, +Luis Soto (operadores); −Miguel Rangel |

---

## Riesgos / consideraciones

- **`login_at` en `localStorage`** puede borrarse (limpiar datos del navegador) → en ese caso no
  hay ancla; tratar la ausencia como "sesión sin temporizador" sería un hueco. Mitigación: si hay
  sesión Supabase activa de un operador y **no** hay `login_at`, anclarlo en ese momento (peor caso
  da hasta 1 h extra una sola vez) o forzar re-login. A definir en el plan.
- **Reloj del dispositivo**: el corte usa la hora local del teléfono; un reloj mal puesto desplaza
  el corte. Aceptable para el caso de uso.
- **Enumeración de usuarios**: la vista pública revela el roster. Aceptado explícitamente.
- El fallback de correo manual evita quedar bloqueado si el directorio falla.

---

## Relacionado

- `decisions/2026-06-01-roles-acceso.md` — roles coordinador/operador (UI + middleware + RLS).
- `decisions/2026-05-21-supabase-integracion.md` — RLS del piloto.
- Spec hermana (pendiente): resiliencia offline / cola de subidas ("Situación 2").
