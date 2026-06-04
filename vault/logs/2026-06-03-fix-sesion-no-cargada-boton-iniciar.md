---
title: Fix — "Todavía no se cargó tu sesión" al iniciar recorrido/pesaje
tags:
  - log
  - bugfix
  - pesaje
  - recorrido
  - auth
updated: 2026-06-03
---

# 2026-06-03 — Fix: alert sin salida "Todavía no se cargó tu sesión"

## Síntoma

Durante el piloto, un operador (en `sistema-plata.vercel.app`) recibió el alert
**"Todavía no se cargó tu sesión (sin conexión con el servidor). Esperá a
reconectar e intentá de nuevo."** al tocar **Iniciar recorrido / pesaje**, sin
poder avanzar.

## Causa raíz (no era de datos)

Verificado en Supabase (`xqqnthyipkdkwyknbtnw`): los 10 usuarios de `auth.users`
tienen su fila en `profiles`, y la RLS de `profiles` es `SELECT using true`. O
sea, ni profile faltante ni RLS bloqueando.

Era una **carrera de tiempos en el cliente**: `SupabaseHydrator.load()` puebla
`currentProfileId` de forma asíncrona (`auth.getUser()` valida el JWT contra el
servidor + fetch del profile — segundos en datos móviles). Durante esa ventana
el botón "Iniciar" ya estaba **habilitado**; el operador lo tocaba antes de que
cargara la sesión → guard `if (!currentProfileId)` → alert sin salida.

Defectos que se combinaban:
1. Los botones de recorrido/pesaje **no** se deshabilitaban con `!currentProfileId`
   (la página de **tratamiento sí lo hacía** — inconsistencia que delató el bug).
2. `connectionStatus` arranca en `'connecting'` y `ConnectionBanner` solo aparece
   en `'error'`; además el path "profile null" en el hydrator retorna antes de
   `setConnectionStatus('error')` → ni banner ni "Reintentar".
3. El alert no disparaba ninguna re-hidratación: callejón sin salida.

## Solución

Nuevo componente `src/components/register/start-session-button.tsx`:
- Si `sessionReady === false` (`currentProfileId` aún null) **no** renderiza un
  botón "Iniciar" tappable: muestra "Cargando tu sesión…" + un "Reintentar" que
  dispara `hospiwaste:retry-hydration` (el hydrator ya lo escucha).
- Si está lista, renderiza el botón normal (respeta un `disabled` propio, p.ej.
  empresa del recorrido sin elegir).

Cableado en `weighing`, `route/anden/[slot]` y `route/morgue`, eliminando el
alert sin salida de cada `handleStart` (el guard queda como defensa). La página
de `treatment` ya gateaba con `!currentProfileId`, no se tocó.

Test: `src/__tests__/components/start-session-button.test.tsx` (TDD, 4 casos).

## Por qué este enfoque

Cierra la ventana de carrera en la raíz (el botón no es accionable hasta que la
sesión esté lista) y reemplaza el callejón sin salida por una recuperación
in-situ ("Reintentar"), que sirve tanto si la carga fue lenta como si falló. Se
evitó clasificar errores de `auth.getUser()` (frágil entre versiones de
supabase-js) porque el "Reintentar" recupera en todos los casos.
