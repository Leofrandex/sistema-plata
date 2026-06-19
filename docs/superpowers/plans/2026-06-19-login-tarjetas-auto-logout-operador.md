# Login por tarjetas + auto-logout de operador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acelerar el login en el teléfono compartido (elegir usuario en tarjetas + solo contraseña) y cerrar la sesión de los operadores automáticamente 1 h después del login, con temporizador visible.

**Architecture:** Una vista pública `login_directory` alimenta las tarjetas del login (legible por `anon`). El corte de sesión es un timeout **absoluto** anclado en un `login_at` guardado en `localStorage`; un componente cliente `OperatorSessionGuard` montado en el layout cuenta el tiempo, avisa en los últimos 5 min y hace `signOut` al expirar. Toda la lógica de tiempo vive en un módulo puro (`session-timeout.ts`) testeable.

**Tech Stack:** Next.js 16 (App Router) · React 19 · Supabase (`@supabase/ssr`) · Zustand · Jest + Testing Library · Tailwind.

## Global Constraints

- TypeScript estricto; nada de `any` salvo casts puntuales justificados.
- Estilos solo con Tailwind + tokens del design system (`bg-sidebar`, `text-sidebar-foreground`, etc.). Usar `cn()` de `@/lib/utils` para combinar clases.
- El rol es fuente de verdad en `profiles.role` (`coordinator` | `operator`); en el cliente se lee del store (`useStore(s => s.currentRole)`), nunca de `user_metadata`.
- Cuentas de operador se crean vía SQL admin sobre `auth.users` + `auth.identities`, con columnas de token en `''` (no `NULL`) y password con `extensions.crypt(..., gen_salt('bf'))`. Contraseñas **no se versionan**.
- Migraciones nuevas se aplican al proyecto piloto (`xqqnthyipkdkwyknbtnw`) vía Supabase MCP y luego se regeneran los tipos (`src/lib/supabase/database.types.ts`).
- Duración de sesión de operador: **60 min**. Ventana de aviso: **5 min**. Solo operadores expiran; coordinadores nunca.
- Verificación de cada tarea de UI/lógica: `npm run test:jest` (verde) y `npm run build` cuando se toquen rutas/componentes.

---

### Task 1: Vista pública `login_directory`

**Files:**
- Create: `supabase/migrations/20260619000000_login_directory_view.sql`
- Modify (regenerado por MCP): `src/lib/supabase/database.types.ts`

**Interfaces:**
- Produces: vista `public.login_directory(id uuid, name text, role public.user_role, email text)`, legible por `anon` y `authenticated`. Ordenada por rol, luego nombre. Excluye la cuenta de pruebas `demo@`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260619000000_login_directory_view.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Directorio público de login: alimenta las tarjetas de usuario en /login.
-- La pantalla de login es anónima, por eso la vista es legible por `anon`.
-- Expone SOLO id, name, role, email (correos sintéticos internos). Tradeoff
-- aceptado en el diseño: cualquiera que abra la app ve el roster (sin contraseñas).
-- security_invoker = false → la vista corre con privilegios del owner para poder
-- leer auth.users y saltar el RLS de profiles para el rol anónimo.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.login_directory
with (security_invoker = false) as
  select p.id, p.name, p.role, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where coalesce(u.email, '') not like 'demo@%'
  order by p.role, p.name;

grant select on public.login_directory to anon, authenticated;
```

- [ ] **Step 2: Aplicar la migración al piloto (Supabase MCP)**

Aplicar con `mcp__plugin_supabase_supabase__apply_migration` (name: `login_directory_view`, query: el SQL de arriba).
Expected: éxito sin error.

- [ ] **Step 3: Verificar lectura anónima**

Con `mcp__plugin_supabase_supabase__execute_sql`:
```sql
select role, count(*) from public.login_directory group by role order by role;
```
Expected: filas para `coordinator` y `operator` con conteos > 0; sin error de permisos.

- [ ] **Step 4: Regenerar tipos**

Ejecutar `mcp__plugin_supabase_supabase__generate_typescript_types` y volcar el resultado a `src/lib/supabase/database.types.ts`.
Expected: el tipo `Database['public']['Views']['login_directory']` aparece en el archivo.

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260619000000_login_directory_view.sql src/lib/supabase/database.types.ts
git commit -m "feat(auth): vista pública login_directory para tarjetas de login"
```

---

### Task 2: Query `getLoginDirectory`

**Files:**
- Create: `src/lib/supabase/queries/login-directory.ts`
- Modify: `src/lib/supabase/queries/index.ts`

**Interfaces:**
- Consumes: `DB` y `unwrap` de `./_helpers`; vista `login_directory` (Task 1).
- Produces:
  - `interface LoginDirectoryEntry { id: string; name: string; role: UserRole; email: string }`
  - `getLoginDirectory(db: DB): Promise<LoginDirectoryEntry[]>`

- [ ] **Step 1: Escribir la query**

```ts
// src/lib/supabase/queries/login-directory.ts
import type { UserRole } from '@/lib/types'
import { unwrap, type DB } from './_helpers'

export interface LoginDirectoryEntry {
  id: string
  name: string
  role: UserRole
  email: string
}

/**
 * Lista el directorio público de usuarios (nombre + rol + email) para poblar
 * las tarjetas de /login. Legible sin sesión (vista login_directory).
 */
export async function getLoginDirectory(db: DB): Promise<LoginDirectoryEntry[]> {
  const rows = unwrap(
    await db.from('login_directory').select('id, name, role, email').order('name')
  )
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    role: r.role as UserRole,
    email: (r.email ?? '') as string,
  }))
}
```

- [ ] **Step 2: Exportar desde el índice de queries**

Agregar en `src/lib/supabase/queries/index.ts` (junto a los demás `export * from`):
```ts
export * from './login-directory'
```

- [ ] **Step 3: Verificar typecheck/build**

Run: `npx tsc --noEmit`
Expected: sin errores (la vista ya está en `database.types.ts` por Task 1).

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/queries/login-directory.ts src/lib/supabase/queries/index.ts
git commit -m "feat(auth): query getLoginDirectory"
```

---

### Task 3: Lógica pura de timeout (`session-timeout.ts`)

**Files:**
- Create: `src/lib/session-timeout.ts`
- Test: `src/__tests__/lib/session-timeout.test.ts`

**Interfaces:**
- Produces:
  - `SESSION_DURATION_MS = 3_600_000`, `WARNING_MS = 300_000`, `LOGIN_AT_KEY = 'hospiwaste:login_at'`
  - `interface OperatorSessionState { remainingMs: number; isWarning: boolean; isExpired: boolean }`
  - `computeSessionState(loginAt: number, now: number, durationMs?: number, warningMs?: number): OperatorSessionState`
  - `formatRemaining(ms: number): string` → `"m:ss"`
  - `setLoginAt(ts?: number): void`, `getLoginAt(): number | null`, `clearLoginAt(): void`

- [ ] **Step 1: Escribir los tests (fallan)**

```ts
// src/__tests__/lib/session-timeout.test.ts
/**
 * @jest-environment jsdom
 */
import {
  computeSessionState,
  formatRemaining,
  setLoginAt,
  getLoginAt,
  clearLoginAt,
  SESSION_DURATION_MS,
  WARNING_MS,
} from '@/lib/session-timeout'

describe('computeSessionState', () => {
  it('al inicio queda lejos del aviso y no expirado', () => {
    const loginAt = 1_000_000
    const s = computeSessionState(loginAt, loginAt)
    expect(s.remainingMs).toBe(SESSION_DURATION_MS)
    expect(s.isWarning).toBe(false)
    expect(s.isExpired).toBe(false)
  })

  it('entra en aviso dentro de los últimos 5 min', () => {
    const loginAt = 1_000_000
    const now = loginAt + SESSION_DURATION_MS - WARNING_MS + 1000
    const s = computeSessionState(loginAt, now)
    expect(s.isWarning).toBe(true)
    expect(s.isExpired).toBe(false)
  })

  it('expira y clampa el restante a 0', () => {
    const loginAt = 1_000_000
    const s = computeSessionState(loginAt, loginAt + SESSION_DURATION_MS + 5000)
    expect(s.remainingMs).toBe(0)
    expect(s.isWarning).toBe(false)
    expect(s.isExpired).toBe(true)
  })
})

describe('formatRemaining', () => {
  it('formatea mm:ss redondeando hacia arriba', () => {
    expect(formatRemaining(0)).toBe('0:00')
    expect(formatRemaining(59_400)).toBe('1:00') // 59.4s → ceil 60s
    expect(formatRemaining(305_000)).toBe('5:05')
  })
})

describe('storage helpers', () => {
  beforeEach(() => localStorage.clear())

  it('set/get/clear de login_at', () => {
    expect(getLoginAt()).toBeNull()
    setLoginAt(1_234_567)
    expect(getLoginAt()).toBe(1_234_567)
    clearLoginAt()
    expect(getLoginAt()).toBeNull()
  })

  it('getLoginAt devuelve null ante valor corrupto', () => {
    localStorage.setItem('hospiwaste:login_at', 'no-numero')
    expect(getLoginAt()).toBeNull()
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test:jest -- session-timeout`
Expected: FAIL ("Cannot find module '@/lib/session-timeout'").

- [ ] **Step 3: Implementar el módulo**

```ts
// src/lib/session-timeout.ts
/**
 * Lógica pura del auto-logout de operadores. El corte es ABSOLUTO: 60 min desde
 * el login (no se reinicia por actividad). El ancla `login_at` vive en
 * localStorage para sobrevivir recargas de la app dentro de la hora.
 */
export const SESSION_DURATION_MS = 60 * 60 * 1000
export const WARNING_MS = 5 * 60 * 1000
export const LOGIN_AT_KEY = 'hospiwaste:login_at'

export interface OperatorSessionState {
  remainingMs: number
  isWarning: boolean
  isExpired: boolean
}

export function computeSessionState(
  loginAt: number,
  now: number,
  durationMs: number = SESSION_DURATION_MS,
  warningMs: number = WARNING_MS
): OperatorSessionState {
  const remainingMs = Math.max(0, loginAt + durationMs - now)
  return {
    remainingMs,
    isWarning: remainingMs > 0 && remainingMs <= warningMs,
    isExpired: remainingMs <= 0,
  }
}

/** Formatea milisegundos restantes como "m:ss" (redondea segundos hacia arriba). */
export function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function setLoginAt(ts: number = Date.now()): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOGIN_AT_KEY, String(ts))
}

export function getLoginAt(): number | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(LOGIN_AT_KEY)
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function clearLoginAt(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LOGIN_AT_KEY)
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test:jest -- session-timeout`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/session-timeout.ts src/__tests__/lib/session-timeout.test.ts
git commit -m "feat(auth): lógica pura de timeout de sesión de operador"
```

---

### Task 4: Hook de cuenta regresiva (`useOperatorCountdown`)

**Files:**
- Create: `src/hooks/use-operator-countdown.ts`
- Test: `src/__tests__/hooks/use-operator-countdown.test.tsx`

**Interfaces:**
- Consumes: `useStore` (`currentRole`); `getLoginAt`, `computeSessionState` de `@/lib/session-timeout`.
- Produces:
  - `interface OperatorCountdown { active: boolean; remainingMs: number; isWarning: boolean; isExpired: boolean }`
  - `useOperatorCountdown(): OperatorCountdown` — **solo lectura** (no escribe login_at ni hace signOut). `active` es `true` solo si el rol es `operator` y hay `login_at`. Tick cada 1 s.

- [ ] **Step 1: Escribir el test (falla)**

```tsx
// src/__tests__/hooks/use-operator-countdown.test.tsx
/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useOperatorCountdown } from '@/hooks/use-operator-countdown'
import { useStore } from '@/lib/store'
import { setLoginAt, clearLoginAt, SESSION_DURATION_MS } from '@/lib/session-timeout'

beforeEach(() => {
  jest.useFakeTimers()
  localStorage.clear()
  clearLoginAt()
  useStore.getState().setCurrentRole(null)
})
afterEach(() => {
  jest.useRealTimers()
})

it('inactivo cuando el rol no es operador', () => {
  useStore.getState().setCurrentRole('coordinator')
  setLoginAt(Date.now())
  const { result } = renderHook(() => useOperatorCountdown())
  expect(result.current.active).toBe(false)
})

it('activo para operador con login_at y avanza con el tiempo', () => {
  const now = Date.now()
  jest.setSystemTime(now)
  useStore.getState().setCurrentRole('operator')
  setLoginAt(now)
  const { result } = renderHook(() => useOperatorCountdown())
  expect(result.current.active).toBe(true)
  expect(result.current.remainingMs).toBeLessThanOrEqual(SESSION_DURATION_MS)
  expect(result.current.isExpired).toBe(false)

  act(() => {
    jest.setSystemTime(now + SESSION_DURATION_MS + 1000)
    jest.advanceTimersByTime(1000)
  })
  expect(result.current.isExpired).toBe(true)
  expect(result.current.remainingMs).toBe(0)
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test:jest -- use-operator-countdown`
Expected: FAIL ("Cannot find module '@/hooks/use-operator-countdown'").

- [ ] **Step 3: Implementar el hook**

```ts
// src/hooks/use-operator-countdown.ts
'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { getLoginAt, computeSessionState } from '@/lib/session-timeout'

export interface OperatorCountdown {
  active: boolean
  remainingMs: number
  isWarning: boolean
  isExpired: boolean
}

const INACTIVE: OperatorCountdown = {
  active: false,
  remainingMs: 0,
  isWarning: false,
  isExpired: false,
}

/**
 * Cuenta regresiva de la sesión de operador (solo lectura). Devuelve `active:false`
 * para coordinadores o cuando no hay `login_at`. No escribe storage ni cierra
 * sesión — de eso se encarga OperatorSessionGuard.
 */
export function useOperatorCountdown(): OperatorCountdown {
  const role = useStore((s) => s.currentRole)
  const [state, setState] = useState<OperatorCountdown>(INACTIVE)

  useEffect(() => {
    if (role !== 'operator') {
      setState(INACTIVE)
      return
    }
    function tick() {
      const loginAt = getLoginAt()
      if (loginAt === null) {
        setState(INACTIVE)
        return
      }
      const s = computeSessionState(loginAt, Date.now())
      setState({ active: true, ...s })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [role])

  return state
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test:jest -- use-operator-countdown`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-operator-countdown.ts src/__tests__/hooks/use-operator-countdown.test.tsx
git commit -m "feat(auth): hook useOperatorCountdown"
```

---

### Task 5: Guard de sesión + banner de aviso (`OperatorSessionGuard`)

**Files:**
- Create: `src/components/layout/operator-session-guard.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `useOperatorCountdown` (Task 4); `useStore` (`currentRole`); `setLoginAt`, `clearLoginAt`, `getLoginAt`, `formatRemaining` de `@/lib/session-timeout`; `createClient` de `@/lib/supabase/client`; `useRouter` de `next/navigation`.
- Produces: componente `<OperatorSessionGuard />` (sin props). Único dueño de los efectos: ancla `login_at` si falta (operador), lo limpia para no-operadores, hace `signOut` al expirar, y renderiza el banner de aviso en los últimos 5 min.

- [ ] **Step 1: Implementar el componente**

```tsx
// src/components/layout/operator-session-guard.tsx
'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useOperatorCountdown } from '@/hooks/use-operator-countdown'
import { createClient } from '@/lib/supabase/client'
import {
  setLoginAt,
  clearLoginAt,
  getLoginAt,
  formatRemaining,
} from '@/lib/session-timeout'

/**
 * Cierra la sesión de los operadores 1 h después del login (timeout absoluto) y
 * avisa en los últimos 5 min. Coordinadores no expiran. Es el único dueño de los
 * efectos sobre `login_at` y del signOut. Montado una vez en el layout.
 */
export function OperatorSessionGuard() {
  const router = useRouter()
  const role = useStore((s) => s.currentRole)
  const { active, isWarning, isExpired, remainingMs } = useOperatorCountdown()
  const signingOut = useRef(false)

  // Ancla/limpia el login_at según el rol.
  useEffect(() => {
    if (role === 'operator') {
      if (getLoginAt() === null) setLoginAt() // edge: localStorage borrado a mitad de sesión
    } else {
      clearLoginAt() // coordinador o sin sesión → no expira
    }
  }, [role])

  // Corte firme al expirar.
  useEffect(() => {
    if (!active || !isExpired || signingOut.current) return
    signingOut.current = true
    ;(async () => {
      await createClient().auth.signOut()
      clearLoginAt()
      router.replace('/login')
      router.refresh()
    })()
  }, [active, isExpired, router])

  if (!active || !isWarning) return null

  return (
    <div className="fixed top-2 inset-x-2 z-50 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 shadow-md">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      Tu sesión se cerrará en {formatRemaining(remainingMs)}.
    </div>
  )
}
```

- [ ] **Step 2: Montar en el layout**

En `src/app/layout.tsx`, importar y montar junto al `SupabaseHydrator`:
```tsx
import { OperatorSessionGuard } from '@/components/layout/operator-session-guard'
```
y dentro del `<body>`, tras `<SupabaseHydrator />`:
```tsx
        <SupabaseHydrator />
        <OperatorSessionGuard />
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/operator-session-guard.tsx src/app/layout.tsx
git commit -m "feat(auth): OperatorSessionGuard (auto-logout 1h + banner de aviso)"
```

---

### Task 6: Chip de cuenta regresiva en el header

**Files:**
- Modify: `src/components/layout/mobile-header.tsx`

**Interfaces:**
- Consumes: `useOperatorCountdown` (Task 4); `formatRemaining`, `clearLoginAt` de `@/lib/session-timeout`.

- [ ] **Step 1: Agregar el chip y limpiar login_at al salir manualmente**

Reemplazar el cuerpo del `return` de `MobileHeader` para insertar el chip antes del form de logout y limpiar `login_at` al hacer logout manual. El bloque completo del header queda:

```tsx
'use client'

import { usePathname } from 'next/navigation'
import { LogOut, Clock } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { useOperatorCountdown } from '@/hooks/use-operator-countdown'
import { formatRemaining, clearLoginAt } from '@/lib/session-timeout'
import { cn } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/containers': 'Tachos',
  '/reports': 'Reportes',
  '/register/route': 'Recorridos',
  '/register/route/anden': 'Recorridos de andén',
  '/register/route/morgue': 'Recorrido de Morgue',
  '/register/weighing': 'Pesaje',
  '/register/treatment': 'Registrar Tratamiento',
  '/register/transfer': 'Registrar Traslado',
  '/admin/containers': 'Administrar Tachos',
  '/admin/clients': 'Administrar Clientes',
  '/admin/companies': 'Administrar Empresas',
}

export function MobileHeader() {
  const pathname = usePathname()
  const { active, isWarning, remainingMs } = useOperatorCountdown()
  if (pathname === '/login' || pathname.startsWith('/auth/')) return null
  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES)
      .filter(([prefix]) => prefix !== '/' && pathname.startsWith(prefix))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
    APP_NAME

  return (
    <header className="md:hidden flex items-center justify-between h-14 border-b bg-sidebar border-sidebar-border px-4 sticky top-0 z-10">
      <span className="font-semibold text-sidebar-foreground">{title}</span>
      <div className="flex items-center gap-2">
        {active && (
          <span
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums',
              isWarning
                ? 'bg-amber-100 text-amber-900'
                : 'bg-white/10 text-sidebar-foreground'
            )}
            aria-label="Tiempo restante de sesión"
          >
            <Clock className="h-3.5 w-3.5" />
            {formatRemaining(remainingMs)}
          </span>
        )}
        <form action="/auth/signout" method="post" onSubmit={() => clearLoginAt()}>
          <button
            type="submit"
            aria-label="Cerrar sesión"
            className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-3 -mr-1 rounded-md border border-sidebar-border/60 bg-white/5 text-sm font-medium text-sidebar-foreground hover:bg-white/15 active:bg-white/20 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </form>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/mobile-header.tsx
git commit -m "feat(auth): chip de cuenta regresiva en el header del operador"
```

---

### Task 7: Login por tarjetas + ancla de `login_at`

**Files:**
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `getLoginDirectory`, `LoginDirectoryEntry` (Task 2); `setLoginAt` (Task 3); `createClient` de `@/lib/supabase/client`.

- [ ] **Step 1: Reescribir la página de login**

Reemplazar el contenido completo de `src/app/login/page.tsx`:

```tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, ChevronLeft } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { getLoginDirectory, type LoginDirectoryEntry } from '@/lib/supabase/queries'
import { setLoginAt } from '@/lib/session-timeout'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const nextPath = params.get('next') || '/dashboard'

  const [directory, setDirectory] = useState<LoginDirectoryEntry[] | null>(null)
  const [selected, setSelected] = useState<LoginDirectoryEntry | null>(null)
  const [manual, setManual] = useState(false) // fallback de correo
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    getLoginDirectory(createClient())
      .then(setDirectory)
      .catch(() => setDirectory([])) // si falla, caemos al fallback de correo
  }, [])

  async function signIn(loginEmail: string) {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })
    if (error) {
      setError(traducir(error.message))
      setLoading(false)
      return
    }
    setLoginAt() // ancla del auto-logout (el guard lo ignora para coordinadores)
    router.push(nextPath)
    router.refresh()
  }

  const operators = directory?.filter((u) => u.role === 'operator') ?? []
  const coordinators = directory?.filter((u) => u.role === 'coordinator') ?? []
  const showCards = !manual && selected === null

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{APP_NAME}</CardTitle>
          <p className="text-sm text-slate-500 mt-1">Trazabilidad de Desechos Clínicos</p>
        </CardHeader>
        <CardContent>
          {showCards ? (
            <div className="space-y-5">
              {directory === null ? (
                <p className="text-sm text-slate-500 text-center py-4">Cargando usuarios…</p>
              ) : (
                <>
                  <UserGroup title="Operadores" users={operators} onPick={setSelected} />
                  <UserGroup title="Coordinadores" users={coordinators} onPick={setSelected} />
                </>
              )}
              <button
                type="button"
                onClick={() => setManual(true)}
                className="w-full text-center text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Ingresar con correo
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                signIn(selected ? selected.email : email)
              }}
              className="space-y-4"
            >
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  setManual(false)
                  setPassword('')
                  setError(null)
                }}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
              >
                <ChevronLeft className="h-4 w-4" /> Cambiar usuario
              </button>

              {selected ? (
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    {initials(selected.name)}
                  </span>
                  <span className="font-medium">{selected.name}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Correo electrónico
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="operador@hospiwaste.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function UserGroup({
  title,
  users,
  onPick,
}: {
  title: string
  users: LoginDirectoryEntry[]
  onPick: (u: LoginDirectoryEntry) => void
}) {
  if (users.length === 0) return null
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <div className="grid grid-cols-2 gap-2">
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onPick(u)}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-center hover:border-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
              {initials(u.name)}
            </span>
            <span className="text-sm font-medium leading-tight">{u.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function traducir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(msg)) return 'Tu correo aún no está confirmado.'
  return msg
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Verificación manual (smoke)**

Run: `npm run dev` y abrir `/login`.
Expected: aparecen tarjetas agrupadas en Operadores/Coordinadores; tocar una muestra el paso de contraseña con el nombre; "Cambiar usuario" vuelve a la lista; "Ingresar con correo" muestra el campo de correo. Tras un login exitoso, `localStorage['hospiwaste:login_at']` queda seteado.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(auth): login por tarjetas de usuario + ancla de login_at"
```

---

### Task 8: Roster de cuentas (admin SQL vía Supabase MCP)

**Files:** (ninguno versionado — operación admin sobre el proyecto live; contraseñas no se versionan)

**Interfaces:**
- Produces: en `auth.users`/`auth.identities`/`public.profiles`: **+** Juan Pérez, Ovidio Montalvo, Luis Soto (operadores); **−** Miguel Rangel.

- [ ] **Step 1: Confirmar correos y contraseñas iniciales con Sebastián**

Patrón de correo existente: `nombre.apellido@hospiwaste.com` → `juan.perez@`, `ovidio.montalvo@`, `luis.soto@`. Pedir las 3 contraseñas temporales (no se escriben en el plan ni se commitean).

- [ ] **Step 2: Crear las 3 cuentas de operador (Supabase MCP `execute_sql`)**

Para cada usuario (repetir cambiando `:email`, `:name`, `:password`). Mismo patrón usado en `20260601*` (tokens en `''`, no `NULL`):

```sql
-- Crear usuario operador. Reemplazar :email, :name, :password.
with new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    :email, extensions.crypt(:password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', :name, 'role', 'operator')
  )
  returning id, email
)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email),
       'email', now(), now(), now()
from new_user;
```
(El trigger `on_auth_user_created`/`handle_new_user` crea el `profiles` con `name` y `role` desde la metadata.)

Expected: 3 inserciones sin error.

- [ ] **Step 3: Eliminar a Miguel Rangel**

```sql
delete from auth.users
where email = 'miguel.rangel@hospiwaste.com';
```
(El profile cae por FK on delete cascade; si no, borrar también `delete from public.profiles where name = 'Miguel Rangel';`.)
Expected: 1 fila borrada.

- [ ] **Step 4: Verificar el directorio**

```sql
select name, role, email from public.login_directory order by role, name;
```
Expected: aparecen Juan Pérez, Ovidio Montalvo y Luis Soto como operadores; **no** aparece Miguel Rangel.

- [ ] **Step 5: Verificación funcional**

En `/login`, confirmar que las 3 tarjetas nuevas aparecen y que se puede iniciar sesión con una de ellas usando su contraseña temporal.

---

### Task 9: Documentación del vault

**Files:**
- Create: `vault/logs/2026-06-19-login-tarjetas-auto-logout-operador.md`
- Modify: `vault/_index.md`

- [ ] **Step 1: Escribir el log**

Crear `vault/logs/2026-06-19-login-tarjetas-auto-logout-operador.md` con frontmatter (title, tags `[log, auth, supabase]`, updated) y secciones: **Qué se hizo** (vista `login_directory` + grant anon; login por tarjetas con fallback de correo; auto-logout absoluto 60 min solo operadores con `login_at` en localStorage; guard + banner 5 min + chip en header; roster +3/−1), **Decisiones** (enumeración de usuarios aceptada; timeout absoluto no por inactividad; trabajo en curso sobrevive en IndexedDB), **Verificación** (jest, build, smoke de login y expiración), **Pendiente** (E2E manual de la expiración real a la hora). Referenciar la spec `docs/superpowers/specs/2026-06-19-login-tarjetas-auto-logout-operador-design.md`.

- [ ] **Step 2: Actualizar el índice**

En `vault/_index.md`: agregar una fila a la tabla de estado y una entrada en "Logs de cambios" apuntando al nuevo log; actualizar "Última actualización del vault" a `2026-06-19`.

- [ ] **Step 3: Commit**

```bash
git add vault/logs/2026-06-19-login-tarjetas-auto-logout-operador.md vault/_index.md
git commit -m "docs(vault): log login por tarjetas + auto-logout de operador"
```

---

## Verificación final

- [ ] `npm run test:jest` — toda la suite verde (incluye los nuevos tests de `session-timeout` y `use-operator-countdown`).
- [ ] `npm run build` — compila sin errores.
- [ ] Smoke manual: login por tarjeta y por correo; chip de cuenta regresiva visible para operador; banner aparece en los últimos 5 min (se puede forzar bajando `SESSION_DURATION_MS` temporalmente); al expirar, `signOut` y redirección a `/login`; coordinador no ve chip ni expira.
- [ ] Roster: las 3 cuentas nuevas entran; Miguel Rangel ya no aparece.

## Notas de revisión (self-review)

- **Cobertura de la spec:** login por tarjetas (T1,T2,T7) · fuente pública de usuarios (T1) · solo contraseña tras elegir tarjeta + fallback correo (T7) · auto-logout absoluto 60 min solo operadores (T3,T4,T5) · ancla `login_at` + edge de localStorage borrado (T5,T7) · aviso 5 min (T5) · chip en header (T6) · roster +3/−1 (T8) · documentación (T9). Sin huecos.
- **Edge del reloj del dispositivo:** asumido aceptable (la spec lo nota como riesgo conocido).
