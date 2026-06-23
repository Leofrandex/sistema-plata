# Offline PWA Precaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer la PWA navegable y operable sin conexión (navegación entre rutas + guardado de andén offline), verificado en modo avión, como paso previo al APK.

**Architecture:** Se configura el service worker de `next-pwa` con `runtimeCaching` (NetworkFirst para documentos/navegación, StaleWhileRevalidate para chunks/assets) y un fallback de documento offline, de modo que navegar y cargar chunks no dependa de la red. Antes se instrumenta un visor de consola embebido (`eruda`) detrás de una flag para capturar el error real en el dispositivo. El guardado offline (`handleCreateAnden`) ya es local-first; solo se depura si tras el fix de precaching sigue fallando.

**Tech Stack:** Next.js 16 (App Router), next-pwa 5.6 (workbox), IndexedDB (`idb`), Supabase, eruda (visor de consola móvil).

## Global Constraints

- Build con webpack: `npm run build` ejecuta `next build --webpack`. next-pwa **requiere** webpack; no cambiar a turbopack para el build.
- next-pwa está deshabilitado en desarrollo (`disable: process.env.NODE_ENV === 'development'` en `next.config.ts`). El service worker **solo** existe en build de producción → toda verificación de SW se hace contra `npm run build && npm run start`.
- El motor local-first (outbox IndexedDB) ya existe y **no se reimplementa** (`logs/2026-06-19-offline-outbox-campo.md`).
- Edición/cancelación/anulación siguen online por decisión previa — fuera de alcance.
- Idioma de UI: español. Copys nuevos en español.

---

### Task 1: Visor de consola embebido (`eruda`) detrás de flag

Permite ver consola/red en el teléfono en campo, sin cable. Se activa con `?debug=1` (persistido en `localStorage`) para no cargarlo en uso normal.

**Files:**
- Create: `src/components/debug/eruda-loader.tsx`
- Modify: `src/app/layout.tsx` (montar `<ErudaLoader />` en el body)
- Add dep: `eruda`

**Interfaces:**
- Produces: `ErudaLoader` — componente cliente sin props; carga `eruda` dinámicamente solo si `localStorage['hw-debug'] === '1'` o `?debug=1` está en la URL.

- [ ] **Step 1: Instalar eruda**

Run: `npm install eruda`
Expected: `eruda` aparece en `dependencies` de `package.json`.

- [ ] **Step 2: Crear el componente cargador**

Create `src/components/debug/eruda-loader.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

/**
 * Carga eruda (consola embebida) solo cuando se pide explícitamente, para
 * depurar en el teléfono en campo sin cable. Activación:
 *   - URL con `?debug=1`  → persiste la flag y abre la consola
 *   - localStorage['hw-debug'] === '1'
 * Desactivar: `?debug=0` o borrar la clave.
 */
export function ErudaLoader() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const param = params.get('debug')
    if (param === '1') localStorage.setItem('hw-debug', '1')
    if (param === '0') localStorage.removeItem('hw-debug')
    if (localStorage.getItem('hw-debug') !== '1') return
    let cancelled = false
    import('eruda').then((mod) => {
      if (!cancelled) mod.default.init()
    })
    return () => { cancelled = true }
  }, [])
  return null
}
```

- [ ] **Step 3: Montar en el layout raíz**

In `src/app/layout.tsx`, importar y montar `<ErudaLoader />` al final del `<body>` (antes de cerrar). Importar:

```tsx
import { ErudaLoader } from '@/components/debug/eruda-loader'
```

Y dentro del `<body>`, como último hijo:

```tsx
<ErudaLoader />
```

- [ ] **Step 4: Verificar build y lint**

Run: `npm run build && npm run lint`
Expected: build OK (incluye la página y el SW se regenera), lint sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/debug/eruda-loader.tsx src/app/layout.tsx
git commit -m "feat(debug): visor de consola eruda detrás de flag ?debug=1"
```

---

### Task 2: Capturar el error real offline (diagnóstico — gate)

No escribe código de producción. Produce el error documentado que decide si la Task 4 (debug de Falla 2) es necesaria. **Bloquea** hasta tener los errores capturados.

**Files:**
- Create: `docs/superpowers/notes/2026-06-23-offline-repro.md` (notas del operador/tester)

- [ ] **Step 1: Desplegar la build con eruda a un entorno alcanzable**

Desplegar la rama a Vercel (preview) o servir `npm run build && npm run start` en un equipo de la red local accesible desde el teléfono. Anotar la URL.

- [ ] **Step 2: Reproducir Falla 1 (navegación) y capturar**

En el teléfono, abrir la URL con `?debug=1`, iniciar sesión, activar modo avión, navegar `/dashboard` → `/register`. En la consola eruda, copiar el error de la pestaña Console y Network (request que falla y su tipo: documento / RSC / chunk JS).

- [ ] **Step 3: Reproducir Falla 2 (guardado) y capturar**

Con conexión, iniciar un recorrido de andén; activar modo avión; llenar todos los campos (empresa, tachos, foto sucios, foto limpios, firma); pulsar "Guardar andén y agregar otro". Anotar: ¿el botón está deshabilitado o pulsa y no avanza? ¿Aparece error en consola? ¿Qué request falla, si alguno?

- [ ] **Step 4: Documentar y commitear las notas**

Create `docs/superpowers/notes/2026-06-23-offline-repro.md` con: error exacto de cada falla, tipo de request que falla, y conclusión preliminar (¿comparten causa = chunk-loading?).

```bash
git add docs/superpowers/notes/2026-06-23-offline-repro.md
git commit -m "docs(notes): errores reales offline capturados en modo avión"
```

**Gate:** No avanzar a Task 4 sin esto. La Task 3 (precaching) puede hacerse en paralelo, pero su verificación final depende de estas notas.

---

### Task 3: Configurar runtimeCaching + fallback offline en next-pwa

Hace que navegación y carga de chunks no dependan de la red. Usa el set de caché por defecto de next-pwa (estrategias probadas para documentos/JS/CSS/imágenes) más un documento de fallback offline.

**Files:**
- Modify: `next.config.ts`
- Create: `src/app/offline/page.tsx`
- Test: `scripts/check-sw.mjs` (verificación del SW generado)

**Interfaces:**
- Produces: `public/sw.js` regenerado conteniendo handlers de runtimeCaching y la precarga de `/offline`.

- [ ] **Step 1: Crear la página de fallback offline**

Create `src/app/offline/page.tsx`:

```tsx
export default function OfflinePage() {
  return (
    <div className="max-w-md mx-auto py-16 px-6 text-center space-y-3">
      <h1 className="text-xl font-bold text-foreground">Sin conexión</h1>
      <p className="text-sm text-muted-foreground">
        Esta pantalla aún no estaba descargada. Tus registros se guardan en el
        teléfono y se subirán cuando vuelva la señal. Volvé a una pantalla ya
        visitada para seguir trabajando.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Configurar next-pwa con runtimeCaching y fallback**

Modify `next.config.ts` — la llamada a `withPWA` pasa a:

```ts
export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Set de estrategias por defecto de next-pwa: NetworkFirst para documentos y
  // recursos cross-origin, StaleWhileRevalidate para JS/CSS/_next static, caché
  // de imágenes y fuentes. Cubre la navegación y la carga de chunks offline.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  runtimeCaching: require('next-pwa/cache'),
  // Cachea las páginas al navegar por la app (no solo al recargar) → arranque
  // en frío y navegación a rutas ya visitadas funcionan offline.
  cacheOnFrontEndNav: true,
  // Recarga al recuperar conexión para tomar la última versión.
  reloadOnOnline: true,
  // Documento servido cuando una navegación offline no tiene caché.
  fallbacks: { document: '/offline' },
})(nextConfig)
```

- [ ] **Step 3: Regenerar el SW**

Run: `npm run build`
Expected: build OK; `public/sw.js` se regenera con timestamp nuevo.

- [ ] **Step 4: Escribir el verificador del SW generado**

Create `scripts/check-sw.mjs`:

```js
import { readFileSync } from 'node:fs'

const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const checks = [
  ['NetworkFirst handler', /NetworkFirst/],
  ['StaleWhileRevalidate handler', /StaleWhileRevalidate/],
  ['offline fallback precache', /offline/],
]
let ok = true
for (const [name, re] of checks) {
  const present = re.test(sw)
  console.log(`${present ? 'PASS' : 'FAIL'}  ${name}`)
  if (!present) ok = false
}
process.exit(ok ? 0 : 1)
```

- [ ] **Step 5: Correr el verificador**

Run: `node scripts/check-sw.mjs`
Expected: las 3 líneas en `PASS`, exit 0. (Si `offline` falla, revisar que `fallbacks.document` apunte a una ruta que exista y se precachee.)

- [ ] **Step 6: Commit**

```bash
git add next.config.ts src/app/offline/page.tsx scripts/check-sw.mjs public/sw.js public/workbox-*.js
git commit -m "feat(pwa): runtimeCaching + fallback offline para navegación sin red"
```

---

### Task 4: Depurar Falla 2 si persiste (condicional)

**Solo si** tras Task 3, la verificación manual (Task 5) muestra que guardar un andén nuevo offline sigue bloqueado. Entra `systematic-debugging` con el error de las notas de Task 2.

**Files:**
- Modify: el archivo que las notas señalen (candidato principal: `src/app/register/route/anden/[slot]/page.tsx`; o `src/lib/data/photos.ts` / `src/lib/offline-queue.ts`).
- Test: `src/__tests__/` (test de regresión del camino de guardado offline).

**Interfaces:**
- Consumes: error documentado en `docs/superpowers/notes/2026-06-23-offline-repro.md`.

- [ ] **Step 1: Invocar systematic-debugging**

Usar la skill `superpowers:systematic-debugging` con el error capturado. Formular hipótesis (candidatos acotados): excepción en `enqueueEventPhotos`/`putPhotoBlob`; `canSaveAnden` queda `false` porque una foto/firma no se registró offline; chunk lazy de cámara/firma no cacheado (si es esto, ya lo arregla Task 3 → no debería persistir).

- [ ] **Step 2: Escribir test de regresión que falle**

Reproducir el fallo en un test Jest (con `fake-indexeddb`, ya en devDependencies) sobre el camino de guardado/encolado. Mostrar el test concreto una vez identificada la causa raíz.

- [ ] **Step 3: Verificar que el test falla**

Run: `npm run test:jest -- <archivo-del-test>`
Expected: FAIL reproduciendo el síntoma.

- [ ] **Step 4: Implementar el fix mínimo**

Aplicar la corrección puntual en el archivo señalado por la causa raíz.

- [ ] **Step 5: Verificar test verde + suite completa**

Run: `npm run test:jest`
Expected: el test nuevo PASA y la suite completa queda verde.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(offline): <causa raíz del guardado bloqueado en modo avión>"
```

---

### Task 5: Verificación E2E manual en modo avión (gate de cierre)

**Files:** ninguno (verificación). Marca el cierre del proyecto.

- [ ] **Step 1: Desplegar la build final y abrir en el teléfono**

Desplegar la rama (preview Vercel o `npm run start` en red local). Abrir, iniciar sesión, dejar que cargue una vez con conexión.

- [ ] **Step 2: Ejecutar el checklist offline**

Activar modo avión y verificar:
- [ ] Navegar entre rutas offline (dashboard ↔ registro ↔ tachos).
- [ ] **Arranque en frío:** cerrar la app por completo y reabrir en modo avión → carga.
- [ ] Crear recorrido + 2 andenes consecutivos sin red (la pantalla avanza y los muestra).
- [ ] Recargar la app a mitad (con pendientes) → los registros locales no desaparecen.

- [ ] **Step 3: Reconectar y verificar drenaje**

Desactivar modo avión:
- [ ] El indicador de sync baja a 0 pendientes.
- [ ] En Supabase (tabla `route_events` + `route_event_containers_*` + `photos`): los 2 andenes y sus fotos están, **sin duplicados**.

- [ ] **Step 4: Registrar el resultado**

Si todo pasa: el offline de la PWA queda verificado y habilita el proyecto del APK. Documentar en el log de cierre (ver Handoff).

---

## Self-Review

**Spec coverage:**
- Fase 0 (reproducir + capturar) → Task 2 (+ Task 1 que la habilita). ✓
- Fase 1 (precaching) → Task 3. ✓
- Fase 2 (Falla 2 condicional) → Task 4. ✓
- Verificación gate de cierre → Task 5. ✓
- Fuera de alcance (APK, edición offline) → no hay tareas, correcto. ✓

**Placeholder scan:** Task 4 es intencionalmente condicional y sus pasos 2/4 dependen de la causa raíz capturada en Task 2 — no es un placeholder evitable, es un debug guiado por evidencia (la skill systematic-debugging lo gobierna). El resto tiene contenido concreto.

**Type consistency:** `ErudaLoader` (Task 1) sin props, montado en layout. `next-pwa/cache`, `cacheOnFrontEndNav`, `reloadOnOnline`, `fallbacks.document` son opciones reales de next-pwa 5.6. `scripts/check-sw.mjs` lee `public/sw.js`. Consistente.

---

## Nota de cierre del vault

Al completar Task 5, crear `logs/2026-06-23-offline-pwa-precaching.md` y actualizar la fila correspondiente en `vault/_index.md` (regla de mantenimiento del vault). El APK con Capacitor queda como spec/proyecto siguiente.
