---
title: Fix — sesión del APK colgada y LocalStore SQLite muerto (thenable de Capacitor)
tags:
  - log
  - fix
  - apk
  - auth
  - offline
  - android
updated: 2026-08-25
---

# 2026-08-25 — Fix: "Cargando tu sesión…" eterno en el APK y outbox que no drenaba

## Cómo se detectó

Reporte de campo con dos síntomas que parecían no tener relación:

1. Los teléfonos de planta (Honor X6) **no podían instalar** el APK — "no se puede
   instalar la aplicación" — mientras que el Pixel del desarrollador y un Samsung A17 sí.
2. En el teléfono del desarrollador, **Pesaje se quedaba en "Cargando tu sesión…"** y no
   dejaba iniciar la sesión de pesaje.

La sospecha inicial era una incompatibilidad de versión de Android (Pixel con la última
versión vs. Honor con Android 15). **Era falsa** y se descartó antes de tocar código.

## Diagnóstico

Ver [[2026-08-25-instalacion-apk-firma-debug-vs-release]] para el problema de instalación,
que resultó **independiente** de este.

Para el cuelgue, `logcat` no servía: un build release de Capacitor no manda la consola del
WebView ahí. Se accedió al DevTools remoto por `adb forward` + CDP (el
`webContentsDebuggingEnabled: true` de `app/capacitor.config.ts` lo permite aun en
release). Ahí aparecieron dos errores en bucle, ambos reproducibles a mano invocando los
plugins desde la consola de la página.

### Bug 1 — el objeto de plugin de Capacitor es *thenable*

`shared/src/lib/supabase/preferences-storage.ts` tenía:

```ts
async function prefs() {
  const { Preferences } = await import('@capacitor/preferences')
  return Preferences
}
```

El proxy de plugin de Capacitor **responde con una función a cualquier propiedad que se le
pida**, `then` incluida. Verificado en el dispositivo: `typeof Preferences.then ===
'function'`. Por eso una función `async` que lo devuelve nunca resuelve: el motor lo trata
como promesa y lo "desenvuelve" llamando a `Preferences.then(resolve, reject)`, un método
que el bridge nativo no implementa (`"Preferences.then()" is not implemented on android`).

Como *todo* el adapter de sesión del APK pasa por `prefs()`, la sesión no se podía leer ni
escribir nunca: `supabase.auth.getSession()` quedaba colgado, `currentProfileId` nunca se
poblaba y `StartSessionButton` se quedaba en su estado de carga para siempre.

**Por qué pasó los tests:** el mock de `@capacitor/preferences` era un objeto literal, sin
`then`. El fixture no se parecía a lo que hace el plugin real. Ahora el mock es un `Proxy`
fiel y los 4 tests del archivo fallan si se reintroduce el patrón.

### Bug 2 — `execute()` con un PRAGMA que devuelve filas

`shared/src/lib/local-store/sqlite-store.ts` abría la conexión con
`c.execute('PRAGMA journal_mode=WAL;')`. `execute()` termina en `execSQL()` de Android, que
rechaza toda sentencia con resultado, y `PRAGMA journal_mode=WAL` devuelve el modo
resultante. Comprobado en el dispositivo, las dos variantes:

| Llamada | Resultado |
|---|---|
| `execute('PRAGMA journal_mode=WAL;')` | ❌ `Queries can be performed using SQLiteDatabase query or rawQuery methods only` |
| `query('PRAGMA journal_mode;')` | ✅ `{"journal_mode":"wal"}` |

La conexión nunca se abría, así que **el LocalStore entero estaba muerto** y el outbox no
drenaba nada (`[offline-sync] flush falló` en bucle). El esquema jamás llegó a crearse: las
tablas `local_rows`, `local_photos` y `meta` no existían en el dispositivo hasta este fix.

### Por qué ninguno de los dos se veía

Los dos primeros `await` de `load()` en `supabase-hydrator.tsx` estaban **fuera del
try/catch**, que arrancaba recién en el fetch de red. El rechazo quedaba mudo: sin banner
de conexión, sin error en pantalla, y con un "Reintentar" que volvía a fallar igual. Es el
mismo callejón sin salida de [[2026-06-03-fix-sesion-no-cargada-boton-iniciar]], un
nivel más abajo: aquel arregló el botón, este arregla que el fallo sea invisible.

## Solución

| Archivo | Cambio |
|---|---|
| `shared/src/lib/supabase/preferences-storage.ts` | `prefs()` devuelve `{ p: Preferences }`. El envoltorio no es thenable |
| `shared/src/lib/local-store/sqlite-store.ts` | `query()` en vez de `execute()` para el PRAGMA |
| `shared/src/components/supabase-hydrator.tsx` | `getSession()` y `getLocalStore()` dentro de try/catch, con `setConnectionStatus('error')` |
| `shared/src/__tests__/lib/preferences-storage.test.ts` | Mock del plugin como `Proxy` fiel al de Capacitor |
| `app/android/app/build.gradle` | `versionCode` 2 → 3, `versionName` "1.1" → "1.2" |

## Verificación

`npm test` 213/213 (161 shared + 35 hub + 17 app). `build:app`, `cap sync android` y
`gradlew assembleRelease` verdes.

En dispositivo (Pixel 10 Pro XL, Android 17), comparando v1.1 contra v1.2:

| Prueba | v1.1 | v1.2 |
|---|---|---|
| Round-trip de `Preferences` | colgado, `Preferences.then()` ×19 | ✅ 18 ms |
| Conexión SQLite | nunca abría | ✅ tablas `local_rows`, `local_photos`, `meta` |
| `[offline-sync] flush falló` | en bucle | ✅ 0 |
| Iniciar recorrido / pesaje | bloqueado | ✅ confirmado por el usuario en campo |

## Regla que sale de acá

> [!warning] Nunca devolver un objeto de plugin de Capacitor desde una función `async`
> El proxy responde a cualquier propiedad, así que es thenable y el `await` no resuelve
> jamás. Envolverlo siempre (`return { p: Plugin }`). Y los mocks de plugins en tests
> deben ser `Proxy`, no objetos literales — un mock plano no reproduce este fallo.

## Nota aparte: DNS de la operadora

Durante la verificación apareció un tercer síntoma no relacionado: en datos móviles de
Movistar Venezuela (`internet.movistar.ve`), el resolver **no resuelve el host del
proyecto** (`xqqnthyipkdkwyknbtnw.supabase.co`) aunque sí resuelve `supabase.co`,
`supabase.com`, `google.com` y `vercel.app`, y el ping por IP funciona. En el WebView llega
como `ERR_NAME_NOT_RESOLVED` y el login muestra "Sin conexión con el servidor" — mensaje
correcto, no un bug. Se destraba con DNS privado (`dns.google`) o cambiando de red.

**Pendiente de decisión:** evaluar un custom domain de Supabase para no depender de que la
operadora resuelva bien el subdominio de `supabase.co`. Afecta a los teléfonos de planta.
