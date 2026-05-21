# Sesión 1 PTDP — Pesaje + Recorridos + Dashboard (sin Supabase)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los 4 cambios bloqueantes para el piloto del 2026-05-21: (a) campo de observaciones en Pesaje, (b) reorden del formulario de Pesaje, (c) selector de tipo de desecho en Recorridos (Andén vs Morgue), (d) reemplazo de la métrica "En cámara fría" del Dashboard por "Envases pendientes de pesar".

**Architecture:** Cambios incrementales sobre Next.js App Router + Zustand store (mock data, sin backend aún). Se extiende el tipo `ContainerReception` con `observations`, el tipo `RouteEvent` con `kind: 'anden' | 'morgue'` y `slot: RouteSlot | null`. La página `/register/route` pasa de listing directo a chooser, con sub-rutas `/anden` (flujo existente movido) y `/morgue` (flujo ad-hoc sin slot). El Dashboard cambia un único card de `metrics-cards.tsx` y su métrica derivada.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Zustand, Tailwind, Vitest, IndexedDB (idb) para sesiones activas, Recharts (no se toca aquí).

**Out of scope:** Integración Supabase, deploy a GitHub, hosting — se cubren en una sesión aparte después de validar Sesión 1. Cambios de prioridad alta 1-4 (reportes) y 8-9 (admin envases) van en Sesión 2.

---

## Convenciones de ejecución

- Ejecutar tests con `npm run test:run -- <path>` (Vitest one-shot, no watch).
- Build final con `npm run build` antes del commit que cierra cada parte.
- Branch actual: `feat/recorridos-pesaje-reportes-dashboard`. No abrir branch nueva.
- Cada Task termina con commit. Estilo: prefijo `feat:` / `fix:` / `refactor:`, mensaje en español corto.

---

## PARTE 1 — PESAJE (campo observaciones + reorden)

### Task 1: Tipo `ContainerReception.observations` + `WeighingFormState.observations`

**Files:**
- Modify: `src/lib/types.ts:116-125`
- Modify: `src/components/register/weighing-form.tsx:24-36`
- Modify: `src/lib/mock-data.ts` (los mocks de `ContainerReception` deben seguir tipando bien — añadir `observations: ''` o dejar el campo opcional para no romper)
- Test: `src/__tests__/lib/types.test.ts` (si existe assertion sobre la forma del tipo)

- [ ] **Step 1: Añadir `observations: string` opcional a `ContainerReception`**

En `src/lib/types.ts`, modificar la interfaz:

```ts
export interface ContainerReception {
  id: string
  container_id: string
  weighing_session_id: string | null   // ahora puede pertenecer a una sesión
  arrived_at: string
  gross_weight_kg: number
  // net_weight_kg is computed: gross_weight_kg - container.tare_weight_kg
  operator_id: string
  photo_ids: string[]
  observations: string                  // NEW — texto libre del operador (Yaris/Picanto sin tara, etc.). Default ''.
}
```

Decisión: campo **requerido pero permitiendo string vacío**. Más simple que opcional + más fácil de tipar en formularios. Mocks deben actualizarse a `observations: ''`.

- [ ] **Step 2: Actualizar mocks para incluir `observations: ''`**

En `src/lib/mock-data.ts`, buscar todas las definiciones tipo `ContainerReception` (busca `MOCK_RECEPTIONS` o similares) y añadir `observations: ''` a cada una.

```bash
grep -n "MOCK_RECEPTIONS\|ContainerReception" src/lib/mock-data.ts
```

Para cada entrada, agregar la línea `observations: '',` antes del cierre `}`.

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (sin errores). Si aparece error en `historical-data.json` cargado por TS porque le falta `observations`, ese JSON se transforma en runtime y no entra al typecheck; ignorar. Si entra al typecheck por alguna definición, revisar `src/lib/data/historical-data.json` y, si carga vía `import`, hacer el campo opcional con `observations?: string` y tratar `observations ?? ''` en lectura. Preferir opcional solo si el JSON estático lo obliga.

- [ ] **Step 4: Extender `WeighingFormState`**

En `src/components/register/weighing-form.tsx`:

```ts
export interface WeighingFormState {
  container_id: string
  photo_container: string | null
  photo_scale: string | null
  gross_weight: string
  observations: string                  // NEW
}

export const EMPTY_WEIGHING_FORM: WeighingFormState = {
  container_id: '',
  photo_container: null,
  photo_scale: null,
  gross_weight: '',
  observations: '',                     // NEW
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/mock-data.ts src/components/register/weighing-form.tsx
git commit -m "feat(pesaje): agregar campo observations al tipo y form state"
```

---

### Task 2: UI del Pesaje — reordenar y renderizar textarea de observaciones

**Files:**
- Modify: `src/components/register/weighing-form.tsx:90-235`

**Orden requerido (acordado en reunión 2026-05-18):** Número de envase → Peso bruto → Observaciones → Fotos.
Las fotos quedan abajo porque el operador prioriza ingresar el dato numérico (típicamente desde el software de balanza) antes de tomar las fotos.

- [ ] **Step 1: Reescribir el bloque de render del form**

Reemplazar el bloque actual (desde `{/* Envase */}` hasta antes de `{/* Acciones */}`) por este orden — mantener envase como ya está, mover peso bruto inmediatamente después, agregar observaciones después del peso, y dejar las fotos al final:

```tsx
{/* Envase */}
<div className="space-y-1.5">
  <label className="text-sm font-medium text-foreground">
    Número de envase <span className="text-red-500">*</span>
  </label>
  <Select
    value={state.container_id}
    onValueChange={(v) => onChange({ container_id: v ?? '' })}
  >
    <SelectTrigger>
      <SelectValue placeholder={
        dropdownContainers.length === 0
          ? 'No hay envases pendientes de pesar'
          : 'Seleccionar envase'
      } />
    </SelectTrigger>
    <SelectContent>
      {dropdownContainers.map((c) => (
        <SelectItem key={c.id} value={c.id}>
          {c.id} — {companyMap[c.company_id] ?? '—'} · {c.size_liters} L
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  {dropdownContainers.length === 0 && mode === 'create' && (
    <p className="text-xs text-amber-700">
      No hay envases sucios recogidos pendientes de pesar. Registrá un
      recorrido primero para que aparezcan envases acá.
    </p>
  )}
  {selectedContainer && (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Badge variant="outline" className="font-normal">
        Tipo: <strong className="ml-1 font-semibold">{WASTE_LABELS[selectedContainer.waste_type]}</strong>
      </Badge>
      <Badge variant="outline" className="font-normal">
        Tara: <strong className="ml-1 font-semibold">{selectedContainer.tare_weight_kg} kg</strong>
      </Badge>
      <Badge variant="outline" className="font-normal">
        Tamaño: <strong className="ml-1 font-semibold">{selectedContainer.size_liters} L</strong>
      </Badge>
    </div>
  )}
</div>

{/* Peso bruto */}
<div className="space-y-1.5">
  <label className="text-sm font-medium text-foreground">
    Peso bruto (kg) <span className="text-red-500">*</span>
  </label>
  <Input
    type="number"
    step="0.1"
    min="0"
    value={state.gross_weight}
    onChange={(e) => onChange({ gross_weight: e.target.value })}
    placeholder="Ej: 43.7"
    className="text-lg h-12"
  />
  {selectedContainer && hasValidWeight && (
    <p className="text-sm text-muted-foreground">
      Peso neto estimado:{' '}
      <strong className="text-foreground">
        {computeNetWeight(grossWeight, selectedContainer.tare_weight_kg)} kg
      </strong>
    </p>
  )}
  {state.gross_weight && selectedContainer && !hasValidWeight && (
    <p className="text-xs text-red-600">
      El peso bruto debe ser mayor que la tara ({selectedContainer.tare_weight_kg} kg).
    </p>
  )}
</div>

{/* Observaciones */}
<div className="space-y-1.5">
  <label htmlFor="weighing-observations" className="text-sm font-medium text-foreground">
    Observaciones
  </label>
  <textarea
    id="weighing-observations"
    value={state.observations}
    onChange={(e) => onChange({ observations: e.target.value })}
    placeholder="Ej: Yaris #3, Picanto rojo, tacho con daño en tapa…"
    rows={2}
    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
  />
  <p className="text-xs text-muted-foreground">
    Opcional. Útil para anotar identificador manual de envases sin tara registrada (Yaris, Picanto) o cualquier detalle del pesaje.
  </p>
</div>

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

Notas:
- No se cambia `canSubmit` — observaciones son opcionales.
- El `<textarea>` es nativo (Tailwind), no hay componente `<Textarea>` propio en `components/ui/`. Si al ejecutar se confirma que existe `components/ui/textarea.tsx`, sustituir el `<textarea>` nativo por `<Textarea>`. Verificación rápida: `ls src/components/ui/ | grep -i textarea`.

- [ ] **Step 2: Verificar visualmente**

Run: `npm run dev`
Abrir http://localhost:3000/register/weighing en navegador. Iniciar una sesión. Confirmar visualmente que el orden es: envase → peso bruto → observaciones → fotos. Escribir en observaciones y comprobar que persiste en el state local (al cambiar otro campo no se pierde).

- [ ] **Step 3: Commit**

```bash
git add src/components/register/weighing-form.tsx
git commit -m "feat(pesaje): reordenar UI (envase → peso → observaciones → fotos)"
```

---

### Task 3: Persistir `observations` en create / edit / hydrate

**Files:**
- Modify: `src/app/register/weighing/page.tsx:143-216` (handlers `handleCreateReception`, `handleSaveEdit`, `handleSelectForEdit`)

- [ ] **Step 1: Pasar `observations` a `addReception` en create**

En `handleCreateReception`, dentro del objeto pasado a `addReception`, agregar la línea:

```ts
addReception({
  id: receptionId,
  container_id: formState.container_id,
  weighing_session_id: currentSessionId,
  arrived_at: now,
  gross_weight_kg: gross,
  operator_id: 'user-1',
  photo_ids: [photoContainerId, photoScaleId],
  observations: formState.observations,    // NEW
})
```

- [ ] **Step 2: Pasar `observations` a `updateReception` en edit**

En `handleSaveEdit`, dentro de `updateReception(receptionId, { ... })`, agregar:

```ts
updateReception(receptionId, {
  container_id: formState.container_id,
  gross_weight_kg: gross,
  photo_ids: [photoContainerId, photoScaleId],
  observations: formState.observations,    // NEW
})
```

- [ ] **Step 3: Cargar `observations` al editar (`handleSelectForEdit`)**

```ts
setFormState({
  container_id: r.container_id,
  photo_container: containerPhoto,
  photo_scale: scalePhoto,
  gross_weight: String(r.gross_weight_kg),
  observations: r.observations ?? '',      // NEW — tolerar undefined si vinieron de mock viejo
})
```

- [ ] **Step 4: Probar end-to-end manualmente**

Run: `npm run dev`
1. Ir a `/register/weighing`, iniciar sesión.
2. Pesar un envase con observación "Yaris #3", guardar.
3. Abrir drawer lateral, hacer click en el envase para editar.
4. Confirmar que el textarea muestra "Yaris #3".
5. Cambiar la observación, guardar cambios.
6. Reabrir y confirmar que el cambio quedó persistido.

- [ ] **Step 5: Commit**

```bash
git add src/app/register/weighing/page.tsx
git commit -m "feat(pesaje): persistir observations en create/edit del reception"
```

---

### Task 4: Mostrar `observations` en el drawer lateral

**Files:**
- Modify: `src/components/register/weighing-session-drawer.tsx:110-141`

- [ ] **Step 1: Renderizar observación en cada card del drawer**

En el `.map((r) => { ... })`, dentro del `<button>`, después del `<p>` que muestra la hora, agregar:

```tsx
<p className="text-xs text-muted-foreground mt-0.5">
  {new Date(r.arrived_at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}
</p>
{r.observations && r.observations.trim().length > 0 && (
  <p className="text-xs text-foreground/80 italic mt-1 line-clamp-2">
    “{r.observations}”
  </p>
)}
```

`line-clamp-2` (Tailwind plugin built-in en v3.3+) trunca a 2 líneas. Si no está disponible, sustituir por `overflow-hidden` + `text-ellipsis` y un truncado manual.

- [ ] **Step 2: Verificar visualmente**

Run: `npm run dev`
Pesar dos envases, uno con observación y otro sin. En el drawer, el primero debe mostrar la observación entre comillas en cursiva; el segundo no.

- [ ] **Step 3: Commit**

```bash
git add src/components/register/weighing-session-drawer.tsx
git commit -m "feat(pesaje): mostrar observations en el drawer de la sesion"
```

---

## PARTE 2 — RECORRIDOS (tipo de desecho como primer paso)

### Decisión de diseño

Se introduce un primer paso de selección de **tipo de recorrido** (`kind`):
- **Andén** (`'anden'`): recorrido de andén con 6 horarios fijos. Cubre peligroso infeccioso y citotóxico.
- **Morgue** (`'morgue'`): recorrido ad-hoc, sin horario fijo (cada 15 días aprox.). No tiene `slot` — se permite iniciar/finalizar en cualquier momento, sin restricción de "1 por día".

El campo `slot` pasa a ser `RouteSlot | null`. Para `'anden'` siempre requerido; para `'morgue'` siempre `null`.

Rutas:
- `/register/route` → **chooser** (Andén / Morgue).
- `/register/route/anden` → listing de los 6 slots (lo que hoy vive en `/register/route`).
- `/register/route/anden/[slot]` → detalle de un slot (lo que hoy vive en `/register/route/[slot]`).
- `/register/route/morgue` → flujo Morgue (sin slot).

---

### Task 5: Extender tipos + mocks + `routeSessionKey` para soportar Morgue

**Files:**
- Modify: `src/lib/types.ts:36-102`
- Modify: `src/lib/mock-data.ts:74-107`
- Modify: `src/lib/active-session.ts:22-70`

- [ ] **Step 1: Añadir `RouteKind` y `kind` + `slot: RouteSlot | null` en `RouteEvent`**

En `src/lib/types.ts`, después de `export type RouteSlot = …`:

```ts
export type RouteKind = 'anden' | 'morgue'
```

Y modificar `RouteEvent`:

```ts
export interface RouteEvent {
  id: string
  client_id: string
  kind: RouteKind                       // NEW
  slot: RouteSlot | null                // CHANGED — null cuando kind === 'morgue'
  date: string
  started_at: string
  ended_at: string | null
  operator_id: string
  status: RouteEventStatus
  containers_dirty_received: string[]
  containers_clean_delivered: string[]
  floor: string
  area: string
  dock: string
  photo_ids: string[]
}
```

- [ ] **Step 2: Actualizar `RouteSessionContext` y `routeSessionKey`**

En `src/lib/active-session.ts`:

```ts
import type { RouteKind, RouteSlot } from './types'

export interface RouteSessionContext {
  type: 'route'
  client_id: string
  kind: RouteKind                       // NEW
  slot: RouteSlot | null                // CHANGED
  date: string
  operator_id: string
  route_event_id: string
}
```

Reemplazar `routeSessionKey` por dos helpers tipados — uno por kind — para que el call site sea explícito:

```ts
export function routeAndenSessionKey(date: string, slot: RouteSlot): string {
  return `route:anden:${date}:${slot}`
}

export function routeMorgueSessionKey(date: string, startedAt: string): string {
  // Morgue puede tener más de uno por día (no hay restricción). Distinguimos por started_at.
  return `route:morgue:${date}:${startedAt}`
}
```

Eliminar el `routeSessionKey` viejo (los call sites se actualizarán en Tasks 6/7/8).

- [ ] **Step 3: Actualizar mocks**

En `src/lib/mock-data.ts`, agregar `kind: 'anden'` a cada `RouteEvent` existente (ambos mocks son de andén):

```ts
{
  id: 'route-1',
  client_id: 'client-1',
  kind: 'anden',                        // NEW
  slot: '06:30',
  date: '2026-05-17',
  // … resto igual
},
{
  id: 'route-2',
  client_id: 'client-1',
  kind: 'anden',                        // NEW
  slot: '10:30',
  // …
},
```

- [ ] **Step 4: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: errores únicamente en archivos que se modifican en las próximas tasks (`route/page.tsx`, `route/[slot]/page.tsx`) — esos errores se resuelven en Tasks 6/7. Aceptable seguir adelante.

Si aparecen errores en otros archivos (p. ej. `src/lib/data/dashboard-metrics.ts` o similar leyendo `r.slot` con asunción de no-null), tratarlos antes de continuar — añadir guards `if (r.slot) …` o filtrar `r.kind === 'anden'` según corresponda.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/active-session.ts src/lib/mock-data.ts
git commit -m "feat(recorridos): agregar RouteKind (anden|morgue) y slot nullable"
```

---

### Task 6: Convertir `/register/route` en chooser y crear listing en `/register/route/anden`

**Files:**
- Create: `src/app/register/route/anden/page.tsx`
- Modify (reescribir): `src/app/register/route/page.tsx`
- Modify: `src/components/register/route-slot-card.tsx:28` (href apunta a `/register/route/anden/[slot]`)
- Modify: `src/components/layout/mobile-header.tsx:6-18` (añadir títulos de las nuevas rutas)

- [ ] **Step 1: Crear `src/app/register/route/anden/page.tsx`**

Es exactamente el `page.tsx` actual de `/register/route` (listing de 6 slots). Copiar literal el archivo `src/app/register/route/page.tsx` que existe hoy, y actualizar el header para reflejar que es la sub-vista de Andén + agregar un link "Volver" al chooser:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTE_SLOTS } from '@/lib/constants'
import { useStore } from '@/lib/store'
import {
  listActiveSessions,
  routeAndenSessionKey,
  todayLocal,
  type ActiveSession,
} from '@/lib/active-session'
import { RouteSlotCard, type RouteSlotStatus } from '@/components/register/route-slot-card'
import type { RouteSlot } from '@/lib/types'

interface SlotState {
  status: RouteSlotStatus
  startedAt?: string | null
  completedAt?: string | null
}

export default function RegisterAndenRoutesPage() {
  const { routeEvents } = useStore()
  const [today, setToday] = useState<string>(todayLocal)
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])

  useEffect(() => {
    const interval = setInterval(() => setToday(todayLocal()), 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false
    listActiveSessions('route')
      .then((sessions) => {
        if (!cancelled) setActiveSessions(sessions.filter((s) => s.context.type === 'route' && s.context.kind === 'anden'))
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[route-list] Error leyendo sesiones activas:', err)
        if (!cancelled) setActiveSessions([])
      })
    return () => { cancelled = true }
  }, [today, routeEvents])

  function computeStatus(slot: RouteSlot): SlotState {
    const inProgressKey = routeAndenSessionKey(today, slot)
    const inProgressSession = activeSessions.find((s) => s.key === inProgressKey)
    if (inProgressSession) {
      return { status: 'in_progress', startedAt: inProgressSession.started_at }
    }
    const completed = routeEvents.find(
      (r) => r.kind === 'anden' && r.slot === slot && r.date === today && r.status === 'completed',
    )
    if (completed) {
      return { status: 'completed', completedAt: completed.ended_at }
    }
    return { status: 'available' }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/register/route">
          <Button variant="ghost" size="icon" aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <header>
          <h1 className="text-2xl font-bold text-foreground">Recorridos de andén</h1>
          <p className="text-sm text-muted-foreground mt-1">
            6 recorridos diarios con horario fijo. Una vez finalizada una ruta del día,
            no se puede volver a iniciar hasta el día siguiente.
          </p>
        </header>
      </div>

      <div className="space-y-3">
        {ROUTE_SLOTS.map((slot) => {
          const state = computeStatus(slot.id)
          return (
            <RouteSlotCard
              key={slot.id}
              slot={slot}
              status={state.status}
              startedAt={state.startedAt}
              completedAt={state.completedAt}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Reescribir `src/app/register/route/page.tsx` como chooser**

```tsx
'use client'

import Link from 'next/link'
import { Building2, Skull, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const OPTIONS = [
  {
    href: '/register/route/anden',
    label: 'Recorrido de andén',
    description: 'Peligroso infeccioso y citotóxico. 6 horarios fijos por día.',
    icon: Building2,
    iconBg: 'bg-accent/10',
    iconText: 'text-accent',
  },
  {
    href: '/register/route/morgue',
    label: 'Recorrido de Morgue',
    description: 'Sin horario fijo. Se ejecuta cuando lo requiere la operación (aprox. cada 15 días).',
    icon: Skull,
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-700',
  },
] as const

export default function RegisterRoutesPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Recorridos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Elegí el tipo de recorrido a registrar.
        </p>
      </header>

      <div className="space-y-3">
        {OPTIONS.map(({ href, label, description, icon: Icon, iconBg, iconText }) => (
          <Link key={href} href={href} className="block">
            <Card className="hover:border-accent/40 hover:bg-accent/5 transition-colors cursor-pointer">
              <CardContent className="pt-4 flex items-center gap-4">
                <span className={`flex size-12 items-center justify-center rounded-lg ring-1 ring-foreground/5 ${iconBg} ${iconText}`}>
                  <Icon aria-hidden className="size-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                </div>
                <ChevronRight aria-hidden className="size-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Actualizar `route-slot-card.tsx` para apuntar a la URL nueva**

En `src/components/register/route-slot-card.tsx:28`, reemplazar:

```ts
const href = `/register/route/${encodeURIComponent(slot.id)}`
```

Por:

```ts
const href = `/register/route/anden/${encodeURIComponent(slot.id)}`
```

- [ ] **Step 4: Actualizar títulos del header mobile**

En `src/components/layout/mobile-header.tsx`, sustituir/extender el mapa `PAGE_TITLES`:

```ts
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/containers': 'Envases',
  '/reports': 'Reportes',
  '/register/route': 'Recorridos',
  '/register/route/anden': 'Recorridos de andén',
  '/register/route/morgue': 'Recorrido de Morgue',
  '/register/weighing': 'Pesaje',
  '/register/treatment': 'Registrar Tratamiento',
  '/register/transfer': 'Registrar Traslado',
  '/register/location': 'Reportar Ubicación',
  '/admin/containers': 'Administrar Envases',
  '/admin/clients': 'Administrar Clientes',
  '/admin/companies': 'Administrar Empresas',
}
```

El matching por prefijo del componente ya se encarga de mostrar "Recorridos de andén" cuando el path es `/register/route/anden/06:30`.

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: FAIL — el archivo `src/app/register/route/[slot]/page.tsx` aún existe y aún importa `routeSessionKey` (eliminado). Se arregla en Task 7.

- [ ] **Step 6: Commit (parcial; build aún roto, se cierra en Task 7)**

```bash
git add src/app/register/route/page.tsx src/app/register/route/anden/page.tsx src/components/register/route-slot-card.tsx src/components/layout/mobile-header.tsx
git commit -m "feat(recorridos): chooser en /register/route + listing anden movido"
```

---

### Task 7: Mover detalle de slot a `/register/route/anden/[slot]` y arreglar build

**Files:**
- Create: `src/app/register/route/anden/[slot]/page.tsx`
- Delete: `src/app/register/route/[slot]/page.tsx` (después de mover el contenido)

- [ ] **Step 1: Mover el archivo del detalle de slot**

Mover el archivo a `src/app/register/route/anden/[slot]/page.tsx`. Hacerlo con git para preservar historial:

```bash
mkdir -p src/app/register/route/anden/[slot]
git mv "src/app/register/route/[slot]/page.tsx" "src/app/register/route/anden/[slot]/page.tsx"
```

En Windows con la shell que sea, si `git mv` no acepta los corchetes sin quoting, usar comillas como en el comando anterior. Verificar que `src/app/register/route/[slot]/` queda vacío y eliminar la carpeta.

- [ ] **Step 2: Actualizar imports y referencias al `routeSessionKey` antiguo**

Editar `src/app/register/route/anden/[slot]/page.tsx`:

a) Cambiar el import:
```ts
import {
  startSession,
  endSession,
  getActiveSession,
  routeAndenSessionKey,         // CHANGED — antes routeSessionKey
  todayLocal,
  type ActiveSession,
} from '@/lib/active-session'
```

b) En el efecto de hidratación (línea ~64), reemplazar:
```ts
const key = routeSessionKey(today, slotId)
```
por:
```ts
const key = routeAndenSessionKey(today, slotId)
```

c) En `handleStart`, dentro del `addRouteEvent({ ... })`, agregar `kind: 'anden'`:
```ts
addRouteEvent({
  id: routeEventId,
  client_id: client.id,
  kind: 'anden',                  // NEW
  slot: slotId,
  date: today,
  // … resto igual
})
```

d) En `handleStart`, dentro del `session: ActiveSession = { ... }`, actualizar `context`:
```ts
context: {
  type: 'route',
  client_id: client.id,
  kind: 'anden',                  // NEW
  slot: slotId,
  date: today,
  operator_id: 'user-1',
  route_event_id: routeEventId,
},
```

Y el `key`:
```ts
key: routeAndenSessionKey(today, slotId),
```

e) En `routeEvents.find(...)` para detectar completedEvent (línea ~98), agregar filtro `kind`:
```ts
const completedEvent = routeEvents.find(
  (r) => r.kind === 'anden' && r.slot === slotId && r.date === today && r.status === 'completed',
)
```

f) Reemplazar los dos `router.push('/register/route')` por `router.push('/register/route/anden')` (líneas ~163 y ~205).

g) El `<Link href="/register/route">` del header (línea ~341) cambia a `<Link href="/register/route/anden">`.

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: PASS. Las rutas registradas deben incluir:
- `/register/route` (chooser)
- `/register/route/anden` (listing)
- `/register/route/anden/[slot]` (detalle)

Si aparece error de `kind` en otros archivos (mocks o tests), agregarlo. Buscar:

```bash
grep -rn "kind:" src/lib/mock-data.ts
grep -rn "routeEvents.find\|routeEvents.filter" src --include="*.ts" --include="*.tsx"
```

Cada filtro/find que asuma slot no-null debe agregar guard `r.kind === 'anden' &&` cuando aplique.

- [ ] **Step 4: Smoke test manual**

Run: `npm run dev`
1. Navegar a `/register/route` → debe mostrar el chooser con dos cards.
2. Click en "Recorrido de andén" → debe mostrar los 6 slots.
3. Click en un slot → debe abrir el detalle. Iniciar y finalizar un recorrido. Confirmar que vuelve al listing de andén, no al chooser.
4. Volver al chooser, click "Recorrido de Morgue" → debe dar 404 por ahora (se crea en Task 8). Anotar para validar después.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(recorridos): mover detalle de slot a /anden/[slot] + kind: 'anden'"
```

---

### Task 8: Flujo Morgue en `/register/route/morgue`

**Files:**
- Create: `src/app/register/route/morgue/page.tsx`

**Diseño del flujo Morgue (mínimo para piloto):**
- No hay slots ni restricción "una vez por día".
- Una sola pantalla con banner Iniciar / Cronómetro + banner Finalizar.
- Reusa `RouteForm` (mismo componente que andén).
- `routeMorgueSessionKey(today, started_at)` permite múltiples sesiones por día.
- Al finalizar, vuelve al chooser `/register/route` (no a un listing — Morgue no tiene listing).

- [ ] **Step 1: Crear `src/app/register/route/morgue/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, StopCircle, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RouteForm, type RouteFormState } from '@/components/register/route-form'
import { useStore } from '@/lib/store'
import { useElapsed, formatElapsed } from '@/hooks/use-elapsed'
import {
  startSession,
  endSession,
  listActiveSessions,
  routeMorgueSessionKey,
  todayLocal,
  type ActiveSession,
} from '@/lib/active-session'
import type { RouteEvent, Photo } from '@/lib/types'

export default function RegisterMorgueRoutePage() {
  const router = useRouter()
  const {
    clients, companies, containers,
    addRouteEvent, updateRouteEvent, deleteRouteEvent, addPhoto,
  } = useStore()

  const [today] = useState<string>(todayLocal)
  const [hydrated, setHydrated] = useState(false)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [formState, setFormState] = useState<RouteFormState>({
    dirtyReceivedIds: [],
    cleanDeliveredIds: [],
    floor: '',
    area: '',
    dock: '',
    photos: [],
  })
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const client = clients[0]

  // Hidrata buscando cualquier sesión morgue activa del día (puede haber 0 o 1
  // en curso a la vez — el botón "Iniciar" queda bloqueado si ya hay una).
  useEffect(() => {
    let cancelled = false
    listActiveSessions('route')
      .then((sessions) => {
        if (cancelled) return
        const morgue = sessions.find(
          (s) => s.context.type === 'route' && s.context.kind === 'morgue' && s.context.date === today,
        )
        setActiveSession(morgue ?? null)
        if (morgue && morgue.context.type === 'route') {
          const ctx = morgue.context
          const event = useStore.getState().routeEvents.find((r) => r.id === ctx.route_event_id)
          if (event) {
            setFormState({
              dirtyReceivedIds: event.containers_dirty_received,
              cleanDeliveredIds: event.containers_clean_delivered,
              floor: event.floor,
              area: event.area,
              dock: event.dock,
              photos: [],
            })
          }
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[morgue] Error hidratando sesión activa:', err)
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => { cancelled = true }
  }, [today])

  const elapsed = useElapsed(activeSession?.started_at ?? null)

  function updateForm(updates: Partial<RouteFormState>) {
    setFormState((prev) => ({ ...prev, ...updates }))
    if (activeSession?.context.type === 'route') {
      updateRouteEvent(activeSession.context.route_event_id, {
        ...(updates.dirtyReceivedIds !== undefined && { containers_dirty_received: updates.dirtyReceivedIds }),
        ...(updates.cleanDeliveredIds !== undefined && { containers_clean_delivered: updates.cleanDeliveredIds }),
        ...(updates.floor !== undefined && { floor: updates.floor }),
        ...(updates.area !== undefined && { area: updates.area }),
        ...(updates.dock !== undefined && { dock: updates.dock }),
      })
    }
  }

  async function handleStart() {
    if (!client) return
    const now = new Date().toISOString()
    const routeEventId = `route-morgue-${Date.now()}`
    addRouteEvent({
      id: routeEventId,
      client_id: client.id,
      kind: 'morgue',
      slot: null,
      date: today,
      started_at: now,
      ended_at: null,
      operator_id: 'user-1',
      status: 'in_progress',
      containers_dirty_received: formState.dirtyReceivedIds,
      containers_clean_delivered: formState.cleanDeliveredIds,
      floor: formState.floor,
      area: formState.area,
      dock: formState.dock,
      photo_ids: [],
    })
    const session: ActiveSession = {
      key: routeMorgueSessionKey(today, now),
      type: 'route',
      started_at: now,
      context: {
        type: 'route',
        client_id: client.id,
        kind: 'morgue',
        slot: null,
        date: today,
        operator_id: 'user-1',
        route_event_id: routeEventId,
      },
    }
    await startSession(session)
    setActiveSession(session)
  }

  async function handleCancel() {
    if (!activeSession || activeSession.context.type !== 'route') return
    const ctx = activeSession.context
    deleteRouteEvent(ctx.route_event_id)
    await endSession(activeSession.key)
    setActiveSession(null)
    setFormState({ dirtyReceivedIds: [], cleanDeliveredIds: [], floor: '', area: '', dock: '', photos: [] })
    router.push('/register/route')
  }

  async function handleFinish() {
    if (!activeSession || activeSession.context.type !== 'route') return
    const now = new Date().toISOString()
    const routeEventId = activeSession.context.route_event_id

    const photoIds: string[] = []
    formState.photos.forEach((dataUrl, idx) => {
      const photoId = `photo-${Date.now()}-${idx}`
      const photo: Photo = {
        id: photoId,
        url: dataUrl,
        event_type: 'route',
        event_id: routeEventId,
        taken_at: now,
        label: `PTDP Morgue ${client?.name ?? ''} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`,
      }
      addPhoto(photo)
      photoIds.push(photoId)
    })

    const patch: Partial<RouteEvent> = {
      status: 'completed',
      ended_at: now,
      photo_ids: photoIds,
      containers_dirty_received: formState.dirtyReceivedIds,
      containers_clean_delivered: formState.cleanDeliveredIds,
      floor: formState.floor,
      area: formState.area,
      dock: formState.dock,
    }
    updateRouteEvent(routeEventId, patch)

    await endSession(activeSession.key)
    setActiveSession(null)

    router.push('/register/route')
  }

  if (!hydrated) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-muted-foreground">
        Cargando…
      </div>
    )
  }

  const isRunning = !!activeSession
  const totalContainers = formState.dirtyReceivedIds.length + formState.cleanDeliveredIds.length
  const canFinish = totalContainers > 0 && formState.photos.length > 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/register/route">
          <Button variant="ghost" size="icon" aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Recorrido de Morgue</h1>
          <p className="text-sm text-muted-foreground">Sin horario fijo · se registra al ejecutarse</p>
        </div>
      </div>

      {isRunning ? (
        <Card className="bg-accent/5 border-accent/30">
          <CardContent className="pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Recorrido en curso</p>
              <p className="text-3xl font-bold tabular-nums text-foreground mt-1">{formatElapsed(elapsed)}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmingCancel(true)}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button
                onClick={() => setConfirmingFinish(true)}
                disabled={!canFinish}
                className="gap-2"
              >
                <StopCircle className="h-4 w-4" />
                Finalizar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card">
          <CardContent className="pt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              El formulario está bloqueado. Iniciá el recorrido de Morgue para empezar el cronómetro.
            </p>
            <Button onClick={handleStart} className="gap-2 shrink-0">
              <Play className="h-4 w-4" />
              Iniciar recorrido
            </Button>
          </CardContent>
        </Card>
      )}

      <RouteForm
        state={formState}
        onChange={updateForm}
        containers={containers}
        companies={companies}
        locked={!isRunning}
      />

      {confirmingFinish && (
        <ConfirmDialog
          title="¿Finalizar el recorrido de Morgue?"
          body={`Duración: ${formatElapsed(elapsed)}. Sucios recogidos: ${formState.dirtyReceivedIds.length}. Limpios entregados: ${formState.cleanDeliveredIds.length}. Fotos: ${formState.photos.length}.`}
          confirmLabel="Sí, finalizar"
          tone="amber"
          onCancel={() => setConfirmingFinish(false)}
          onConfirm={async () => {
            setConfirmingFinish(false)
            await handleFinish()
          }}
        />
      )}

      {confirmingCancel && (
        <ConfirmDialog
          title="¿Cancelar el recorrido?"
          body="Esta acción descarta todos los datos ingresados (envases, ubicación, fotos)."
          confirmLabel="Sí, cancelar"
          tone="red"
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

interface ConfirmDialogProps {
  title: string
  body: string
  confirmLabel: string
  tone: 'amber' | 'red'
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmDialog({ title, body, confirmLabel, tone, onCancel, onConfirm }: ConfirmDialogProps) {
  const isRed = tone === 'red'
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
      onClick={onCancel}
    >
      <div
        className={`bg-card rounded-xl p-6 max-w-sm w-full space-y-4 shadow-xl ring-1 ${isRed ? 'ring-red-200' : 'ring-foreground/10'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isRed ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
            {isRed ? <X className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Volver</Button>
          <Button
            onClick={onConfirm}
            className={isRed ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: PASS. Las rutas registradas deben incluir `/register/route/morgue`.

- [ ] **Step 3: Smoke test**

Run: `npm run dev`
1. `/register/route` → chooser.
2. Click "Recorrido de Morgue" → carga la página de morgue.
3. Click "Iniciar recorrido" → arranca cronómetro.
4. Llenar piso/área/andén, seleccionar 1+ envases sucios y 1+ fotos.
5. Click "Finalizar" → confirmar → vuelve a `/register/route`.
6. Verificar que `useStore.getState().routeEvents` (en DevTools) contiene un evento con `kind: 'morgue'`, `slot: null`, `status: 'completed'`.

- [ ] **Step 4: Commit**

```bash
git add src/app/register/route/morgue
git commit -m "feat(recorridos): flujo Morgue sin horario fijo"
```

---

## PARTE 3 — DASHBOARD (reemplazar cámara fría)

### Task 9: Reemplazar `containersInStorage` por `containersPendingWeighing`

**Decisión (acordada con usuario):** la nueva métrica es **"Envases pendientes de pesar"**: envases activos que fueron recogidos sucios en algún recorrido y aún no tienen `ContainerReception` registrado. Es operacional — refleja la cola de trabajo pendiente del pesador.

Reusa la misma lógica que ya filtra `availableContainers` en `src/app/register/weighing/page.tsx` (líneas 81-86). Se extrae a `src/lib/data/containers.ts` para no duplicar.

**Files:**
- Modify: `src/lib/data/containers.ts` (agregar helper)
- Modify: `src/components/dashboard/metrics-cards.tsx`
- Modify: `src/app/dashboard/page.tsx:26-29` (pasar `receptions` a `computeDashboardMetrics`)
- Modify: `src/app/register/weighing/page.tsx:81-86` (consumir el helper extraído, evitar duplicación)
- Test: `src/__tests__/components/metrics-cards.test.tsx`

- [ ] **Step 1: Extraer helper `getPendingWeighingContainerIds` a `src/lib/data/containers.ts`**

Leer el archivo actual:
```bash
grep -n "export function\|getRouteEventIdsForContainer" src/lib/data/containers.ts
```

Al final del archivo, agregar:

```ts
import type { ContainerReception, RouteEvent } from '@/lib/types'

/**
 * Devuelve los IDs de envases activos que fueron recogidos sucios en algún
 * recorrido y todavía no tienen reception. Es la cola de trabajo del pesador.
 */
export function getPendingWeighingContainerIds(
  containers: Container[],
  routeEvents: RouteEvent[],
  receptions: ContainerReception[],
): string[] {
  const pesadosIds = new Set(receptions.map((r) => r.container_id))
  return containers
    .filter((c) => {
      if (c.status !== 'active') return false
      if (pesadosIds.has(c.id)) return false
      return getRouteEventIdsForContainer(routeEvents, c.id).length > 0
    })
    .map((c) => c.id)
}
```

Si `Container`, `ContainerReception`, `RouteEvent` ya están importados arriba del archivo, no duplicar imports.

- [ ] **Step 2: Refactor `metrics-cards.tsx` — reemplazar `containersInStorage` por `containersPendingWeighing`**

En `src/components/dashboard/metrics-cards.tsx`:

```tsx
import { Boxes, Route, Scale, Flame, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPendingWeighingContainerIds } from '@/lib/data/containers'
import type {
  Container,
  ContainerReception,
  RouteEvent,
  TreatmentRun,
} from '@/lib/types'

interface DashboardMetrics {
  routesToday: number
  containersInCirculation: number
  containersPendingWeighing: number       // CHANGED — antes containersInStorage
  containersInTreatment: number
}

export function computeDashboardMetrics(
  containers: Container[],
  routeEvents: RouteEvent[],
  receptions: ContainerReception[],       // CHANGED — antes storageEvents
  treatmentRuns: TreatmentRun[],
  today: string = new Date().toISOString().slice(0, 10)
): DashboardMetrics {
  const routesToday = routeEvents.filter((r) => r.date === today).length
  const containersInCirculation = containers.filter((c) => c.status === 'active').length
  const containersPendingWeighing = getPendingWeighingContainerIds(containers, routeEvents, receptions).length
  const containersInTreatment = treatmentRuns.filter((t) => t.completed_at === null).length

  return {
    routesToday,
    containersInCirculation,
    containersPendingWeighing,
    containersInTreatment,
  }
}

interface CardSpec {
  key: keyof DashboardMetrics
  label: string
  icon: LucideIcon
  iconBg: string
  iconText: string
  decoration: string
}

const CARDS: CardSpec[] = [
  { key: 'routesToday',                label: 'Recorridos hoy',           icon: Route,  iconBg: 'bg-accent/10',  iconText: 'text-accent',     decoration: 'from-accent/15    to-accent/0' },
  { key: 'containersInCirculation',    label: 'Envases en circulación',   icon: Boxes,  iconBg: 'bg-primary/10', iconText: 'text-primary',    decoration: 'from-primary/15   to-primary/0' },
  { key: 'containersPendingWeighing',  label: 'Pendientes de pesar',      icon: Scale,  iconBg: 'bg-amber-100',  iconText: 'text-amber-700',  decoration: 'from-amber-200/40 to-amber-200/0' },
  { key: 'containersInTreatment',      label: 'En tratamiento',           icon: Flame,  iconBg: 'bg-violet-100', iconText: 'text-violet-700', decoration: 'from-violet-200/40 to-violet-200/0' },
]

// El resto del componente (Props, MetricsCards) queda igual.
```

Mantener el JSX de `MetricsCards` sin cambios — sigue iterando `CARDS` y leyendo `metrics[key]`.

- [ ] **Step 3: Actualizar `src/app/dashboard/page.tsx` para pasar `receptions`**

Cambiar la llamada y el `useMemo`:

```tsx
const metrics = useMemo(
  () => computeDashboardMetrics(containers, routeEvents, receptions, treatmentRuns),
  [containers, routeEvents, receptions, treatmentRuns],
)
```

`storageEvents` ya no es dependencia para esta métrica, sigue siéndolo para `computeCirculationBreakdown` que se mantiene igual.

- [ ] **Step 4: Reemplazar la duplicación en `weighing/page.tsx`**

En `src/app/register/weighing/page.tsx:80-86`, reemplazar el cómputo inline por el helper:

```ts
import { getPendingWeighingContainerIds, getRouteEventIdsForContainer } from '@/lib/data/containers'

// ... más abajo, reemplazar el bloque de availableContainers:
const pendingIds = new Set(getPendingWeighingContainerIds(containers, routeEvents, receptions))
const availableContainers = containers.filter((c) => pendingIds.has(c.id))
```

Si `getRouteEventIdsForContainer` ya no se usa en este archivo después del refactor, quitar el import. Verificar con grep.

- [ ] **Step 5: Actualizar tests de `metrics-cards`**

En `src/__tests__/components/metrics-cards.test.tsx`, ajustar:

a) Cambiar import:
```ts
import {
  MOCK_CONTAINERS,
  MOCK_ROUTE_EVENTS,
  MOCK_RECEPTIONS,                       // si no existe MOCK_RECEPTIONS, usar []
  MOCK_TREATMENT_RUNS,
} from '@/lib/mock-data'
```

Verificar el nombre real: `grep -n "MOCK_RECEPTIONS\|export const MOCK_" src/lib/mock-data.ts`. Si no existe el mock, pasar `[]` y los conteos serán predecibles.

b) Reemplazar el segundo test (cold storage) por uno de pendientes de pesar:

```ts
it('counts containers pending weighing', () => {
  // Con MOCK_RECEPTIONS vacío y todos los envases siendo recogidos en algún
  // recorrido, todos los activos están pendientes. Con receptions mockeadas,
  // se descuentan los ya pesados. Ajustar el número esperado tras inspeccionar
  // los mocks reales.
  const metrics = computeDashboardMetrics(
    MOCK_CONTAINERS,
    MOCK_ROUTE_EVENTS,
    MOCK_RECEPTIONS,
    MOCK_TREATMENT_RUNS,
  )
  // Calcular expected: cantidad de envases activos referenciados en algún
  // RouteEvent.containers_dirty_received que NO estén en MOCK_RECEPTIONS.
  // Con MOCK_ROUTE_EVENTS actuales: dirty = [I-001, I-002, A-001, A-002, I-003, A-003, A-004]
  // = 7 envases recogidos. Si MOCK_RECEPTIONS no tiene ninguno, esperar 7.
  expect(metrics.containersPendingWeighing).toBe(7)
})
```

Ajustar el `.toBe(7)` después de leer `MOCK_RECEPTIONS` real. Si hay receptions de esos envases, restarlos. Si `MOCK_RECEPTIONS` no existe, importarlo como `[] as const` localmente:

```ts
const MOCK_RECEPTIONS: ContainerReception[] = []
```

c) Actualizar la firma del tercer test (`counts routes for a given date`) — ahora la firma tiene `receptions` antes de `treatmentRuns`:

```ts
const metrics = computeDashboardMetrics(
  MOCK_CONTAINERS,
  MOCK_ROUTE_EVENTS,
  MOCK_RECEPTIONS,
  MOCK_TREATMENT_RUNS,
  '2026-05-17'
)
```

Eliminar el `MOCK_STORAGE_EVENTS` del import si ya no se usa.

- [ ] **Step 6: Correr tests**

Run: `npm run test:run -- src/__tests__/components/metrics-cards.test.tsx`
Expected: 3 tests pasan. Si el conteo de pendientes no matchea el esperado, leer los mocks (`grep -n "containers_dirty_received\|MOCK_RECEPTIONS" src/lib/mock-data.ts`), recalcular y ajustar el assertion.

- [ ] **Step 7: Smoke test del dashboard**

Run: `npm run dev`
Abrir `/dashboard`. El card que antes decía "En cámara fría" ahora dice "Pendientes de pesar" con ícono de balanza (lucide `Scale`) en tono ámbar. El número debe corresponder al cómputo (probablemente 0 con los mocks limpios actuales — verificar con `useStore` o registrando un recorrido).

- [ ] **Step 8: Build final**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/containers.ts src/components/dashboard/metrics-cards.tsx src/app/dashboard/page.tsx src/app/register/weighing/page.tsx src/__tests__/components/metrics-cards.test.tsx
git commit -m "feat(dashboard): reemplazar 'camara fria' por 'pendientes de pesar'"
```

---

## Cierre de Sesión 1

- [ ] **Sanity final:** correr `npm run build` y `npm run test:run`. Ambos deben pasar.
- [ ] **Smoke test e2e manual** (5 minutos):
  1. `/register/route` → chooser visible con dos opciones.
  2. Andén → 6 slots → iniciar uno, agregar envases sucios + limpios + fotos, finalizar.
  3. Morgue → iniciar, agregar envases + fotos, finalizar.
  4. `/register/weighing` → form con orden envase → peso → observaciones → fotos. Pesar uno con observación.
  5. Drawer muestra la observación.
  6. `/dashboard` → card "Pendientes de pesar" en lugar de "En cámara fría". El número refleja la cola real.
- [ ] **Actualizar vault:** crear `vault/logs/2026-05-21-sesion1-pesaje-recorridos-dashboard.md` con: qué se hizo, archivos tocados, decisiones (kind nullable slot, métrica de pendientes), commits incluidos.

**Siguiente sesión (Sesión 2 + Supabase + deploy):** plan aparte. No se toca aquí.

---

## Riesgos durante ejecución

1. **TypeScript ripple del `kind` y `slot` nullable.** Cualquier consumer que asuma `RouteEvent.slot` no-null romperá. Mitigación: el grep de Task 5 step 4 cubre los call sites conocidos; si aparecen más en runtime, agregar `r.kind === 'anden'` o `r.slot ?? '—'` según el caso.
2. **Imports rotos por mover `[slot]/page.tsx`.** Mitigación: Task 7 step 1 usa `git mv` para preservar historial; step 2 corrige todos los imports/usos uno por uno.
3. **`MOCK_RECEPTIONS` puede no existir.** Si los tests no encuentran el mock, declarar `[]` local. Documentado en Task 9 step 5.
4. **Componente `<Textarea>` propio puede no existir.** Plan usa `<textarea>` nativo con clases Tailwind; si el design system tiene `Textarea`, sustituir en Task 2 step 1.
