---
title: Auditoría del APK — crash nativo por excepción de plugin, banner ciego y pantalla de diagnóstico
tags:
  - log
  - fix
  - apk
  - android
  - offline
  - diagnostico
updated: 2026-09-06
---

# 2026-09-06 — Auditoría del APK v1.4: por qué "se cierra sola" y por qué el banner no dice nada

## Cómo se detectó

Reporte de planta tras distribuir la v1.4 (versionCode 5):

- En un teléfono, el banner "Sin conexión con el servidor" aparece **apenas se abre la app**,
  con WiFi y con datos, y sigue igual tras desinstalar y reinstalar.
- En otro teléfono, la app **abre y al segundo se cierra** (crash).
- En el Pixel del desarrollador, en su casa, todo funciona: pesajes, cancelaciones, etc.

Ni logcat ni consola: los teléfonos están en planta, sin cable. Se hizo una auditoría de
código completa de la cadena de conexión (JS y nativo) en vez de un tercer fix a ciegas.

## Diagnóstico

Son **dos problemas independientes**.

### Problema 1 — el crash: una excepción en un plugin nativo mata el proceso

`node_modules/@capacitor/android/.../Bridge.java` (Capacitor 8.4), `callPluginMethod`:

```java
} catch (Exception ex) {
    Logger.error("Serious error executing plugin", ex);
    throw new RuntimeException(ex);
}
```

`PluginHandle.invoke` invoca el `@PluginMethod` por reflexión y deja pasar la
`InvocationTargetException`; el bridge la relanza como `RuntimeException` en el hilo del
plugin, sin nadie que la capture → Android mata el proceso. **Cualquier excepción en un
método de nuestro `SyncPlugin` cierra la app.** Ninguno de sus cuatro métodos tenía
try/catch.

Y esos métodos se llaman solos:

| Cuándo | Cadena |
|---|---|
| Al abrir, si pasó >1 h de inactividad (un teléfono de planta que durmió) | `AppLifecycle.checkExpiry` → `signOut` → `clearCredentialsIfDrained` → `NativeSync.clearCredentials` |
| Al volver a foreground con sesión | `adoptNativeRotation` → `NativeSync.getCredentials` |
| Al ir a background | `kickNativeSync` → `NativeSync.kick` → `startForegroundService` |

Los tres pasan por `SyncCredentials` → `EncryptedSharedPreferences.create()`, que es un
punto de fallo conocido: el Keystore de varios Huawei/Honor devuelve la llave maestra como
"existente pero inutilizable", y tras un backup/restore de Android (`allowBackup="true"`,
que era el valor del manifest) el archivo cifrado y el keyset de Tink vuelven pero la llave
del Keystore **no**, así que `create()` lanza en cada intento para siempre. Un teléfono en
ese estado entra en bucle: abre → `checkExpiry` → excepción → muerte, a cada apertura.
Eso es exactamente "abre y al segundo se cierra" en un teléfono que estuvo parado.

El `RuntimeException` no quedaba registrado en ningún lado accesible desde el teléfono.

> [!warning] Sin confirmación en dispositivo
> El **mecanismo** (excepción de plugin ⇒ proceso muerto) está verificado en el código
> fuente de Capacitor. La **excepción concreta** del teléfono de planta no se pudo leer
> (no hay logcat). Con la v1.5, si vuelve a pasar, la pantalla de diagnóstico muestra el
> stack: ahí se cierra el círculo.

Además, `SyncService.onStartCommand` llamaba `startForeground` sin captura: en Android 12+
un arranque fuera de la ventana permitida desde background lanza
`ForegroundServiceStartNotAllowedException`, otra muerte de proceso.

### Problema 2 — el banner: la app dice la verdad, el servidor no se alcanza desde la planta

Seguí la cadena de arranque completa. Con el token vencido (>1 h) y el servidor
inalcanzable, `supabase.auth.getSession()` intenta el refresh, falla y devuelve
`session: null` (verificado en `auth-js` `__loadSession`); el `AuthGuard` manda a `/login`;
el login no puede cargar el directorio y muestra "Sin conexión con el servidor". Con token
vigente, el hydrator falla en `getCurrentProfile` y pone el banner ámbar. Los dos caminos
son **correctos** para un servidor que no responde.

> [!warning] Hipótesis DNS bajada de prioridad (2026-09-06, mismo día)
> El usuario aportó que **días antes la app sí funcionó desde la red de la planta**. Con
> eso, el DNS de esa red deja de ser el sospechoso principal para el teléfono del banner.
> Pasa a primer lugar el hallazgo secundario 1 de abajo (la compuerta de `NET_CAPABILITY_VALIDATED`
> que entró con la v1.4: pastilla roja "Sin conexión" al abrir + cola que no sube, con
> servidor alcanzable), y en segundo lugar un plugin nativo que falle al arrancar en ese
> modelo. La captura de `/diagnostico` decide. Lo que sigue se conserva como registro.

Lo que no cuadra es la red. Y hay un dato previo que podría explicarlo: en
[[2026-08-25-fix-sesion-apk-preferences-sqlite]] quedó medido que **el DNS de Movistar
Venezuela no resuelve `xqqnthyipkdkwyknbtnw.supabase.co`** (sí resuelve `supabase.com`,
google, vercel). Si el WiFi de la planta usa un proveedor con el mismo comportamiento, falla
igual por WiFi y por datos, reinstalar no cambia nada, aparece al abrir, y en casa del
desarrollador (otro proveedor) funciona. Es la hipótesis principal y **no es un bug del
código**; se confirma abriendo `https://xqqnthyipkdkwyknbtnw.supabase.co/auth/v1/health`
en Chrome desde la red de la planta. Mitigación inmediata: **DNS privado** en cada
teléfono (Ajustes → Red → DNS privado → `dns.google`), o DNS público (8.8.8.8 / 1.1.1.1)
en el router de la planta.

Lo que **sí** es defecto del código: la app no distingue "sin internet" de "no resuelvo el
nombre" de "certificado rechazado" de "falló un plugin". Todo se ve como "Sin conexión con
el servidor". Por eso llevábamos dos ciclos adivinando.

### Evidencia nueva del mismo día (planta + verificación contra producción)

| Dato | Fuente | Qué descarta / confirma |
|---|---|---|
| La versión que funcionó días antes en planta fue la **v1.3** | usuario | El problema entró con la v1.4 o con el estado del teléfono, no con la red |
| El aviso es la **franja ámbar arriba con "Reintentar"** | usuario | Es `connectionStatus: 'error'` del hydrator; no es el indicador de sync ni el aviso del login |
| `…supabase.co/auth/v1/health` desde la red de planta respondió `{"message":"No API key found…"}` | planta | DNS, TLS y ruta al servidor **funcionan**. Hipótesis DNS **descartada** para esa red |
| Script con la cuenta `demo` (rol operador): signIn, `getUser`, las 11 consultas del hydrator, `container_receptions`, `login_directory` y `createSignedUrls` — **todo OK** (~100 ms cada una) | `node` contra producción | RLS/permisos por rol **descartados**; el fetch del hydrator no falla por el servidor |

Con el servidor y los permisos sanos, la franja ámbar solo puede venir del **arranque** del
`load()` (`getSession()` o `getLocalStore()` lanzando) o de un fallo del propio WebView.
Candidatos que quedan, en orden:

1. **`getLocalStore()` lanzando en ese teléfono.** Dos mecanismos reales encontrados en
   código: (a) si el WebView se recarga dentro del mismo proceso, el plugin nativo
   conserva la conexión y `createConnection` lanza "Connection hospiwaste already exists"
   (verificado en `CapacitorSQLite.java`); (b) el singleton **cacheaba la promesa
   rechazada**, así que "Reintentar" fallaba para siempre. Corregidos en v1.5 (reutilizar
   con `isConnection`/`retrieveConnection`; no cachear rechazos).
2. Base SQLite corrupta restaurada por el backup automático tras la reinstalación
   (`allowBackup=true` restauraba `databases/` sin garantía de consistencia del WAL).
   Con `allowBackup=false` una reinstalación ya arranca limpia.
3. Preferences fallando en ese modelo. `/diagnostico` lo muestra.

### Hallazgos secundarios (verificados en código)

1. **La v1.4 bloqueaba la subida de pendientes en redes "no validadas".** El plugin
   `@capacitor/network` solo reporta `connected: true` si Android marcó la red con
   `NET_CAPABILITY_VALIDATED` (verificado en `Network.java` del plugin), que depende del
   chequeo de conectividad contra servidores de Google. Una red con DNS defectuoso o portal
   cautivo queda "sin validar" aunque nuestro servidor responda. `use-offline-sync` usaba
   esa señal como compuerta del `flush` → la cola nunca subía en esas redes. Antes de la
   v1.4 la compuerta era `navigator.onLine`, que no tenía este problema. "Peor que antes"
   era literal.
2. **Tormenta de re-hidrataciones.** El mismo plugin reemite `networkStatusChange` con
   `connected: true` en cada `onCapabilitiesChanged` de Android (cambios de ancho de banda
   estimado, frecuentes en celular). El hydrator disparaba `load()` completo en cada uno;
   con el guard de generación de la v1.4, cada corrida nueva dejaba obsoleta a la anterior,
   y con señal débil ninguna llegaba a terminar.
3. `allowBackup="true"` restauraba además una sesión vieja de Preferences en un teléfono
   compartido recién reinstalado.

## Solución (v1.5, versionCode 6)

| Archivo | Cambio |
|---|---|
| `app/android/.../sync/SyncPlugin.kt` | Todo método envuelto en `guarded()` → `call.reject`, nunca lanza |
| `app/android/.../sync/SyncCredentials.kt` | Si `EncryptedSharedPreferences` no abre: borra archivo + keyset y reintenta una vez; si sigue, `null` (sync sin credenciales, app viva) |
| `app/android/.../sync/SyncService.kt` | `startForeground` y `startForegroundService` con try/catch |
| `app/android/.../HospiwasteApp.kt` | **Nuevo**: `Application` con `UncaughtExceptionHandler` que guarda el stack en `filesDir/last_crash.txt` antes de morir |
| `app/android/.../diag/DiagPlugin.kt` | **Nuevo**: plugin `Diag` que expone/borra ese archivo al WebView |
| `AndroidManifest.xml` | `android:name=".HospiwasteApp"`, `allowBackup="false"` |
| `app/src/app/diagnostico/page.tsx` + `app/src/lib/diagnostics.ts` + `diag-plugin.ts` | **Nuevo**: pantalla pública `/diagnostico` — versión, dispositivo, red según Android, nuestro host vs. host de control (google `generate_204`), sesión, Preferences, SQLite/cola, último crash. Informe copiable y resumen en una frase |
| `shared/src/lib/describe-error.ts` | **Nuevo**: error → línea legible con explicación en español (DNS, TLS, timeout, plugin, sesión) sin perder el texto técnico |
| `shared/src/lib/store.ts` | `connectionError` junto a `connectionStatus` |
| `shared/src/components/layout/connection-banner.tsx` | Muestra la causa y enlaza (con `Link`, no `<a>`) a `/diagnostico` |
| `shared/src/lib/net-status.ts` | `onConnectivityRestored`: solo la transición sin red → con red |
| `shared/src/components/supabase-hydrator.tsx` | Usa `onConnectivityRestored`; pasa el error al store |
| `app/src/hooks/use-offline-sync.ts` | El `flush` ya no se gatea por la señal del plugin; la señal solo alimenta el indicador |
| `shared/src/lib/local-store/sqlite-store.ts` | Reutiliza la conexión nativa existente (`isConnection` → `retrieveConnection`) antes de `createConnection` |
| `shared/src/lib/local-store/index.ts` | El singleton no cachea un `init()` rechazado: "Reintentar" reintenta de verdad |
| `app/src/lib/diagnostics.ts` | La sonda al host propio manda `apikey` y trata cualquier respuesta HTTP como "servidor alcanzable" |
| `app/src/lib/auth/route-access.ts` | `/diagnostico` es ruta pública |
| `app/src/app/login/page.tsx` | El aviso de sin conexión enlaza a `/diagnostico` |
| `app/android/app/build.gradle` | `versionCode` 5 → 6, `versionName` "1.4" → "1.5" |

Tests nuevos: `describe-error.test.ts`, `diagnostics.test.ts`, `use-offline-sync-gate.test.tsx`, `local-store/get-local-store-native.test.ts`
(flush con plugin en "sin red"), caso `onConnectivityRestored` en `net-status.test.ts`.

## Verificación

- `npm test`: 261/261 (183 shared + 37 hub + 41 app).
- `build:app` (exporta `/diagnostico`) y `build:hub` verdes; `cap sync android`;
  `gradlew assembleRelease` BUILD SUCCESSFUL.
- APK: `versionCode 6`, `versionName 1.5`, `application android:name=HospiwasteApp`,
  `allowBackup=false` (leído con `aapt dump`). Firmado con la llave release
  (`keystore.properties` presente).
- **Pendiente en dispositivo**: instalar en los dos teléfonos de planta y abrir
  `/diagnostico` (desde el banner, desde el aviso del login, o desde el enlace). La captura
  de esa pantalla cierra el diagnóstico de los dos problemas.

## Reglas que salen de acá

> [!warning] Ningún `@PluginMethod` puede lanzar
> Capacitor 8 relanza la excepción como `RuntimeException` y el proceso muere. Todo método
> de plugin propio va en try/catch → `call.reject`. Vale también para `startForeground`
> (Android 12+).

> [!warning] `connected` del plugin de red ≠ "nuestro servidor responde"
> Es `NET_CAPABILITY_VALIDATED`: el chequeo de Google. No gatear con eso nada que sea
> barato de intentar (subir la cola, hidratar). Usarlo solo para pintar el indicador.

> [!warning] Enlaces internos siempre con `Link`
> Un `<a href="/ruta">` en el export estático recarga el WebView entero (misma trampa que
> [[2026-09-04-fix-banner-sin-conexion-tras-cancelar-pesaje]]), aunque la ruta exista.

## Decisión operativa pendiente

El DNS de las operadoras venezolanas para el host del proyecto sigue siendo un riesgo
estructural. Opciones, de más inmediata a más estructural: DNS privado en cada teléfono
(`dns.google`) → DNS público en el router de la planta → custom domain de Supabase (no
garantiza nada si el resolver bloquea también el destino del CNAME; hay que probarlo).
