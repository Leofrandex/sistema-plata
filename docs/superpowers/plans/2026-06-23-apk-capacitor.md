# APK Android con Capacitor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empaquetar Hospiwaste como APK Android offline-first con Capacitor, migrando la auth de SSR/cookies a cliente puro para permitir export estático.

**Architecture:** Se elimina toda la superficie server-side (middleware, route handler de signout, clientes server) y se mueve el auth gate a un guard de cliente; el cliente Supabase pasa a `supabase-js` con sesión en `sessionStorage`. Con eso la app exporta estática (`output: 'export'`), Capacitor empaqueta `out/` dentro del APK, y el motor offline IndexedDB existente se reusa sin cambios.

**Tech Stack:** Next.js 16 (App Router, static export), @supabase/supabase-js, Capacitor 6 (@capacitor/core, /cli, /app, /network), IndexedDB (`idb`), Android Studio + JDK.

## Global Constraints

- Build es `npm run build`; tras la Task 4 produce un export estático en `out/`. next-pwa se elimina del build.
- El export estático **prohíbe** middleware, route handlers y server components con `cookies()`/`headers()`.
- La sesión es **efímera**: backing en `window.sessionStorage` (sobrevive recargas, se borra al cerrar/destruir el WebView). Auto-logout absoluto a 60 min ya existe (`SESSION_DURATION_MS` en `src/lib/session-timeout.ts`); se reusa, no se reimplementa.
- El export `createClient()` de `src/lib/supabase/client.ts` debe conservar su firma (`() => SupabaseClient<Database>`): 30+ archivos lo importan.
- Opción A: el mismo build sirve web (Vercel estático) y APK. El cambio de auth afecta también a la web.
- UI en español; copys nuevos en español.
- Reusar el outbox offline existente (`src/lib/offline-queue.ts`, `outbox-sync.ts`, `use-offline-sync.ts`, `field-writes.ts`); no reimplementar.
- Tests: lógica con Jest (`npm run test:jest`), entorno jsdom.

---

### Task 1: Cliente Supabase con sesión en sessionStorage

Reemplaza el cliente basado en cookies/`@supabase/ssr` por `supabase-js` con storage en `sessionStorage`. El adapter se aísla en su propio módulo para poder testearlo.

**Files:**
- Create: `src/lib/supabase/session-storage.ts`
- Modify: `src/lib/supabase/client.ts` (reescritura completa)
- Test: `src/__tests__/lib/supabase-session-storage.test.ts`

**Interfaces:**
- Produces: `sessionStorageAdapter` — objeto con `getItem(key: string): string | null`, `setItem(key, value): void`, `removeItem(key): void`. Usa `window.sessionStorage`; fallback a un `Map` en memoria si `window` no existe.
- Produces: `createClient(): SupabaseClient<Database>` (firma sin cambios; ahora singleton sobre `supabase-js`).

- [ ] **Step 1: Escribir el test del adapter**

Create `src/__tests__/lib/supabase-session-storage.test.ts`:

```ts
import { sessionStorageAdapter } from '@/lib/supabase/session-storage'

describe('sessionStorageAdapter', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('persiste y lee un valor', () => {
    sessionStorageAdapter.setItem('k', 'v')
    expect(sessionStorageAdapter.getItem('k')).toBe('v')
  })

  it('devuelve null para una clave ausente', () => {
    expect(sessionStorageAdapter.getItem('missing')).toBeNull()
  })

  it('elimina un valor', () => {
    sessionStorageAdapter.setItem('k', 'v')
    sessionStorageAdapter.removeItem('k')
    expect(sessionStorageAdapter.getItem('k')).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npm run test:jest -- supabase-session-storage`
Expected: FAIL — módulo `session-storage` no existe.

- [ ] **Step 3: Implementar el adapter**

Create `src/lib/supabase/session-storage.ts`:

```ts
/**
 * Storage para la sesión de Supabase respaldado en `window.sessionStorage`:
 * sobrevive recargas de página y se borra al cerrar la pestaña o destruir el
 * WebView (semántica de "cookie de sesión"). Fallback en memoria cuando no hay
 * `window` (no debería ocurrir en export estático, pero evita romper en SSR).
 */
const memory = new Map<string, string>()

export const sessionStorageAdapter = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return memory.get(key) ?? null
    return window.sessionStorage.getItem(key)
  },
  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') { memory.set(key, value); return }
    window.sessionStorage.setItem(key, value)
  },
  removeItem(key: string): void {
    if (typeof window === 'undefined') { memory.delete(key); return }
    window.sessionStorage.removeItem(key)
  },
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `npm run test:jest -- supabase-session-storage`
Expected: PASS (3/3).

- [ ] **Step 5: Reescribir el cliente**

Replace the entire contents of `src/lib/supabase/client.ts` with:

```ts
'use client'

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { sessionStorageAdapter } from './session-storage'

/**
 * Cliente Supabase de cliente puro (sin servidor/middleware). La sesión vive en
 * `sessionStorage` y `supabase-js` la refresca sola (`autoRefreshToken`).
 * Singleton para no crear múltiples GoTrueClient.
 */
let client: SupabaseClient<Database> | null = null

export function createClient(): SupabaseClient<Database> {
  if (client) return client
  client = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        storage: sessionStorageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }
  )
  return client
}
```

- [ ] **Step 6: Verificar typecheck/lint del cliente**

Run: `npm run lint`
Expected: sin errores nuevos en `client.ts` / `session-storage.ts`. (No correr build aún: el build estático llega en Task 4; ahora coexisten middleware y el cliente nuevo.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/session-storage.ts src/lib/supabase/client.ts src/__tests__/lib/supabase-session-storage.test.ts
git commit -m "feat(auth): cliente Supabase con sesión en sessionStorage (cliente puro)"
```

---

### Task 2: Logout en cliente (eliminar el route handler)

Los 3 botones de logout hoy hacen `POST /auth/signout` (route handler de servidor). En export estático no existe; se reemplazan por una llamada cliente.

**Files:**
- Create: `src/lib/auth/sign-out.ts`
- Modify: `src/components/layout/mobile-header.tsx:54`, `src/components/layout/sidebar.tsx:141`, `src/components/layout/mobile-bottom-nav.tsx:167`
- Delete: `src/app/auth/signout/route.ts`
- Test: `src/__tests__/lib/sign-out.test.ts`

**Interfaces:**
- Consumes: `createClient()` (Task 1), `clearLoginAt()` (de `src/lib/session-timeout.ts`).
- Produces: `signOut(): Promise<void>` — cierra sesión en Supabase y limpia `login_at`.

- [ ] **Step 1: Escribir el test de `signOut`**

Create `src/__tests__/lib/sign-out.test.ts`:

```ts
import { signOut } from '@/lib/auth/sign-out'

const mockSignOut = jest.fn().mockResolvedValue({ error: null })
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}))
const mockClearLoginAt = jest.fn()
jest.mock('@/lib/session-timeout', () => ({ clearLoginAt: () => mockClearLoginAt() }))

describe('signOut', () => {
  beforeEach(() => { mockSignOut.mockClear(); mockClearLoginAt.mockClear() })

  it('cierra sesión en Supabase y limpia login_at', async () => {
    await signOut()
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockClearLoginAt).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npm run test:jest -- sign-out`
Expected: FAIL — `@/lib/auth/sign-out` no existe.

- [ ] **Step 3: Implementar el helper**

Create `src/lib/auth/sign-out.ts`:

```ts
import { createClient } from '@/lib/supabase/client'
import { clearLoginAt } from '@/lib/session-timeout'

/** Cierra la sesión en cliente y limpia el ancla de auto-logout. */
export async function signOut(): Promise<void> {
  await createClient().auth.signOut()
  clearLoginAt()
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `npm run test:jest -- sign-out`
Expected: PASS (1/1).

- [ ] **Step 5: Convertir los 3 formularios de logout**

En cada uno de los 3 archivos, leer el archivo, y reemplazar el wrapper
`<form action="/auth/signout" method="post" ...>{children}</form>` por un `<button>` que ya envuelve
(o un `onClick` sobre el botón existente) llamando al helper y redirigiendo. El componente ya es
client (`'use client'`). Patrón exacto a aplicar (conservando los `children`/clases del botón
interno tal cual):

```tsx
// 1) imports (agregar al inicio del archivo):
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth/sign-out'

// 2) dentro del componente:
const router = useRouter()
async function handleSignOut() {
  await signOut()
  router.replace('/login')
}

// 3) reemplazo del wrapper <form>…</form>: el contenido interno (el botón con su
//    ícono/label) se conserva igual, pero el submit pasa a onClick:
//    ANTES:  <form action="/auth/signout" method="post" onSubmit={() => clearLoginAt()}>
//              <button …>…</button>
//            </form>
//    DESPUÉS: <button … onClick={handleSignOut}>…</button>
```

Quitar imports que queden sin uso (p. ej. `clearLoginAt` si ya no se usa directamente en el
componente). `mobile-bottom-nav.tsx:167` no tenía `onSubmit`; igual se convierte a `onClick`.

- [ ] **Step 6: Borrar el route handler**

```bash
git rm src/app/auth/signout/route.ts
```

- [ ] **Step 7: Verificar lint y suite**

Run: `npm run lint && npm run test:jest`
Expected: lint sin errores nuevos; suite verde (incluye el test nuevo de `signOut`).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(auth): logout en cliente; eliminar route handler /auth/signout"
```

---

### Task 3: AuthGuard de cliente (reemplazar el gate del middleware)

El middleware hoy: refresca sesión, redirige sin-sesión a `/login`, redirige con-sesión fuera de `/login`, y bloquea a operadores en rutas de coordinador. La sesión la refresca `supabase-js` solo; lo demás pasa a un guard de cliente. La lógica de permisos por ruta se aísla y se testea.

**Files:**
- Create: `src/lib/auth/route-access.ts`
- Create: `src/components/layout/auth-guard.tsx`
- Modify: `src/app/layout.tsx` (montar `<AuthGuard>` envolviendo el shell)
- Delete: `src/middleware.ts`
- Test: `src/__tests__/lib/route-access.test.ts`

**Interfaces:**
- Consumes: `createClient()` (Task 1); `useStore` `currentRole` (de `src/lib/store.ts`).
- Produces: `isPublicPath(pathname: string): boolean`, `isOperatorAllowed(pathname: string): boolean` (portadas verbatim del middleware).
- Produces: `AuthGuard({ children }: { children: React.ReactNode })` — componente cliente que aplica los redirects y renderiza `children`.

- [ ] **Step 1: Escribir el test de permisos por ruta**

Create `src/__tests__/lib/route-access.test.ts`:

```ts
import { isPublicPath, isOperatorAllowed } from '@/lib/auth/route-access'

describe('isPublicPath', () => {
  it('marca /login y /auth como públicas', () => {
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/auth/callback')).toBe(true)
  })
  it('marca el resto como privadas', () => {
    expect(isPublicPath('/dashboard')).toBe(false)
  })
})

describe('isOperatorAllowed', () => {
  it('permite rutas de operador y sus hijas', () => {
    expect(isOperatorAllowed('/dashboard')).toBe(true)
    expect(isOperatorAllowed('/register/route/anden/06:30')).toBe(true)
  })
  it('bloquea rutas de coordinador', () => {
    expect(isOperatorAllowed('/reports')).toBe(false)
    expect(isOperatorAllowed('/admin/containers')).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npm run test:jest -- route-access`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar la lógica de permisos**

Create `src/lib/auth/route-access.ts` (portado de `src/lib/supabase/middleware.ts`):

```ts
/** Rutas públicas (no requieren sesión). */
const PUBLIC_PATHS = ['/login', '/auth']

/** Rutas a las que puede entrar un operador. El resto es de coordinador. */
const OPERATOR_PATHS = [
  '/dashboard',
  '/register/route',
  '/register/weighing',
  '/register/treatment',
]

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function isOperatorAllowed(pathname: string): boolean {
  return OPERATOR_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `npm run test:jest -- route-access`
Expected: PASS (4/4).

- [ ] **Step 5: Implementar el AuthGuard**

Create `src/components/layout/auth-guard.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useStore } from '@/lib/store'
import { isPublicPath, isOperatorAllowed } from '@/lib/auth/route-access'

/**
 * Gate de acceso en cliente (reemplaza al middleware, que no existe en export
 * estático). Sin sesión → /login?next=…; con sesión en /login → /dashboard;
 * operador en ruta de coordinador → /dashboard. La sesión la refresca
 * `supabase-js` (autoRefreshToken); aquí solo se decide la navegación.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const role = useStore((s) => s.currentRole)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  // Estado de sesión: consulta inicial + suscripción a cambios.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Redirects según sesión y rol.
  useEffect(() => {
    if (hasSession === null) return // aún resolviendo
    const onPublic = isPublicPath(pathname)
    if (!hasSession && !onPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    if (hasSession && pathname === '/login') {
      router.replace('/dashboard')
      return
    }
    if (hasSession && !onPublic && role === 'operator' && !isOperatorAllowed(pathname)) {
      router.replace('/dashboard')
    }
  }, [hasSession, pathname, role, router])

  return <>{children}</>
}
```

- [ ] **Step 6: Montar el guard y borrar el middleware**

In `src/app/layout.tsx`, importar `AuthGuard` y envolver el contenido del `<body>` (todo lo que hoy está dentro de `<body>`, desde `<SWCleanup />` hasta `<ErudaLoader />`) con `<AuthGuard>…</AuthGuard>`. Luego:

```bash
git rm src/middleware.ts
```

- [ ] **Step 7: Verificar lint y suite**

Run: `npm run lint && npm run test:jest`
Expected: lint sin errores nuevos; suite verde.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(auth): AuthGuard de cliente; eliminar middleware SSR"
```

---

### Task 4: Export estático + limpieza de archivos server

Activa `output: 'export'`, quita next-pwa, agrega `generateStaticParams` a la ruta dinámica, y elimina los archivos server ya obsoletos. Primer build estático verde.

**Files:**
- Modify: `next.config.ts`
- Modify: `src/app/register/route/anden/[slot]/page.tsx` (agregar `generateStaticParams`)
- Delete: `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `src/lib/supabase/cookie-session.ts`

**Interfaces:**
- Consumes: nada nuevo. Produces: directorio `out/` con el sitio estático.

- [ ] **Step 1: Reescribir `next.config.ts`**

Replace the entire contents with:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    // El optimizador de imágenes de Next no corre en export estático.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/**' },
    ],
  },
  transpilePackages: ['@react-pdf/renderer'],
}

export default nextConfig
```

- [ ] **Step 2: Agregar `generateStaticParams` a la ruta dinámica**

El export estático exige enumerar los params de `[slot]`. In `src/app/register/route/anden/[slot]/page.tsx`, agregar (junto al `VALID_SLOTS` ya existente) una export de servidor para los params:

```tsx
// Export estático: enumerar los 6 horarios fijos de la ruta.
export function generateStaticParams() {
  return ['06:30', '10:30', '13:20', '14:30', '18:30', '21:00'].map((slot) => ({ slot }))
}
```

Nota: `generateStaticParams` se evalúa en build (no rompe el `'use client'` de la página; Next lo permite como export nombrado del módulo de página).

- [ ] **Step 3: Borrar los archivos server obsoletos**

```bash
git rm src/lib/supabase/server.ts src/lib/supabase/middleware.ts src/lib/supabase/cookie-session.ts
```

- [ ] **Step 4: Verificar que nada importe los archivos borrados**

Run: `npx grep -r "supabase/server\|supabase/middleware\|cookie-session" src || true` (o búsqueda equivalente).
Expected: sin resultados. Si aparece alguno (además del propio `client.ts` que ya no debe importarlos), corregir el import antes de seguir.

- [ ] **Step 5: Build estático**

Run: `npm run build`
Expected: build OK; se genera `out/` con `index.html`/rutas. Si falla por una página que usa APIs de servidor, convertir esa página a client-only (el relevamiento dice que no hay, pero confirmar aquí).

- [ ] **Step 6: Verificar el export**

Run: `node -e "const fs=require('fs');if(!fs.existsSync('out/index.html'))process.exit(1);console.log('out/ OK')"`
Expected: `out/ OK`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(build): export estático (output: export), sin next-pwa ni archivos server"
```

---

### Task 5: Inicializar Capacitor + proyecto Android + ciclo de vida

Configura Capacitor sobre `out/`, agrega el proyecto Android, y cablea el drenaje del outbox al volver a foreground. **Requiere Android SDK/Android Studio para `cap add android`**; si no está disponible, completar hasta `cap init`/config y marcar el resto como BLOCKED con el motivo.

**Files:**
- Create: `capacitor.config.ts`
- Create: `src/components/layout/app-lifecycle.tsx`
- Modify: `src/app/layout.tsx` (montar `<AppLifecycle />`)
- Modify: `package.json` (deps Capacitor)
- Create (generado): carpeta `android/`

**Interfaces:**
- Consumes: el evento `hospiwaste:outbox-changed` que ya dispara el drenaje (ver `src/hooks/use-offline-sync.ts`).
- Produces: `AppLifecycle` — componente cliente que, en plataforma nativa, drena el outbox al volver a foreground.

- [ ] **Step 1: Instalar Capacitor**

Run: `npm install @capacitor/core @capacitor/app @capacitor/network && npm install -D @capacitor/cli`
Expected: deps agregadas a `package.json`.

- [ ] **Step 2: Crear `capacitor.config.ts`**

Create `capacitor.config.ts` en la raíz:

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.hospiwaste.app',
  appName: 'Hospiwaste',
  webDir: 'out',
}

export default config
```

- [ ] **Step 3: Implementar el componente de ciclo de vida**

Create `src/components/layout/app-lifecycle.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

/**
 * En el APK (Capacitor), drena el outbox al volver la app a primer plano
 * disparando el evento que ya escucha `use-offline-sync`. En web es no-op.
 */
export function AppLifecycle() {
  useEffect(() => {
    let cleanup: (() => void) | undefined
    Promise.all([import('@capacitor/core'), import('@capacitor/app')])
      .then(([{ Capacitor }, { App }]) => {
        if (!Capacitor.isNativePlatform()) return
        const handle = App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) window.dispatchEvent(new Event('hospiwaste:outbox-changed'))
        })
        cleanup = () => { handle.then((h) => h.remove()) }
      })
      .catch(() => { /* @capacitor no disponible (web): no-op */ })
    return () => cleanup?.()
  }, [])
  return null
}
```

- [ ] **Step 4: Montar `<AppLifecycle />` en el layout**

In `src/app/layout.tsx`, importar y montar `<AppLifecycle />` junto a los otros componentes de shell (p. ej. tras `<SupabaseHydrator />`), dentro del `<AuthGuard>`.

- [ ] **Step 5: Verificar build estático con Capacitor presente**

Run: `npm run build`
Expected: build OK (el import dinámico de `@capacitor/*` no debe romper el export; es client-only y lazy).

- [ ] **Step 6: Agregar el proyecto Android** *(requiere Android SDK)*

Run: `npx cap add android && npx cap sync android`
Expected: se crea `android/` y se copia `out/`. Si falla por falta de SDK/JDK: marcar BLOCKED, reportar el comando y el error; las Steps 7-8 quedan pendientes de tooling.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(capacitor): init + proyecto android + drenaje al volver a foreground"
```

---

### Task 6: Firmar y empaquetar el APK (sideload)

Documenta y ejecuta la generación del keystore y del APK firmado. **Requiere Android Studio/Gradle.** Producto: un `.apk` instalable + un checklist repetible.

**Files:**
- Create: `docs/apk-build.md`

- [ ] **Step 1: Generar el keystore de release**

Run (documentar el comando, guardar la clave FUERA del repo):
`keytool -genkey -v -keystore hospiwaste-release.keystore -alias hospiwaste -keyalg RSA -keysize 2048 -validity 10000`
Expected: archivo `.keystore` creado. **No** commitearlo (agregar `*.keystore` a `.gitignore`).

- [ ] **Step 2: Configurar el signing en Gradle**

En `android/app/build.gradle`, agregar el `signingConfig` de release apuntando al keystore (documentar en `docs/apk-build.md` los valores exactos y de dónde leer la contraseña, p. ej. variable de entorno o `local.properties` no versionado).

- [ ] **Step 3: Generar el APK firmado**

Run: `cd android && ./gradlew assembleRelease`
Expected: `android/app/build/outputs/apk/release/app-release.apk`.

- [ ] **Step 4: Escribir el checklist de build**

Create `docs/apk-build.md` con el ciclo repetible: `npm run build` → `npx cap sync android` → `./gradlew assembleRelease` → distribuir el `.apk`. Incluir cómo instala el operador (habilitar "orígenes desconocidos").

- [ ] **Step 5: Commit**

```bash
git add docs/apk-build.md .gitignore android/app/build.gradle
git commit -m "docs(apk): keystore, firma y checklist de build/sideload"
```

---

### Task 7: Verificación E2E en dispositivo (gate de cierre, HUMANO)

**Files:** ninguno. Requiere instalar el `.apk` en un teléfono real.

- [ ] **Step 1: Instalar el APK en un teléfono**

Pasar el `.apk` por link/USB; habilitar "orígenes desconocidos"; instalar.

- [ ] **Step 2: Checklist offline (modo avión)**

- [ ] Arranque en frío sin red → la app carga (sin dinosaurio).
- [ ] Login con red → navegación offline entre todas las rutas.
- [ ] Crear recorrido + 2 andenes + un pesaje offline → la UI avanza y los muestra.
- [ ] Matar la app → al reabrir pide login (sesión efímera) y los pendientes locales siguen.
- [ ] Reconectar → outbox drena a 0; en Supabase, sin duplicados.
- [ ] Dejar 1h inactivo → vuelve a `/login` (auto-logout).
- [ ] Cámara y firma funcionan en el dispositivo real (si fallan → evaluar `@capacitor/camera`, fuera de este plan).

- [ ] **Step 3: Verificación web (Opción A)**

- [ ] El dashboard de coordinadores en la web (Vercel estático) sigue usable: login, navegación, reportes; la sesión sobrevive recargas y se cierra al cerrar la pestaña.

- [ ] **Step 4: Registrar el resultado**

Si pasa: el APK queda listo para distribuir. Crear log del vault (ver Cierre).

---

## Self-Review

**Spec coverage:**
- Shell Capacitor (spec §1) → Task 5. ✓
- Export estático (spec §2) → Task 4 (config + generateStaticParams + borrado de server files). ✓
- Migración de auth (spec §3): cliente sessionStorage → Task 1; signout cliente → Task 2; guard de cliente + borrar middleware → Task 3; limpieza server.ts/middleware.ts/cookie-session.ts → Task 4. ✓
- Reuso del outbox (spec §4) → sin tarea de cambio; Task 5 lo cablea al ciclo de vida. ✓
- Build firmado + sideload (spec §5) → Task 6. ✓
- Verificación (gate) → Task 7. ✓
- Fuera de alcance (camera/filesystem nativos, Play Store, edición offline) → sin tareas. ✓

**Placeholder scan:** Tasks 5-6 dependen de tooling Android (SDK/Gradle); sus steps tienen comandos exactos y un protocolo BLOCKED explícito, no placeholders. Task 7 es verificación humana con checklist concreto. Resto con código completo.

**Type consistency:** `createClient(): SupabaseClient<Database>` (Task 1) se conserva para todos los consumidores. `sessionStorageAdapter` con `getItem/setItem/removeItem`. `signOut()` (Task 2) usado por los 3 botones. `isPublicPath`/`isOperatorAllowed` (Task 3) idénticos en test e implementación. `AuthGuard`/`AppLifecycle` montados en `layout.tsx`. Consistente.

---

## Cierre del vault

Al completar Task 7, crear `logs/2026-06-23-apk-capacitor.md`, un ADR en `decisions/` sobre la
migración de auth SSR→cliente (decisión no obvia), y actualizar la fila correspondiente en
`vault/_index.md`. Actualizar `project/Architecture.md` con las deps de Capacitor y el cambio de
modelo de auth.
