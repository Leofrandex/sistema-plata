# Ajustes Pesaje / Login / Recorridos multi-andén — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar 4 ajustes post-piloto: renombrar Yaris a "tacho" sin ícono, toggle ver/ocultar contraseña en login, reordenar fotos de pesaje (balanza arriba), y permitir múltiples andenes por horario en recorridos (patrón sesión multi-registro como pesaje).

**Architecture:** Cambios de UI puntuales (tareas 1-3) más una reescritura del flujo de recorrido de andén (tarea 4) que reusa `route_events` agrupados por `(date, slot)` como "sesión", elimina el índice único parcial que limitaba a un andén por horario, y sube fotos por andén al guardarlas (no al finalizar) para evitar pérdida.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, Zustand, Supabase (Postgres + Storage), IndexedDB (idb), lucide-react, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-27-pesaje-login-recorridos-multianden-design.md`

---

## File Structure

- `src/components/register/weighing-form.tsx` — MODIFY (tareas 1 y 3)
- `src/app/login/page.tsx` — MODIFY (tarea 2)
- `supabase/migrations/20260527010000_drop_route_anden_unique.sql` — CREATE (tarea 4)
- `src/lib/supabase/queries/route-events.ts` — MODIFY (`findAndenInProgress` → lista)
- `src/lib/data/route-sessions.ts` — CREATE (helpers puros: agrupar andenes del horario, merge de photo_ids)
- `src/__tests__/lib/route-sessions.test.ts` — CREATE (tests de los helpers)
- `src/components/register/route-session-drawer.tsx` — CREATE (drawer de andenes, espejo de weighing-session-drawer)
- `src/app/register/route/anden/[slot]/page.tsx` — REWRITE (flujo multi-andén)
- `src/app/register/route/anden/page.tsx` — MODIFY (estado por slot con nueva semántica)

---

## Task 1: Yaris — "vehículo" → "tacho" + quitar ícono del carro

**Files:**
- Modify: `src/components/register/weighing-form.tsx`

- [ ] **Step 1: Quitar el ícono `Car` del import**

En la línea de import de lucide-react:
```tsx
import { CheckSquare, Square } from 'lucide-react'
```
(antes era `import { CheckSquare, Square, Car } from 'lucide-react'`)

- [ ] **Step 2: Quitar el ícono `Car` del label "Envase Yaris"**

Reemplazar:
```tsx
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5 text-muted-foreground" />
            Envase Yaris {isYaris && <span className="text-red-500">*</span>}
          </label>
```
por:
```tsx
          <label className="text-sm font-medium text-foreground">
            Envase Yaris {isYaris && <span className="text-red-500">*</span>}
          </label>
```

- [ ] **Step 3: Quitar el ícono `Car` del badge "Dedicado a Yaris"**

Reemplazar:
```tsx
            <Badge variant="outline" className="font-normal bg-amber-50 border-amber-300 text-amber-900">
              <Car className="h-3 w-3 mr-1" /> Dedicado a Yaris
            </Badge>
```
por:
```tsx
            <Badge variant="outline" className="font-normal bg-amber-50 border-amber-300 text-amber-900">
              Dedicado a Yaris
            </Badge>
```

- [ ] **Step 4: Cambiar texto "vehículo" → "tacho"**

Reemplazar:
```tsx
              : 'Marcá esta opción si la carga viene de un vehículo Yaris/Picanto.'}
```
por:
```tsx
              : 'Marcá esta opción si la carga viene de un tacho Yaris.'}
```

- [ ] **Step 5: Verificar build/lint**

Run: `npm run lint`
Expected: sin errores nuevos. No debe quedar ninguna referencia a `Car`.
Run: `npx tsc --noEmit` (si está disponible) o confiar en `next build` en la verificación final.

- [ ] **Step 6: Commit**

```bash
git add src/components/register/weighing-form.tsx
git commit -m "feat(pesaje): renombrar 'vehículo Yaris' a 'tacho Yaris' y quitar ícono de carro"
```

---

## Task 2: Ver/ocultar contraseña en login

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Importar íconos y agregar estado**

En `src/app/login/page.tsx`, agregar el import:
```tsx
import { Eye, EyeOff } from 'lucide-react'
```
Y dentro de `LoginForm`, junto a los demás `useState`:
```tsx
  const [showPassword, setShowPassword] = useState(false)
```

- [ ] **Step 2: Envolver el input de contraseña con el botón toggle**

Reemplazar el bloque del campo contraseña:
```tsx
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
```
por:
```tsx
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
```

- [ ] **Step 3: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(login): botón para mostrar/ocultar contraseña"
```

---

## Task 3: Reordenar fotos de pesaje (balanza arriba, tacho abajo)

**Files:**
- Modify: `src/components/register/weighing-form.tsx`

- [ ] **Step 1: Apilar las fotos en una columna y poner balanza primero**

Reemplazar el bloque de fotos:
```tsx
      {/* Fotos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PhotoCapture
          label="Foto del envase"
          required
          preview={state.photo_container}
          onCapture={(url) => onChange({ photo_container: url })}
          onRemove={() => onChange({ photo_container: null })}
        />
        <PhotoCapture
          label="Foto de la balanza"
          required
          preview={state.photo_scale}
          onCapture={(url) => onChange({ photo_scale: url })}
          onRemove={() => onChange({ photo_scale: null })}
        />
      </div>
```
por:
```tsx
      {/* Fotos — balanza arriba, envase abajo (solo orden visual; el orden de
          subida photo_container/photo_scale no cambia para no romper el reporte) */}
      <div className="grid grid-cols-1 gap-4">
        <PhotoCapture
          label="Foto de la balanza"
          required
          preview={state.photo_scale}
          onCapture={(url) => onChange({ photo_scale: url })}
          onRemove={() => onChange({ photo_scale: null })}
        />
        <PhotoCapture
          label="Foto del envase"
          required
          preview={state.photo_container}
          onCapture={(url) => onChange({ photo_container: url })}
          onRemove={() => onChange({ photo_container: null })}
        />
      </div>
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/components/register/weighing-form.tsx
git commit -m "feat(pesaje): foto de balanza arriba y foto del envase abajo"
```

---

## Task 4: Recorridos multi-andén — migración (quitar índice único)

**Files:**
- Create: `supabase/migrations/20260527010000_drop_route_anden_unique.sql`

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/20260527010000_drop_route_anden_unique.sql`:
```sql
-- Multi-andén por horario: un mismo (date, slot) de andén puede tener varios
-- route_events (uno por andén). Se elimina el índice único parcial que limitaba
-- a un solo recorrido de andén por horario/día.
drop index if exists public.route_events_anden_unique_date_slot;
```

- [ ] **Step 2: Aplicar la migración al proyecto Supabase**

Aplicar vía el MCP de Supabase (`apply_migration` con name `drop_route_anden_unique`) o CLI.
Expected: éxito; el índice ya no existe.
Verificar: `list_migrations` incluye la nueva, y una consulta a `pg_indexes` no muestra `route_events_anden_unique_date_slot`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527010000_drop_route_anden_unique.sql
git commit -m "feat(recorridos): quitar índice único de andén por (date, slot) para multi-andén"
```

---

## Task 5: Helpers puros de sesión de recorrido

**Files:**
- Create: `src/lib/data/route-sessions.ts`
- Test: `src/__tests__/lib/route-sessions.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/__tests__/lib/route-sessions.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getSlotAndenEvents, mergePhotoIds } from '@/lib/data/route-sessions'
import type { RouteEvent } from '@/lib/types'

function ev(partial: Partial<RouteEvent>): RouteEvent {
  return {
    id: 'r1',
    client_id: 'c1',
    kind: 'anden',
    slot: '06:30',
    date: '2026-05-27',
    started_at: '2026-05-27T06:30:00.000Z',
    ended_at: null,
    operator_id: 'op1',
    status: 'in_progress',
    containers_dirty_received: [],
    containers_clean_delivered: [],
    floor: '',
    area: '',
    dock: '',
    photo_ids: [],
    ...partial,
  }
}

describe('getSlotAndenEvents', () => {
  it('devuelve los route_events de andén del horario/día ordenados por started_at', () => {
    const events = [
      ev({ id: 'a', started_at: '2026-05-27T06:40:00.000Z' }),
      ev({ id: 'b', started_at: '2026-05-27T06:31:00.000Z' }),
      ev({ id: 'morgue', kind: 'morgue', slot: null }),
      ev({ id: 'otroDia', date: '2026-05-26' }),
      ev({ id: 'otroSlot', slot: '10:30' }),
    ]
    const result = getSlotAndenEvents(events, '2026-05-27', '06:30')
    expect(result.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('puede filtrar por status', () => {
    const events = [
      ev({ id: 'a', status: 'in_progress' }),
      ev({ id: 'b', status: 'completed' }),
    ]
    expect(getSlotAndenEvents(events, '2026-05-27', '06:30', 'in_progress').map((e) => e.id)).toEqual(['a'])
    expect(getSlotAndenEvents(events, '2026-05-27', '06:30', 'completed').map((e) => e.id)).toEqual(['b'])
  })
})

describe('mergePhotoIds', () => {
  it('combina ids existentes conservados con los nuevos', () => {
    expect(mergePhotoIds(['p1', 'p2'], ['p3'])).toEqual(['p1', 'p2', 'p3'])
  })
  it('si no hay nuevas, devuelve solo las existentes', () => {
    expect(mergePhotoIds(['p1'], [])).toEqual(['p1'])
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm run test:run -- src/__tests__/lib/route-sessions.test.ts`
Expected: FAIL ("Cannot find module '@/lib/data/route-sessions'").

- [ ] **Step 3: Implementar los helpers**

Crear `src/lib/data/route-sessions.ts`:
```ts
import type { RouteEvent, RouteSlot, RouteEventStatus } from '@/lib/types'

/**
 * Devuelve los route_events de andén que pertenecen a la "sesión" de un
 * horario/día (mismo date + slot + kind='anden'), ordenados por started_at.
 * Opcionalmente filtra por status.
 */
export function getSlotAndenEvents(
  routeEvents: RouteEvent[],
  date: string,
  slot: RouteSlot,
  status?: RouteEventStatus,
): RouteEvent[] {
  return routeEvents
    .filter(
      (r) =>
        r.kind === 'anden' &&
        r.slot === slot &&
        r.date === date &&
        (status ? r.status === status : true),
    )
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
}

/** Combina los photo_ids existentes (conservados) con los recién subidos. */
export function mergePhotoIds(existing: string[], added: string[]): string[] {
  return [...existing, ...added]
}
```
Nota: verificar el nombre del tipo de status en `src/lib/types.ts` (`RouteEventStatus` o el alias que exista). Si el tipo no se exporta con ese nombre, usar el tipo del campo `status` de `RouteEvent` vía `RouteEvent['status']` en la firma.

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npm run test:run -- src/__tests__/lib/route-sessions.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/route-sessions.ts src/__tests__/lib/route-sessions.test.ts
git commit -m "feat(recorridos): helpers puros de sesión multi-andén (agrupar + merge fotos)"
```

---

## Task 6: `findAndenInProgress` → lista

**Files:**
- Modify: `src/lib/supabase/queries/route-events.ts`

- [ ] **Step 1: Reemplazar `findAndenInProgress` por una versión que devuelve lista**

Reemplazar la función actual:
```ts
/** Devuelve el route_event 'anden' in_progress para (date, slot) si existe. */
export async function findAndenInProgress(
  db: DB,
  date: string,
  slot: NonNullable<Tables<'route_events'>['slot']>
): Promise<RouteEventRow | null> {
  return unwrapOrNull(
    await db
      .from('route_events')
      .select('*')
      .eq('kind', 'anden')
      .eq('date', date)
      .eq('slot', slot)
      .eq('status', 'in_progress')
      .maybeSingle()
  )
}
```
por:
```ts
/** Devuelve los route_events 'anden' in_progress para (date, slot). Puede haber
 *  varios (multi-andén): uno por andén guardado en la sesión del horario. */
export async function listAndenInProgress(
  db: DB,
  date: string,
  slot: NonNullable<Tables<'route_events'>['slot']>
): Promise<RouteEventRow[]> {
  return unwrap(
    await db
      .from('route_events')
      .select('*')
      .eq('kind', 'anden')
      .eq('date', date)
      .eq('slot', slot)
      .eq('status', 'in_progress')
      .order('started_at')
  )
}
```
Si `unwrapOrNull` queda sin uso en el archivo, quitarlo del import. Verificar que ningún otro archivo importe `findAndenInProgress` (se actualiza en la Task 7); buscar con `git grep findAndenInProgress`.

- [ ] **Step 2: Verificar que compila el módulo de queries**

Run: `npx tsc --noEmit` (o confiar en build final).
Expected: el único error pendiente debe ser el uso de `findAndenInProgress` en `[slot]/page.tsx`, que se reescribe en la Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/queries/route-events.ts
git commit -m "feat(recorridos): listAndenInProgress devuelve todos los andenes in_progress del horario"
```

---

## Task 7: Drawer de andenes de la sesión

**Files:**
- Create: `src/components/register/route-session-drawer.tsx`

- [ ] **Step 1: Crear el drawer (espejo de weighing-session-drawer)**

Crear `src/components/register/route-session-drawer.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import { ChevronRight, ChevronLeft, ListChecks, Pencil, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RouteEvent } from '@/lib/types'

interface Props {
  andenes: RouteEvent[]
  selectedAndenId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectAnden: (id: string) => void
}

/**
 * Drawer lateral con los andenes registrados durante la sesión del horario.
 * Espejo de WeighingSessionDrawer: tab flotante con contador, lista de andenes,
 * click selecciona un andén para edición.
 */
export function RouteSessionDrawer({
  andenes,
  selectedAndenId,
  open,
  onOpenChange,
  onSelectAnden,
}: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  return (
    <>
      {!open && andenes.length > 0 && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label={`Abrir lista de ${andenes.length} andenes`}
          className={cn(
            'fixed right-0 top-1/2 -translate-y-1/2 z-30',
            'flex items-center gap-1.5 px-2 py-3 rounded-l-lg',
            'bg-accent text-white shadow-lg ring-1 ring-foreground/10',
            'hover:bg-accent/90 transition-colors',
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <ListChecks className="h-4 w-4" />
            {andenes.length}
          </span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 transition-opacity"
          onClick={() => onOpenChange(false)}
          aria-hidden
        />
      )}

      <aside
        role="dialog"
        aria-label="Andenes de la sesión de recorrido"
        aria-modal="true"
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50 w-full sm:w-96 bg-card shadow-2xl',
          'ring-1 ring-foreground/10 flex flex-col',
          'transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        )}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="text-base font-semibold text-foreground">Andenes del recorrido</h2>
            <p className="text-xs text-muted-foreground">
              {andenes.length} andén{andenes.length !== 1 ? 'es' : ''} registrado{andenes.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={() => onOpenChange(false)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {andenes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin andenes todavía. Guardá el primer andén para verlo aquí.
            </p>
          ) : (
            andenes.map((a, idx) => {
              const isSelected = a.id === selectedAndenId
              const containerCount = a.containers_dirty_received.length + a.containers_clean_delivered.length
              const ubic = [a.floor && `Piso ${a.floor}`, a.area, a.dock].filter(Boolean).join(' · ') || 'Sin ubicación'
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelectAnden(a.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-colors',
                    isSelected
                      ? 'border-accent bg-accent/5 ring-2 ring-accent/30'
                      : 'border-foreground/10 hover:border-accent/40 hover:bg-accent/5',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">Andén {idx + 1}</p>
                      <p className="text-xs text-muted-foreground">{ubic}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{containerCount} envase{containerCount !== 1 ? 's' : ''}</span>
                        <span className="flex items-center gap-1">
                          <Camera className="h-3 w-3" /> {a.photo_ids.length}
                        </span>
                      </p>
                    </div>
                    <Pencil aria-hidden className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>
    </>
  )
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/components/register/route-session-drawer.tsx
git commit -m "feat(recorridos): RouteSessionDrawer para listar y editar andenes de la sesión"
```

---

## Task 8: Reescribir el flujo multi-andén en `[slot]/page.tsx`

**Files:**
- Modify (rewrite): `src/app/register/route/anden/[slot]/page.tsx`

> Contexto para el ejecutor: el componente actual maneja UN solo route_event por
> slot (crear in_progress al iniciar, editar incrementalmente, finalizar). Se
> reescribe para manejar una sesión con varios andenes. Mantener el header,
> los diálogos de confirmación y los estilos existentes. El `RouteForm` y su
> `RouteFormState` no cambian.

- [ ] **Step 1: Reemplazar imports y estado del componente**

Reemplazar el bloque de imports superior y la declaración de estado del componente
`RegisterRouteSlotPage` por esta versión. Mantener `Header`, `ConfirmCancelDialog`
y `ConfirmFinishDialog` que están más abajo en el archivo (no se tocan salvo lo indicado en Step 6).

```tsx
'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { notFound, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, StopCircle, AlertCircle, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RouteForm, type RouteFormState } from '@/components/register/route-form'
import { RouteSessionDrawer } from '@/components/register/route-session-drawer'
import { useStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import { uploadEventPhotos } from '@/lib/data/photos'
import { getSlotAndenEvents, mergePhotoIds } from '@/lib/data/route-sessions'
import { getRouteSlotDefinition } from '@/lib/constants'
import { useElapsed, formatElapsed } from '@/hooks/use-elapsed'
import {
  startSession,
  endSession,
  getActiveSession,
  routeAndenSessionKey,
  todayLocal,
  type ActiveSession,
} from '@/lib/active-session'
import type { RouteSlot } from '@/lib/types'

interface Props {
  params: Promise<{ slot: string }>
}

const VALID_SLOTS: RouteSlot[] = ['06:30', '10:30', '13:20', '14:30', '18:30', '21:00']

const EMPTY_FORM: RouteFormState = {
  dirtyReceivedIds: [],
  cleanDeliveredIds: [],
  floor: '',
  area: '',
  dock: '',
  photos: [],
}

export default function RegisterRouteSlotPage({ params }: Props) {
  const { slot: rawSlot } = use(params)
  const slotId = decodeURIComponent(rawSlot) as RouteSlot
  if (!VALID_SLOTS.includes(slotId)) notFound()

  const slot = getRouteSlotDefinition(slotId)
  const router = useRouter()
  const {
    clients, companies, containers, routeEvents, photos,
    addRouteEvent, updateRouteEvent, deleteRouteEvent, addPhoto,
    currentProfileId,
  } = useStore()

  const [today] = useState<string>(todayLocal)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [formState, setFormState] = useState<RouteFormState>(EMPTY_FORM)
  // Andén actualmente en edición (null = creando uno nuevo).
  const [editingAndenId, setEditingAndenId] = useState<string | null>(null)
  // photo_ids existentes del andén en edición que se conservan (no se re-suben).
  const [existingPhotoIds, setExistingPhotoIds] = useState<string[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const client = clients[0]

  // Andenes in_progress de este horario/día = la sesión abierta.
  const sessionAndenes = useMemo(
    () => getSlotAndenEvents(routeEvents, today, slotId, 'in_progress'),
    [routeEvents, today, slotId],
  )
  const completedAndenes = useMemo(
    () => getSlotAndenEvents(routeEvents, today, slotId, 'completed'),
    [routeEvents, today, slotId],
  )
```

- [ ] **Step 2: Agregar la hidratación / recuperación de sesión**

A continuación del estado, agregar el `useEffect` de hidratación:
```tsx
  // Hidrata la sesión abierta desde IndexedDB. Si no hay ActiveSession pero
  // existen andenes in_progress (app cerrada a mitad), reconstruye la sesión.
  useEffect(() => {
    let cancelled = false
    const key = routeAndenSessionKey(today, slotId)
    getActiveSession(key)
      .then(async (session) => {
        if (cancelled) return
        if (session) {
          setActiveSession(session)
          return
        }
        const orphans = getSlotAndenEvents(
          useStore.getState().routeEvents, today, slotId, 'in_progress',
        )
        if (orphans.length === 0 || !currentProfileId) return
        const recovered: ActiveSession = {
          key,
          type: 'route',
          started_at: orphans[0].started_at,
          context: {
            type: 'route',
            client_id: orphans[0].client_id,
            kind: 'anden',
            slot: slotId,
            date: today,
            operator_id: orphans[0].operator_id,
            route_event_id: '', // ya no se usa un id único; la sesión agrupa por (date, slot)
          },
        }
        await startSession(recovered)
        if (!cancelled) setActiveSession(recovered)
      })
      .catch((err) => {
        console.error('[route] Error hidratando sesión activa:', err)
      })
    return () => { cancelled = true }
  }, [today, slotId, currentProfileId])

  const elapsed = useElapsed(activeSession?.started_at ?? null)
  const isRunning = !!activeSession
  const isEditing = editingAndenId != null
```

> Nota sobre `route_event_id`: el tipo `RouteSessionContext` exige el campo. Como
> ahora la sesión agrupa por `(date, slot)` y no por un id único, se deja `''`.
> No se lee en ningún lado del nuevo flujo. (Alternativa opcional: en Task 6 se
> podría hacer `route_event_id` opcional en el tipo; para minimizar cambios se
> deja con `''`.)

- [ ] **Step 3: Form helpers y guardar andén (crear)**

Agregar:
```tsx
  function updateForm(updates: Partial<RouteFormState>) {
    setFormState((prev) => ({ ...prev, ...updates }))
  }

  function resetForm() {
    setFormState(EMPTY_FORM)
    setEditingAndenId(null)
    setExistingPhotoIds([])
  }

  function buildLabel(): string {
    return `PTDP ${client?.name ?? ''} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`
  }

  async function handleSaveAnden() {
    if (!currentProfileId || !client) return
    if (editingAndenId) {
      await handleUpdateAnden(editingAndenId)
    } else {
      await handleCreateAnden()
    }
  }

  async function handleCreateAnden() {
    if (!currentProfileId || !client) return
    const now = new Date().toISOString()
    const supabase = createClient()

    // 1) Crear el route_event (in_progress) del andén
    let routeEventId: string
    try {
      const row = await q.createRouteEvent(supabase, {
        client_id: client.id,
        kind: 'anden',
        slot: slotId,
        date: today,
        started_at: now,
        operator_id: currentProfileId,
        status: 'in_progress',
      })
      routeEventId = row.id
    } catch (err) {
      console.error('[recorrido andén] crear andén falló:', err)
      alert('No se pudo guardar el andén. Revisá tu conexión e intentá de nuevo.')
      return
    }

    // 2) Asociar envases
    try {
      await q.setRouteContainersDirty(supabase, routeEventId, formState.dirtyReceivedIds)
      await q.setRouteContainersClean(supabase, routeEventId, formState.cleanDeliveredIds)
    } catch (err) {
      console.error('[recorrido andén] asociar envases falló:', err)
    }

    // 3) Subir fotos AHORA (evita pérdida al editar luego)
    let photoIds: string[] = []
    try {
      const uploaded = await uploadEventPhotos(supabase, {
        dataUrls: formState.photos,
        eventType: 'route',
        eventId: routeEventId,
        label: buildLabel(),
        uploadedBy: currentProfileId,
        takenAt: now,
      })
      uploaded.forEach(addPhoto)
      photoIds = uploaded.map((p) => p.id)
    } catch (err) {
      console.error('[recorrido andén] subir fotos falló:', err)
      alert('El andén se guardó, pero algunas fotos no se subieron por la conexión.')
    }

    // 4) Reflejar en el store
    addRouteEvent({
      id: routeEventId,
      client_id: client.id,
      kind: 'anden',
      slot: slotId,
      date: today,
      started_at: now,
      ended_at: null,
      operator_id: currentProfileId,
      status: 'in_progress',
      containers_dirty_received: formState.dirtyReceivedIds,
      containers_clean_delivered: formState.cleanDeliveredIds,
      floor: formState.floor,
      area: formState.area,
      dock: formState.dock,
      photo_ids: photoIds,
    })

    resetForm()
  }
```

- [ ] **Step 4: Editar andén (cargar + actualizar sin perder fotos) y borrar**

Agregar:
```tsx
  function handleSelectAnden(id: string) {
    const ev = routeEvents.find((r) => r.id === id)
    if (!ev) return
    setFormState({
      dirtyReceivedIds: ev.containers_dirty_received,
      cleanDeliveredIds: ev.containers_clean_delivered,
      floor: ev.floor,
      area: ev.area,
      dock: ev.dock,
      photos: [], // las nuevas a subir; las existentes se preservan por id
    })
    setExistingPhotoIds(ev.photo_ids)
    setEditingAndenId(id)
    setDrawerOpen(false)
  }

  async function handleUpdateAnden(id: string) {
    if (!currentProfileId) return
    const now = new Date().toISOString()
    const supabase = createClient()

    // 1) Actualizar ubicación + envases
    try {
      await q.updateRouteEvent(supabase, id, {
        floor: formState.floor,
        area: formState.area,
        dock: formState.dock,
      })
      await q.setRouteContainersDirty(supabase, id, formState.dirtyReceivedIds)
      await q.setRouteContainersClean(supabase, id, formState.cleanDeliveredIds)
    } catch (err) {
      console.error('[recorrido andén] actualizar andén falló:', err)
      alert('No se pudieron guardar los cambios. Revisá tu conexión.')
      return
    }

    // 2) Subir SOLO las fotos nuevas; preservar las existentes por id
    let newPhotoIds: string[] = []
    try {
      const uploaded = await uploadEventPhotos(supabase, {
        dataUrls: formState.photos,
        eventType: 'route',
        eventId: id,
        label: buildLabel(),
        uploadedBy: currentProfileId,
        takenAt: now,
      })
      uploaded.forEach(addPhoto)
      newPhotoIds = uploaded.map((p) => p.id)
    } catch (err) {
      console.error('[recorrido andén] subir fotos nuevas falló:', err)
      alert('Los cambios se guardaron, pero algunas fotos nuevas no se subieron.')
    }

    updateRouteEvent(id, {
      containers_dirty_received: formState.dirtyReceivedIds,
      containers_clean_delivered: formState.cleanDeliveredIds,
      floor: formState.floor,
      area: formState.area,
      dock: formState.dock,
      photo_ids: mergePhotoIds(existingPhotoIds, newPhotoIds),
    })

    resetForm()
  }

  async function handleDeleteAnden(id: string) {
    try {
      const supabase = createClient()
      await q.deleteRouteEvent(supabase, id)
    } catch (err) {
      console.error('[recorrido andén] borrar andén falló:', err)
      return
    }
    deleteRouteEvent(id)
    resetForm()
  }
```

- [ ] **Step 5: Iniciar / Finalizar / Cancelar sesión**

Agregar:
```tsx
  async function handleStart() {
    if (!currentProfileId) {
      alert('Todavía no se cargó tu sesión (sin conexión con el servidor). Esperá a reconectar e intentá de nuevo.')
      return
    }
    if (!client) return
    const now = new Date().toISOString()
    const session: ActiveSession = {
      key: routeAndenSessionKey(today, slotId),
      type: 'route',
      started_at: now,
      context: {
        type: 'route',
        client_id: client.id,
        kind: 'anden',
        slot: slotId,
        date: today,
        operator_id: currentProfileId,
        route_event_id: '',
      },
    }
    await startSession(session)
    setActiveSession(session)
  }

  async function handleFinish() {
    if (!activeSession) return
    const now = new Date().toISOString()
    const supabase = createClient()
    // Marcar todos los andenes in_progress del horario como completed.
    try {
      await Promise.all(
        sessionAndenes.map((a) =>
          q.updateRouteEvent(supabase, a.id, { status: 'completed', ended_at: now }),
        ),
      )
    } catch (err) {
      console.error('[recorrido andén] finalizar falló:', err)
      alert('No se pudo finalizar el recorrido. Revisá tu conexión e intentá de nuevo.')
      return
    }
    sessionAndenes.forEach((a) =>
      updateRouteEvent(a.id, { status: 'completed', ended_at: now }),
    )
    await endSession(activeSession.key)
    setActiveSession(null)
    resetForm()
    router.push('/register/route/anden')
  }

  async function handleCancel() {
    if (!activeSession) return
    const supabase = createClient()
    try {
      await Promise.all(sessionAndenes.map((a) => q.deleteRouteEvent(supabase, a.id)))
    } catch (err) {
      console.error('[recorrido andén] cancelar falló:', err)
      return
    }
    sessionAndenes.forEach((a) => deleteRouteEvent(a.id))
    await endSession(activeSession.key)
    setActiveSession(null)
    resetForm()
    router.push('/register/route/anden')
  }
```

- [ ] **Step 6: Render — estado completado, banner, formulario, drawer, diálogos**

Reemplazar todo el bloque de render (desde `// ── Render` hasta el cierre del
componente, justo antes de `function Header`) por:
```tsx
  // ── Render ─────────────────────────────────────────────────────────────────

  // Completado hoy (hay andenes completed y ninguno in_progress, sin sesión abierta)
  if (!isRunning && completedAndenes.length > 0 && sessionAndenes.length === 0) {
    const totalDirty = completedAndenes.reduce((n, a) => n + a.containers_dirty_received.length, 0)
    const totalClean = completedAndenes.reduce((n, a) => n + a.containers_clean_delivered.length, 0)
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Header slot={slot} />
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-4 space-y-2">
            <p className="font-semibold text-emerald-800">Recorrido completado</p>
            <p className="text-sm text-emerald-700">
              {completedAndenes.length} andén{completedAndenes.length !== 1 ? 'es' : ''} ·{' '}
              {totalDirty} recogido{totalDirty !== 1 ? 's' : ''} · {totalClean} entregado{totalClean !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-emerald-700/80 mt-2">
              No se puede reiniciar la ruta de hoy. Disponible nuevamente mañana.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const canSaveAnden =
    isRunning &&
    (formState.dirtyReceivedIds.length + formState.cleanDeliveredIds.length > 0) &&
    (formState.photos.length > 0 || existingPhotoIds.length > 0)
  const canFinish = sessionAndenes.length > 0

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <Header slot={slot} />

      {/* Banner de estado */}
      {isRunning ? (
        <Card className="bg-accent/5 border-accent/30">
          <CardContent className="pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Recorrido en curso</p>
              <p className="text-3xl font-bold tabular-nums text-foreground mt-1">{formatElapsed(elapsed)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {sessionAndenes.length} andén{sessionAndenes.length !== 1 ? 'es' : ''} registrado{sessionAndenes.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmingCancel(true)}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={() => setConfirmingFinish(true)} disabled={!canFinish} className="gap-2">
                <StopCircle className="h-4 w-4" />
                Finalizar recorrido
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card">
          <CardContent className="pt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              El formulario está bloqueado. Inicia el recorrido para registrar los andenes.
            </p>
            <Button onClick={handleStart} className="gap-2 shrink-0">
              <Play className="h-4 w-4" />
              Iniciar recorrido
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Banner de modo edición */}
      {isEditing && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
          Editando un andén ya registrado. Las fotos existentes se conservan; podés agregar nuevas.
        </div>
      )}

      {/* Formulario del andén */}
      <RouteForm
        state={formState}
        onChange={updateForm}
        containers={containers}
        companies={companies}
        locked={!isRunning}
      />

      {/* Acción: guardar andén y agregar otro */}
      {isRunning && (
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button onClick={handleSaveAnden} disabled={!canSaveAnden} size="lg" className="gap-2 sm:flex-1">
            <Plus className="h-4 w-4" />
            {isEditing ? 'Guardar cambios del andén' : 'Guardar andén y agregar otro'}
          </Button>
          {isEditing && (
            <>
              <Button variant="outline" onClick={resetForm} className="sm:flex-1">
                Cancelar edición
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleDeleteAnden(editingAndenId!)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 sm:flex-none"
              >
                Eliminar andén
              </Button>
            </>
          )}
        </div>
      )}

      {/* Drawer de andenes */}
      <RouteSessionDrawer
        andenes={sessionAndenes}
        selectedAndenId={editingAndenId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSelectAnden={handleSelectAnden}
      />

      {confirmingFinish && (
        <ConfirmFinishDialog
          andenCount={sessionAndenes.length}
          elapsed={elapsed}
          onCancel={() => setConfirmingFinish(false)}
          onConfirm={async () => {
            setConfirmingFinish(false)
            await handleFinish()
          }}
        />
      )}

      {confirmingCancel && (
        <ConfirmCancelDialog
          andenCount={sessionAndenes.length}
          onCancel={() => setConfirmingCancel(false)}
          onConfirm={async () => {
            setConfirmingCancel(false)
            await handleCancel()
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 7: Actualizar las firmas de los diálogos al nuevo conteo de andenes**

Reemplazar `ConfirmCancelDialog` y `ConfirmFinishDialog` (parte inferior del archivo)
y sus interfaces para usar `andenCount` en vez de los conteos por envase:
```tsx
interface DialogProps {
  andenCount: number
  elapsed: number
  onCancel: () => void
  onConfirm: () => void
}

interface CancelDialogProps {
  andenCount: number
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmCancelDialog({ andenCount, onCancel, onConfirm }: CancelDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
      onClick={onCancel}
    >
      <div className="bg-card rounded-xl ring-1 ring-red-200 p-6 max-w-sm w-full space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <X className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">¿Cancelar el recorrido?</h2>
            <p className="text-sm text-muted-foreground">
              Esta acción <strong className="text-red-700">descarta</strong> los {andenCount} andén{andenCount !== 1 ? 'es' : ''} registrado{andenCount !== 1 ? 's' : ''} (envases, ubicación y fotos). El horario vuelve a quedar disponible.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Seguir registrando</Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white">Sí, cancelar</Button>
        </div>
      </div>
    </div>
  )
}

function ConfirmFinishDialog({ andenCount, elapsed, onCancel, onConfirm }: DialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
      onClick={onCancel}
    >
      <div className="bg-card rounded-xl ring-1 ring-foreground/10 p-6 max-w-sm w-full space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">¿Finalizar el recorrido?</h2>
            <p className="text-sm text-muted-foreground">
              Una vez finalizado, no se puede volver a iniciar la ruta de hoy.
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
          <p>Duración: <strong className="font-mono">{formatElapsed(elapsed)}</strong></p>
          <p>Andenes registrados: <strong>{andenCount}</strong></p>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Seguir registrando</Button>
          <Button onClick={onConfirm}>Sí, finalizar</Button>
        </div>
      </div>
    </div>
  )
}
```
Mantener la función `Header` tal cual está.

- [ ] **Step 8: Verificar tipos y lint**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: sin errores. Si aparece error por `route_event_id` requerido en el contexto,
confirmar que se está pasando `''` en `handleStart` y en la recuperación.

- [ ] **Step 9: Commit**

```bash
git add src/app/register/route/anden/\[slot\]/page.tsx
git commit -m "feat(recorridos): flujo multi-andén por horario (sesión con varios andenes editables)"
```

---

## Task 9: Actualizar el listado de andenes (`anden/page.tsx`)

**Files:**
- Modify: `src/app/register/route/anden/page.tsx`

> El listado calcula el estado de cada slot. Debe seguir mostrando `in_progress`
> si hay sesión activa o andenes in_progress, y `completed` si hay andenes
> completed y ninguno in_progress.

- [ ] **Step 1: Reescribir `computeStatus` con la nueva semántica**

Reemplazar el cuerpo de `computeStatus`:
```tsx
  function computeStatus(slot: RouteSlot): SlotState {
    const inProgressKey = routeAndenSessionKey(today, slot)
    const inProgressSession = activeSessions.find((s) => s.key === inProgressKey)
    const inProgress = getSlotAndenEvents(routeEvents, today, slot, 'in_progress')
    if (inProgressSession || inProgress.length > 0) {
      return { status: 'in_progress', startedAt: inProgressSession?.started_at ?? inProgress[0]?.started_at }
    }
    const completed = getSlotAndenEvents(routeEvents, today, slot, 'completed')
    if (completed.length > 0) {
      const last = completed[completed.length - 1]
      return { status: 'completed', completedAt: last.ended_at }
    }
    return { status: 'available' }
  }
```

- [ ] **Step 2: Importar el helper**

Agregar al bloque de imports:
```tsx
import { getSlotAndenEvents } from '@/lib/data/route-sessions'
```

- [ ] **Step 3: Verificar lint/tipos**

Run: `npm run lint`
Expected: sin errores. Confirmar que `routeEvents` y `RouteSlot` ya están en scope (lo están).

- [ ] **Step 4: Commit**

```bash
git add src/app/register/route/anden/page.tsx
git commit -m "feat(recorridos): estado del horario considera múltiples andenes"
```

---

## Task 10: Verificación final (build + tests + manual)

**Files:** ninguno (verificación)

- [ ] **Step 1: Correr toda la suite de tests**

Run: `npm run test:run`
Expected: PASS (incluye el nuevo `route-sessions.test.ts`).

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build exitoso, sin errores de tipos ni de lint.

- [ ] **Step 3: Verificación manual (dev)**

Run: `npm run dev` y verificar en el navegador:
1. **Login:** el ojo muestra/oculta la contraseña al hacer click.
2. **Pesaje:** el selector dice "Envase Yaris" sin ícono de carro; el badge "Dedicado a Yaris" sin ícono; el toggle dice "tacho Yaris". Las fotos aparecen apiladas: balanza arriba, envase abajo.
3. **Recorrido de andén:** iniciar un horario → guardar un andén con envases + foto → "Guardar andén y agregar otro" limpia el form y aparece el tab del drawer con contador 1 → guardar un segundo andén → abrir el drawer, seleccionar el primero, agregar una foto y guardar: la foto previa NO se pierde → finalizar recorrido → el horario queda "completado".
4. **Recuperación:** con un andén guardado, recargar la página: la sesión sigue abierta con los andenes intactos.

- [ ] **Step 4: Actualizar el vault (log + índice)**

Crear `vault/logs/2026-05-27-pesaje-login-recorridos-multianden.md` documentando los
4 cambios y el porqué (multi-andén: motivación = varios andenes por horario sin
perder fotos al editar). Agregar la entrada al mapa de logs en `vault/_index.md` y
actualizar la nota del último procesamiento. Marcar la migración en la tabla de estado.

- [ ] **Step 5: Commit del vault**

```bash
git add vault/
git commit -m "docs(vault): log de ajustes pesaje/login/recorridos multi-andén"
```

---

## Notas de la auto-revisión

- **Cobertura del spec:** Tareas 1 (T1), 2 (T2), 3 (T3), 4 multi-andén (T4 migración, T5 helpers, T6 query, T7 drawer, T8 flujo, T9 listado). Recuperación, edición sin pérdida de fotos y read-only completado cubiertos en T8.
- **Consistencia de tipos:** `getSlotAndenEvents` / `mergePhotoIds` se definen en T5 y se usan idénticos en T8/T9. `listAndenInProgress` reemplaza `findAndenInProgress` (no usada en el nuevo flujo, que agrupa vía store; la query queda disponible para usos futuros/offline). Verificar el nombre del tipo de status en `src/lib/types.ts` (paso indicado en T5).
- **Fuera de alcance:** Tarea 5 (reporte) — diseño aparte cuando exista la imagen.
