---
title: Sesión no persistente — cookies de sesión
tags:
  - log
  - auth
  - supabase
  - pwa
updated: 2026-06-10
---

# Log 2026-06-10 — La sesión ya no persiste al cerrar la app

## Qué se pidió

Que al cerrar la app (PWA/navegador) la sesión **no quede iniciada**: al reabrir
debe pedir login de nuevo. Antes la sesión sobrevivía porque `@supabase/ssr`
guarda las cookies de auth con `maxAge` de **400 días** (cookies persistentes).

## Qué se hizo

Convertir las cookies de auth en **cookies de sesión** (sin `maxAge`/`expires`),
que el navegador/PWA descarta al cerrarse.

**Gotcha clave:** `@supabase/ssr` **fuerza** `maxAge: DEFAULT_COOKIE_OPTIONS.maxAge`
al persistir el token (`node_modules/@supabase/ssr/dist/main/cookies.js`, en el
`setCookieOptions`), ignorando cualquier `cookieOptions.maxAge` que se pase al
crear el cliente. Por eso no sirve configurar `cookieOptions`: hay que quitar
`maxAge`/`expires` en **nuestros propios `setAll`**.

- Nuevo helper `src/lib/supabase/cookie-session.ts`:
  - `sessionCookieOptions(value, options)`: quita `maxAge`/`expires` **solo cuando
    `value` es no vacío**. En borrados (logout) el valor viene vacío con
    `maxAge: 0` y se respeta, para que la cookie efectivamente se elimine.
  - `readDocumentCookies()` / `writeDocumentCookie()`: I/O de `document.cookie`
    para el browser client, replicando el formato de `cookie.serialize`.
- `client.ts` (browser): se le pasan `cookies.getAll/setAll` propios (antes usaba
  el default). El login ocurre aquí, así que es donde se escribe la cookie inicial.
- `server.ts` y `middleware.ts`: el `setAll` envuelve las options con
  `sessionCookieOptions` (cubre refresh de token en cada request).

Los tres puntos son necesarios: si solo se tocara el server, la cookie persistente
escrita por el browser en el login seguiría viva 400 días.

## Verificación

- `tsc --noEmit`: sin errores en los archivos supabase (los errores de `describe/it`
  son de los tests, preexistentes).
- `next build` OK.
- Pendiente de probar en dispositivo: cerrar la PWA y confirmar que pide login.

## Notas

- En PWA instalada, las cookies de sesión se limpian cuando se cierra la app por
  completo; cambiar de app (sin cerrarla) mantiene la sesión, que es lo deseado.
- El `autoRefreshToken` del browser sigue activo mientras la app está abierta:
  refresca el token y lo reescribe como cookie de sesión, no persistente.

Relacionado: `logs/2026-06-01-roles-coordinador-operador.md`,
`decisions/2026-06-01-roles-acceso.md`.
