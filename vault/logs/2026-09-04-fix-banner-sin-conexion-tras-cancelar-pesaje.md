---
title: Fix — "Sin conexión con el servidor" al cancelar/finalizar un pesaje (ruta /dashboard fantasma)
tags:
  - log
  - fix
  - apk
  - pesaje
  - offline
updated: 2026-09-04
---

# 2026-09-04 — Fix: el banner "Sin conexión con el servidor" tras cancelar un pesaje

## Cómo se detectó

Reporte de campo con un patrón muy nítido, que el propio usuario aisló:

> "Entro a la aplicación, hago un pesaje de prueba, todo funciona excelente, y luego
> cancelo el pesaje. **Después de cancelar el pesaje se pierde la conexión con el
> servidor.**"

Síntomas asociados: el banner no se quitaba con "Reintentar", seguía apareciendo al pasar
de WiFi a datos móviles, y Pesaje quedaba bloqueado. La sospecha del usuario —"no es tema
de conexión, es algo puramente de la aplicación"— era correcta.

## Diagnóstico

### Causa raíz — `/dashboard` no existe en el APK

`app/src/app/register/weighing/page.tsx` terminaba tanto `handleCancel()` como
`handleFinish()` con `router.push('/dashboard')`. Esa ruta quedó de **antes** de la
separación hub/app (ver [[2026-07-22-separacion-hub-app]]): hoy `/dashboard` vive solo en
`hub` y el export estático de `app` no la genera. Se confirma en la salida de
`build:app`, que lista las rutas exportadas y no la incluye.

En el APK eso no es un 404 amable: el router no encuentra la página en el manifest, el
WebView hace una **carga dura** contra el server local de Capacitor y la app se reinicia
entera. Al reiniciar se pierde la hidratación en curso y el `SupabaseHydrator` marca
`connectionStatus: 'error'` → banner "Sin conexión con el servidor", con
`currentProfileId` sin poblar → "Cargando tu sesión…" y Pesaje bloqueado.

`handleFinish()` tenía exactamente el mismo bug: el operador que **completaba** un pesaje
en producción caía en el mismo reinicio.

Un `SuccessScreen` huérfano (sin ningún uso) apuntaba también a `/dashboard` y a
`/containers/detail`, ambas del hub. Se borró.

### Agravante 1 — corridas de `load()` que se pisaban

`load()` del hydrator se dispara desde cinco fuentes (mount, `onAuthStateChange`,
conectividad, `visibilitychange`, "Reintentar") y no tenía guard de reentrada: solo
`cancelled`, que es por *desmontaje*, no por corrida. En el APK se solapan seguido —
abrir la cámara para la foto de pesaje manda el WebView a background (Android puede
abortar los fetch en vuelo) y al volver dispara `visibilitychange`, que arranca otra
corrida encima. La corrida vieja resolvía **después** de la nueva y pisaba su resultado:

- un rechazo tardío escribía `'error'` sobre un `'online'` recién puesto → banner con red
  perfecta, que "Reintentar" no quitaba (el reintento sí funcionaba; era la corrida zombi
  la que volvía a marcar error);
- su `setCurrentProfileId(null)` con datos viejos dejaba Pesaje en "Cargando tu sesión…".

Solución: contador de generación (`myGen !== generation` ⇒ obsoleta). **Solo la última
corrida escribe estado.**

### Agravante 2 — el hydrator seguía escuchando el evento `online` del window

`net-status.ts` se creó justo porque `navigator.onLine` miente en el WebView, pero solo lo
usaba `use-offline-sync`. El hydrator seguía con `window.addEventListener('online', …)`,
así que pasar de WiFi a datos móviles podía no re-hidratar nunca y el banner se quedaba
puesto hasta tocar "Reintentar" a mano. Se movió `net-status.ts` a `shared/src/lib/` y
ahora ambos consumen la misma fuente de verdad.

## Solución

| Archivo | Cambio |
|---|---|
| `app/src/app/register/weighing/page.tsx` | `router.push('/dashboard')` → `HOME` (`/`) en cancelar y finalizar |
| `app/src/components/register/success-screen.tsx` | Borrado (muerto, apuntaba a rutas del hub) |
| `app/src/__tests__/lib/app-routes.test.ts` | **Nuevo**: todo destino literal de navegación debe existir en `app/src/app` |
| `shared/src/components/supabase-hydrator.tsx` | Guard de generación + suscripción vía `onConnectivityChange` |
| `shared/src/lib/net-status.ts` | Movido desde `app/src/lib/` (+ `@capacitor/network` en `shared/package.json`) |
| `app/android/app/build.gradle` | `versionCode` 4 → 5, `versionName` "1.3" → "1.4" |

## Verificación

`npm test` 248/248 (177 shared + 37 hub + 34 app). `build:hub` y `build:app` verdes; la
lista de rutas exportadas de `app` confirma que `/dashboard` no está.

El test nuevo, además de blindar el fix, **encontró solo** el segundo enlace roto
(`success-screen.tsx`) al primer corrido.

## Regla que sale de acá

> [!warning] Un enlace a una ruta inexistente reinicia el APK, no da 404
> En el export estático de Capacitor, navegar a una página que no se generó provoca una
> carga dura contra el server local: se pierde el estado de la app y el usuario ve "Sin
> conexión con el servidor". Tras la separación hub/app hay que verificar que ninguna ruta
> del hub quede enlazada desde `app` — lo cubre `app/src/__tests__/lib/app-routes.test.ts`.
