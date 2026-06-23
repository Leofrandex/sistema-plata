# Diseño — APK Android con Capacitor (offline robusto para campo)

**Fecha:** 2026-06-23
**Estado:** Aprobado (brainstorming) — pendiente de plan de implementación
**Alcance:** Empaquetar la app Hospiwaste como APK Android offline-first con Capacitor, reusando el motor local-first existente. Sustituye el intento de PWA-offline (que falló: el service worker no intercepta la navegación → "dinosaurio" de Chrome sin red).

---

## Contexto y motivación

La conexión en campo es muy inestable. El intento de resiliencia offline vía PWA + `next-pwa`
(`logs/2026-06-23-...` / spec `2026-06-23-offline-pwa-precaching-design.md`) **no resolvió** la
navegación offline: sin red, navegar entre rutas muestra el dinosaurio de Chrome (el service worker
no sirve el fallback). Decisión tomada: empaquetar en **APK con Capacitor**, que mete los assets
*dentro* del `.apk` y los carga desde el sistema de archivos local — no depende de service worker ni
de una URL alcanzable, así que el problema desaparece de raíz.

El motor offline local-first ya existe (`logs/2026-06-19-offline-outbox-campo.md`): outbox en
IndexedDB (`hospiwaste-offline`), blobs de foto, cola idempotente con drenaje al reconectar. **No se
reimplementa**; se reusa tal cual dentro del WebView.

### Decisiones del brainstorming

- **Distribución:** sideload directo (APK firmado, sin Google Play). Requiere keystore, no cuenta de
  desarrollador.
- **Sesión:** efímera — logout al cerrar la app + auto-logout por inactividad de 1h (mantiene el
  comportamiento actual de teléfonos compartidos / login por tarjeta del 2026-06-19).
- **Build:** local con Android Studio + JDK en Windows.
- **Wrapper:** Capacitor + export estático de Next.js. (Descartados: TWA/Bubblewrap — sigue
  dependiendo del service worker, no empaqueta assets, el dinosaurio persistiría; rewrite nativo —
  tira una app que funciona, YAGNI.)
- **Build unificado (Opción A):** se elimina middleware/SSR en toda la app; el mismo export estático
  se sube a Vercel como sitio estático y se envuelve con Capacitor. Un solo modelo de auth, una sola
  base. (Descartada Opción B — dos configs de build, duplica el modelo de auth y arriesga
  divergencia.)

## Superficie server-side actual (lo que el export estático fuerza a cambiar)

- `src/middleware.ts` → refresca la sesión de Supabase en el servidor (cookies). Export estático
  **no soporta middleware**.
- `src/app/auth/signout/route.ts` → route handler (servidor). Export estático **no soporta route
  handlers**.
- `src/lib/supabase/client.ts` → `createBrowserClient` de `@supabase/ssr` con **cookies de sesión**
  (sin `maxAge`/`expires`): la sesión se pierde al cerrar la app. Esta semántica hay que
  reproducirla sin cookies/servidor.
- `src/lib/supabase/server.ts` + `src/lib/supabase/middleware.ts` → clientes server-side, quedan
  obsoletos tras la migración.
- El resto de la app ya es client-side (`'use client'` + Zustand + Supabase browser client), así que
  el export estático es viable una vez resuelta la auth.

---

## Diseño por componentes

### 1. Shell Capacitor (proyecto Android)

- Inicializar Capacitor (`@capacitor/core`, `@capacitor/cli`) y configurar `webDir` apuntando al
  directorio del export estático de Next.js (`out/`).
- `npx cap add android` genera el proyecto Android nativo.
- Plugins mínimos:
  - `@capacitor/app` — eventos de ciclo de vida (`appStateChange`) para el logout-al-cerrar y para
    drenar el outbox al volver a foreground.
  - `@capacitor/network` — estado de red para el indicador de sync (complementa/observa
    `navigator.onLine`, que también funciona en el WebView).
- **Cámara y firma:** se mantienen el `<input capture>` y el canvas web actuales — funcionan en el
  WebView. Migrar a `@capacitor/camera` queda **fuera de alcance** salvo que la captura web falle en
  el dispositivo (se decide en verificación).

### 2. Export estático de Next.js

- `output: 'export'` en `next.config.ts`. `images.unoptimized: true` (el optimizador de imágenes de
  Next no corre en export estático; las URLs firmadas de Supabase se sirven directo).
- Eliminar `src/middleware.ts` y `src/app/auth/signout/route.ts` (incompatibles con export).
- Quitar el wrapper `next-pwa` del build del APK: dentro del APK los assets ya son locales, no hace
  falta service worker, y `next-pwa` choca con `output: 'export'`.
- Verificar que ninguna página use APIs de servidor (server components con `cookies()`/`headers()`,
  server actions). El relevamiento indica que todo es client-side; confirmar en implementación.

### 3. Migración de auth a cliente puro *(componente de mayor riesgo)*

**Cliente Supabase:** reemplazar `createBrowserClient` (cookies) por `createClient` de
`@supabase/supabase-js` con un **storage adapter sobre `window.sessionStorage`** y
`autoRefreshToken: true`, `persistSession: true`. `sessionStorage` reproduce *exactamente* la
semántica de "cookie de sesión" en web y en WebView (sobrevive recargas de página; se borra al
cerrar la pestaña / destruir el WebView). Un storage puramente en memoria NO sirve: perdería la
sesión en cada recarga.

- App viva (foreground o segundo plano con proceso retenido) → sesión intacta, incluso si recarga.
- App cerrada o matada por el SO (común en teléfonos de gama baja con poca RAM) → `sessionStorage` se
  borra → sin sesión → login al reabrir. Equivale al comportamiento actual.

**Auto-logout 1h:** timer de inactividad reseteado por interacción del usuario; al expirar,
`supabase.auth.signOut()` + redirección a `/login`. (Reusar/portar la lógica del
`logs/2026-06-19-login-tarjetas-auto-logout-operador.md`, que hoy vive acoplada al modelo de
cookies.)

**Guard de rutas en cliente** (reemplaza al middleware): un provider montado en el layout raíz que
lee la sesión y redirige a `/login` si no hay. Cuelga del `currentProfileId` que ya existe en el
store.

**Signout:** reemplazar el route handler por una llamada cliente `supabase.auth.signOut()` desde el
botón de cerrar sesión.

**Limpieza:** eliminar `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts` y
`src/lib/supabase/cookie-session.ts` una vez migrado.

### 4. Reuso del outbox offline (sin cambios mayores)

IndexedDB (`hospiwaste-offline`) ya funciona en el WebView y, dentro de un APK, es durable (el SO no
lo desaloja como a una PWA de navegador). El motor local-first del 2026-06-19 (`offline-queue`,
`outbox-sync`, `use-offline-sync`, `field-writes`, `enqueueEventPhotos`, `hydrate-merge`) se reusa
tal cual. El hook de sync se complementa con el evento `appStateChange` de `@capacitor/app` para
drenar al volver a foreground.

*Fuera de alcance:* mover blobs de foto de IndexedDB a `@capacitor/filesystem` (solo si el volumen lo
exige; hoy ~50 fotos, tolerable).

### 5. Build firmado + sideload

- `npm run build` (con `output: 'export'`) → genera `out/`.
- `npx cap sync android` copia `out/` al proyecto Android.
- Generar un **keystore** de release (documentar el comando y guardar la clave de forma segura —
  fuera del repo).
- `assembleRelease` en Android Studio / Gradle → APK firmado.
- Distribuir el `.apk` por link/USB; el operador habilita "orígenes desconocidos" e instala.
- Documentar el ciclo "cambié código → regenerar APK" como script/checklist repetible.

---

## Flujo de datos (sin cambios respecto al actual)

Operador actúa offline → escritura local-first encola en outbox (IndexedDB) + refleja en store
Zustand (UI avanza al instante) → al recuperar red (evento de red o `appStateChange`), `drainOutbox`
sube a Supabase con upsert idempotente por id de cliente. La auth en memoria provee el
`operator_id`; si la app se cerró, la cola sobrevive en IndexedDB y drena en el próximo login.

## Manejo de errores

- **Sin sesión al drenar:** la cola espera; drena en el próximo login (comportamiento actual).
- **App matada por el SO con pendientes:** IndexedDB persiste; al reabrir y loguear, drena.
- **Captura de foto falla en el WebView:** se evalúa en verificación; fallback a `@capacitor/camera`
  solo si ocurre.

## Verificación (gate de cierre)

E2E manual en el APK instalado, en modo avión:

- [ ] Arranque en frío sin red → la app carga (sin dinosaurio).
- [ ] Login con red → navegación offline entre todas las rutas.
- [ ] Crear recorrido + 2 andenes + pesaje offline → la UI avanza y los muestra.
- [ ] Cerrar la app (matarla) → al reabrir pide login (sesión efímera) y los pendientes locales
      siguen.
- [ ] Reconectar → outbox drena a 0; en Supabase, sin duplicados.
- [ ] Auto-logout: dejar 1h inactivo → vuelve a `/login`.
- [ ] Captura de foto y firma funcionan en el dispositivo real.

## Fuera de alcance

- `@capacitor/camera` / `@capacitor/filesystem` nativos (solo si la versión web falla).
- Publicación en Google Play (es sideload).
- Edición/cancelación/anulación offline (siguen online por decisión previa).
- Push notifications, deep links, actualizaciones OTA.

## Riesgos / notas

- **Auth (sección 3) es el mayor riesgo:** cambia el modelo de sesión en toda la app (web incluida,
  por Opción A). La semántica "logout al cerrar" depende de cómo el SO retiene/mata el proceso del
  WebView; verificar en dispositivo real, no solo en emulador.
- **Doblez de destino:** el mismo export estático va a Vercel (web) y al APK. Confirmar que el
  dashboard de coordinadores en web sigue usable con auth en cliente.
- **Keystore:** perder la clave de firma impide publicar updates que el dispositivo acepte como la
  misma app; documentar su resguardo.
