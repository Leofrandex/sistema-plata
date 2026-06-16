# Firma por recorrido + saludo dashboard + redacción pesaje — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar una firma dibujada y obligatoria por cada registro de recorrido (andén y morgue), saludar por nombre al usuario en el dashboard, y reescribir el texto de "Tratar inmediatamente" en pesaje.

**Architecture:** La firma se persiste como una fila en `public.photos` con `role='signature'` (sin migración: `photos.role` ya es `string | null`), reutilizando `uploadEventPhotos` para subir y `groupRoutePhotosByRole` para hidratar. Un componente `SignaturePad` (canvas + pointer events nativos, sin librerías) se integra en `RouteForm`. El saludo lee el nombre del store (`users` + `currentProfileId`).

**Tech Stack:** Next.js (App Router, client components), TypeScript, Zustand (`src/lib/store.ts`), Supabase (`@supabase/ssr`), Jest (`npm run test:jest`), Tailwind.

---

## File Structure

- **Create:** `src/components/register/signature-pad.tsx` — componente de firma (colapsado + overlay con canvas).
- **Modify:** `src/lib/types.ts` — agregar `signature_photo_id?` a `RouteEvent`.
- **Modify:** `src/components/supabase-hydrator.tsx` — `groupRoutePhotosByRole` devuelve `signatureByEvent`; poblar `signature_photo_id`.
- **Modify:** `src/__tests__/lib/route-photos.test.ts` — cobertura del rol `signature`.
- **Modify:** `src/components/register/route-form.tsx` — campo de firma + props.
- **Modify:** `src/app/register/route/anden/[slot]/page.tsx` — subir/hidratar/validar firma (andén, con edición).
- **Modify:** `src/app/register/route/morgue/page.tsx` — subir/validar firma (morgue).
- **Modify:** `src/components/dashboard/dashboard-hero.tsx` — prop `name`.
- **Modify:** `src/app/dashboard/page.tsx` — resolver primer nombre y pasarlo.
- **Modify:** `src/components/register/weighing-form.tsx` — nuevo texto descriptivo.

Orden: primero hidratación+tipos+test (base de datos derivada), luego el componente, luego el wiring de pantallas, y al final los dos cambios independientes (dashboard, pesaje).

---

## Task 1: Hidratar la firma por evento

**Files:**
- Modify: `src/lib/types.ts:103-126`
- Modify: `src/components/supabase-hydrator.tsx:90-98`, `:254-271`
- Test: `src/__tests__/lib/route-photos.test.ts`

- [ ] **Step 1: Agregar el campo al tipo `RouteEvent`**

En `src/lib/types.ts`, dentro de `interface RouteEvent`, después de `clean_photo_ids?: string[]` (línea 125):

```typescript
  clean_photo_ids?: string[]
  // Firma dibujada del recorrido (foto con role='signature'). Una por registro.
  signature_photo_id?: string | null
```

- [ ] **Step 2: Escribir el test que falla para el rol `signature`**

En `src/__tests__/lib/route-photos.test.ts`, agregar dentro del `describe`:

```typescript
  it('agrupa la firma por evento (última gana)', () => {
    const rows: PhotoRow[] = [
      photo({ id: 's1', event_id: 'e1', role: 'signature' }),
      photo({ id: 'd1', event_id: 'e1', role: 'dirty' }),
      photo({ id: 's2', event_id: 'e2', role: 'signature' }),
      photo({ id: 's3', event_id: 'e2', role: 'signature' }),
    ]
    const { signatureByEvent } = groupRoutePhotosByRole(rows)
    expect(signatureByEvent.get('e1')).toBe('s1')
    expect(signatureByEvent.get('e2')).toBe('s3')
  })
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npm run test:jest -- route-photos`
Expected: FAIL — `signatureByEvent` es `undefined` (la función aún no lo devuelve).

- [ ] **Step 4: Extender `groupRoutePhotosByRole`**

En `src/components/supabase-hydrator.tsx`, reemplazar la función completa (líneas 254-271) por:

```typescript
/** Agrupa las fotos de eventos 'route' por rol (dirty/clean/signature) y por event_id.
 *  Las fotos sin role (legacy/pesaje) se ignoran. La firma es una sola por evento
 *  (si hubiera más de una, gana la última). Exportada para test. */
export function groupRoutePhotosByRole(photos: q.PhotoRow[]): {
  dirtyByEvent: Map<string, string[]>
  cleanByEvent: Map<string, string[]>
  signatureByEvent: Map<string, string>
} {
  const dirtyByEvent = new Map<string, string[]>()
  const cleanByEvent = new Map<string, string[]>()
  const signatureByEvent = new Map<string, string>()
  for (const p of photos) {
    if (p.event_type !== 'route') continue
    if (p.role === 'signature') {
      signatureByEvent.set(p.event_id, p.id)
      continue
    }
    const target = p.role === 'dirty' ? dirtyByEvent : p.role === 'clean' ? cleanByEvent : null
    if (!target) continue
    const arr = target.get(p.event_id) ?? []
    arr.push(p.id)
    target.set(p.event_id, arr)
  }
  return { dirtyByEvent, cleanByEvent, signatureByEvent }
}
```

- [ ] **Step 5: Poblar `signature_photo_id` al hidratar route_events**

En `src/components/supabase-hydrator.tsx`, reemplazar el bloque de líneas 90-98 por:

```typescript
        const { dirtyByEvent: dirtyPhotosByEvent, cleanByEvent: cleanPhotosByEvent, signatureByEvent } =
          groupRoutePhotosByRole(photosRaw)

        const routeEvents = mapRouteEvents(routeEventsRaw, dirtyLinks, cleanLinks).map((e) => ({
          ...e,
          photo_ids: photoIdsByEvent.get(e.id) ?? [],
          dirty_photo_ids: dirtyPhotosByEvent.get(e.id) ?? [],
          clean_photo_ids: cleanPhotosByEvent.get(e.id) ?? [],
          signature_photo_id: signatureByEvent.get(e.id) ?? null,
        }))
```

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `npm run test:jest -- route-photos`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/components/supabase-hydrator.tsx "src/__tests__/lib/route-photos.test.ts"
git commit -m "feat(recorrido): hidratar firma por evento (role=signature)"
```

---

## Task 2: Componente `SignaturePad`

**Files:**
- Create: `src/components/register/signature-pad.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/components/register/signature-pad.tsx` con este contenido completo:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { PenLine, X, Eraser, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  /** Data URL de la firma nueva (aún no subida). */
  value: string | null
  /** Firma ya subida (modo edición). */
  existing?: { id: string; url: string } | null
  /** Se llama al confirmar una firma nueva (dataUrl) o al borrarla (null). */
  onChange: (dataUrl: string | null) => void
  /** Quita la firma ya subida para permitir re-firmar. */
  onRemoveExisting?: () => void
  disabled?: boolean
}

export function SignaturePad({ value, existing, onChange, onRemoveExisting, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const preview = value ?? existing?.url ?? null
  const hasSignature = !!preview

  return (
    <section className="space-y-2">
      <header>
        <h2 className="text-sm font-semibold text-foreground">
          Firma del recorrido <span className="text-red-500">*</span>
        </h2>
        <p className="text-xs text-muted-foreground">Tocá el recuadro para firmar. Cada registro lleva su propia firma.</p>
      </header>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'w-full rounded-lg border-2 border-dashed transition-colors',
          'flex items-center justify-center text-muted-foreground',
          hasSignature ? 'border-accent/40 bg-card p-2' : 'h-28 border-border bg-muted/30 hover:bg-muted/50',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {preview ? (
          <div className="relative h-24 w-full">
            <Image src={preview} alt="Firma" fill className="object-contain" sizes="100vw" unoptimized />
          </div>
        ) : (
          <span className="flex items-center gap-2 text-sm">
            <PenLine className="h-4 w-4" /> Tocá para firmar
          </span>
        )}
      </button>

      {hasSignature && !disabled && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => {
              if (value) onChange(null)
              else onRemoveExisting?.()
            }}
          >
            Borrar firma
          </Button>
        </div>
      )}

      {open && (
        <SignatureOverlay
          onCancel={() => setOpen(false)}
          onConfirm={(dataUrl) => {
            onChange(dataUrl)
            if (existing) onRemoveExisting?.()
            setOpen(false)
          }}
        />
      )}
    </section>
  )
}

function SignatureOverlay({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: (dataUrl: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  // Ajusta el tamaño físico del canvas al de su contenedor (nitidez en DPR alto).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
  }, [])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    dirty.current = true
    if (!hasInk) setHasInk(true)
  }

  function end() {
    drawing.current = false
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    dirty.current = false
    setHasInk(false)
  }

  function confirm() {
    const canvas = canvasRef.current
    if (!canvas || !dirty.current) return
    onConfirm(canvas.toDataURL('image/png'))
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-foreground/80 p-4">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3">
        <div className="flex items-center justify-between text-primary-foreground">
          <h2 className="text-base font-semibold">Firmá en el recuadro</h2>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cerrar" className="text-primary-foreground hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full flex-1 touch-none rounded-xl bg-white"
        />
        <div className="flex gap-3">
          <Button variant="outline" onClick={clear} className="flex-1 gap-2">
            <Eraser className="h-4 w-4" /> Borrar
          </Button>
          <Button onClick={confirm} disabled={!hasInk} className="flex-1 gap-2">
            <Check className="h-4 w-4" /> Listo
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila (typecheck vía build no es necesario aún; lint rápido)**

Run: `npx tsc --noEmit`
Expected: Sin errores nuevos relacionados a `signature-pad.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/register/signature-pad.tsx
git commit -m "feat(recorrido): componente SignaturePad (canvas, overlay)"
```

---

## Task 3: Integrar la firma en `RouteForm`

**Files:**
- Modify: `src/components/register/route-form.tsx:18-46`, `:48-51`, `:246-262`

- [ ] **Step 1: Agregar `signature` al estado del formulario**

En `src/components/register/route-form.tsx`, dentro de `interface RouteFormState` (después de `cleanPhotos: string[]`, línea 28):

```typescript
  dirtyPhotos: string[]
  cleanPhotos: string[]
  /** Firma nueva (data URL) a subir. */
  signature: string | null
```

- [ ] **Step 2: Agregar las props de firma existente**

En la `interface Props` (después de `onRemoveExistingClean?: (id: string) => void`, línea 45):

```typescript
  onRemoveExistingClean?: (id: string) => void
  /** Firma ya subida que se conserva (modo edición). */
  existingSignature?: { id: string; url: string } | null
  onRemoveExistingSignature?: () => void
```

- [ ] **Step 3: Desestructurar las nuevas props**

En la firma de `export function RouteForm({ ... })` (líneas 48-51), agregar al final del destructuring:

```typescript
export function RouteForm({
  state, onChange, containers, companies, locked, showCompanySelector = false,
  existingDirtyPhotos, existingCleanPhotos, onRemoveExistingDirty, onRemoveExistingClean,
  existingSignature, onRemoveExistingSignature,
}: Props) {
```

- [ ] **Step 4: Importar y renderizar `SignaturePad`**

Agregar el import junto a los demás de `@/components/register/...` (cerca de la línea 9):

```typescript
import { SignaturePad } from '@/components/register/signature-pad'
```

Luego, en el JSX, inmediatamente después de la `section` de fotos de tachos limpios (cierre `</section>` de la línea 262) y antes del bloque "Limpiar selección de tachos":

```tsx
      {/* Firma del recorrido */}
      <SignaturePad
        value={state.signature}
        existing={existingSignature ?? null}
        onChange={(dataUrl) => onChange({ signature: dataUrl })}
        onRemoveExisting={onRemoveExistingSignature}
        disabled={locked}
      />
```

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: Errores en `anden/[slot]/page.tsx` y `morgue/page.tsx` por falta de `signature` en sus `RouteFormState` literales — se arreglan en Tasks 4 y 5. Ningún error dentro de `route-form.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/register/route-form.tsx
git commit -m "feat(recorrido): campo de firma en RouteForm"
```

---

## Task 4: Wiring de firma en Andén (con edición)

**Files:**
- Modify: `src/app/register/route/anden/[slot]/page.tsx:35-42`, `:62-64`, `:132-137`, `:192-234`, `:236-255`, `:276-313`, `:327-334`, `:426-433`

- [ ] **Step 1: Incluir `signature` en `EMPTY_FORM` y un estado para la firma existente**

En `src/app/register/route/anden/[slot]/page.tsx`, reemplazar `EMPTY_FORM` (líneas 35-42) por:

```typescript
const EMPTY_FORM: RouteFormState = {
  companyId: '',
  dirtyReceivedIds: [],
  cleanDeliveredIds: [],
  area: '',
  dirtyPhotos: [],
  cleanPhotos: [],
  signature: null,
}
```

Y agregar un estado para la firma existente junto a `existingClean` (después de la línea 64):

```typescript
  const [existingClean, setExistingClean] = useState<{ id: string; url: string }[]>([])
  const [existingSignature, setExistingSignature] = useState<{ id: string; url: string } | null>(null)
```

- [ ] **Step 2: Limpiar la firma existente en `resetForm`**

Reemplazar `resetForm` (líneas 132-137) por:

```typescript
  function resetForm() {
    setFormState(EMPTY_FORM)
    setEditingAndenId(null)
    setExistingDirty([])
    setExistingClean([])
    setExistingSignature(null)
  }
```

- [ ] **Step 3: Subir la firma en `handleCreateAnden`**

En `handleCreateAnden`, dentro del bloque try de subida de fotos (líneas 196-211), agregar la subida de la firma y capturar su id. Reemplazar el bloque que va desde `const label = buildLabel()` (línea 195) hasta el cierre del `catch` (línea 211) por:

```typescript
    let dirtyIds: string[] = []
    let cleanIds: string[] = []
    let signatureId: string | null = null
    const label = buildLabel()
    try {
      const upDirty = await uploadEventPhotos(supabase, {
        dataUrls: formState.dirtyPhotos, eventType: 'route', eventId: routeEventId,
        label, uploadedBy: currentProfileId, takenAt: now, role: 'dirty',
      })
      const upClean = await uploadEventPhotos(supabase, {
        dataUrls: formState.cleanPhotos, eventType: 'route', eventId: routeEventId,
        label, uploadedBy: currentProfileId, takenAt: now, role: 'clean',
      })
      const upSignature = await uploadEventPhotos(supabase, {
        dataUrls: [formState.signature], eventType: 'route', eventId: routeEventId,
        label, uploadedBy: currentProfileId, takenAt: now, role: 'signature',
      })
      ;[...upDirty, ...upClean, ...upSignature].forEach(addPhoto)
      dirtyIds = upDirty.map((p) => p.id)
      cleanIds = upClean.map((p) => p.id)
      signatureId = upSignature[0]?.id ?? null
    } catch (err) {
      console.error('[recorrido andén] subir fotos falló:', err)
      alert('El andén se guardó, pero algunas fotos no se subieron por la conexión.')
    }
```

Nota: `uploadEventPhotos` ignora data URLs falsy, así que pasar `[formState.signature]` con `null` no sube nada; aquí la firma es obligatoria por UI, así que siempre habrá valor.

- [ ] **Step 4: Guardar `signature_photo_id` en el `addRouteEvent` de creación**

En el `addRouteEvent({...})` de `handleCreateAnden` (líneas 214-231), agregar el campo después de `photo_ids`:

```typescript
      dirty_photo_ids: dirtyIds,
      clean_photo_ids: cleanIds,
      photo_ids: [...dirtyIds, ...cleanIds],
      signature_photo_id: signatureId,
    })
```

- [ ] **Step 5: Reconstruir la firma existente en `handleSelectAnden`**

En `handleSelectAnden` (líneas 236-255), después de `setExistingClean(...)` y antes de `setEditingAndenId(id)`:

```typescript
    setExistingClean((ev.clean_photo_ids ?? []).map(toPhoto).filter((x): x is { id: string; url: string } => x !== null))
    setExistingSignature(ev.signature_photo_id ? toPhoto(ev.signature_photo_id) : null)
    setEditingAndenId(id)
```

Y en el `setFormState({...})` del mismo handler (líneas 243-250), agregar `signature: null` al objeto:

```typescript
      dirtyPhotos: [],
      cleanPhotos: [],
      signature: null,
    })
```

- [ ] **Step 6: Subir la firma nueva en `handleUpdateAnden`**

En `handleUpdateAnden`, reemplazar el bloque de subida (líneas 276-298, desde el comentario `// 2) Subir fotos nuevas...` hasta `const cleanIds = [...existingClean...]`) por:

```typescript
    // 2) Subir fotos nuevas por categoría; conservar las existentes que quedaron.
    let newDirtyIds: string[] = []
    let newCleanIds: string[] = []
    let newSignatureId: string | null = null
    const label = buildLabel()
    try {
      const upDirty = await uploadEventPhotos(supabase, {
        dataUrls: formState.dirtyPhotos, eventType: 'route', eventId: id,
        label, uploadedBy: currentProfileId, takenAt: now, role: 'dirty',
      })
      const upClean = await uploadEventPhotos(supabase, {
        dataUrls: formState.cleanPhotos, eventType: 'route', eventId: id,
        label, uploadedBy: currentProfileId, takenAt: now, role: 'clean',
      })
      const upSignature = await uploadEventPhotos(supabase, {
        dataUrls: [formState.signature], eventType: 'route', eventId: id,
        label, uploadedBy: currentProfileId, takenAt: now, role: 'signature',
      })
      ;[...upDirty, ...upClean, ...upSignature].forEach(addPhoto)
      newDirtyIds = upDirty.map((p) => p.id)
      newCleanIds = upClean.map((p) => p.id)
      newSignatureId = upSignature[0]?.id ?? null
    } catch (err) {
      console.error('[recorrido andén] subir fotos nuevas falló:', err)
      alert('Los cambios se guardaron, pero algunas fotos nuevas no se subieron.')
    }

    const dirtyIds = [...existingDirty.map((p) => p.id), ...newDirtyIds]
    const cleanIds = [...existingClean.map((p) => p.id), ...newCleanIds]
    const signatureId = newSignatureId ?? existingSignature?.id ?? null
```

- [ ] **Step 7: Guardar `signature_photo_id` en el `updateRouteEvent` de edición**

En el `updateRouteEvent(id, {...})` de `handleUpdateAnden` (líneas 302-310), agregar el campo después de `photo_ids`:

```typescript
      dirty_photo_ids: dirtyIds,
      clean_photo_ids: cleanIds,
      photo_ids: [...dirtyIds, ...cleanIds],
      signature_photo_id: signatureId,
    })
```

- [ ] **Step 8: Handler para quitar la firma existente**

Después de `removeExistingClean` (línea 334), agregar:

```typescript
  function removeExistingSignature() {
    setExistingSignature(null)
    // Nota: quita la firma del registro pero no borra la fila/archivo en Supabase (queda huérfana). Pendiente: limpieza.
  }
```

- [ ] **Step 9: Exigir firma en `canSaveAnden` y pasar props a `RouteForm`**

Reemplazar el cálculo de `canSaveAnden` (líneas 426-433) por:

```typescript
  const hasDirtyPhoto = formState.dirtyPhotos.length > 0 || existingDirty.length > 0
  const hasCleanPhoto = formState.cleanPhotos.length > 0 || existingClean.length > 0
  const hasSignature = !!formState.signature || !!existingSignature
  const canSaveAnden =
    isRunning &&
    !!formState.companyId &&
    (formState.dirtyReceivedIds.length + formState.cleanDeliveredIds.length > 0) &&
    hasDirtyPhoto &&
    hasCleanPhoto &&
    hasSignature
```

Y en el JSX `<RouteForm ... />` (líneas 492-503), agregar las props de firma:

```tsx
        onRemoveExistingDirty={removeExistingDirty}
        onRemoveExistingClean={removeExistingClean}
        existingSignature={existingSignature}
        onRemoveExistingSignature={removeExistingSignature}
      />
```

- [ ] **Step 10: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: Sin errores en `anden/[slot]/page.tsx` (puede quedar el de `morgue/page.tsx`, se arregla en Task 5).

- [ ] **Step 11: Commit**

```bash
git add "src/app/register/route/anden/[slot]/page.tsx"
git commit -m "feat(recorrido): firma obligatoria en andén (crear/editar)"
```

---

## Task 5: Wiring de firma en Morgue

**Files:**
- Modify: `src/app/register/route/morgue/page.tsx:38-45`, `:66-73`, `:124-141`, `:202-232`, `:244`, `:316-322`

- [ ] **Step 1: Incluir `signature` en los `formState` literales**

En `src/app/register/route/morgue/page.tsx`, en el `useState<RouteFormState>` inicial (líneas 38-45), agregar `signature: null`:

```typescript
  const [formState, setFormState] = useState<RouteFormState>({
    companyId: '',
    dirtyReceivedIds: [],
    cleanDeliveredIds: [],
    area: '',
    dirtyPhotos: [],
    cleanPhotos: [],
    signature: null,
  })
```

En el `setFormState({...})` de hidratación dentro del `useEffect` (líneas 66-73), agregar `signature: null`:

```typescript
            setFormState({
              companyId: event.company_id ?? '',
              dirtyReceivedIds: event.containers_dirty_received,
              cleanDeliveredIds: event.containers_clean_delivered,
              area: event.area,
              dirtyPhotos: [],
              cleanPhotos: [],
              signature: null,
            })
```

En el `setFormState({...})` de `handleCancel` (línea 175), agregar `signature: null`:

```typescript
    setFormState({ companyId: '', dirtyReceivedIds: [], cleanDeliveredIds: [], area: '', dirtyPhotos: [], cleanPhotos: [], signature: null })
```

- [ ] **Step 2: Incluir `signature_photo_id` en `addRouteEvent`**

En `handleStart`, en el `addRouteEvent({...})` (líneas 124-141), agregar el campo después de `clean_photo_ids: []`:

```typescript
      photo_ids: [],
      dirty_photo_ids: [],
      clean_photo_ids: [],
      signature_photo_id: null,
    })
```

- [ ] **Step 3: Subir la firma en `handleFinish`**

En `handleFinish`, reemplazar el bloque de subida de fotos (líneas 202-220, desde el comentario `// 2. DESPUÉS las fotos...` hasta el cierre del `catch`) por:

```typescript
    // 2. DESPUÉS las fotos (lento). El recorrido ya quedó cerrado.
    let dirtyIds: string[] = []
    let cleanIds: string[] = []
    let signatureId: string | null = null
    try {
      const upDirty = await uploadEventPhotos(supabase, {
        dataUrls: formState.dirtyPhotos, eventType: 'route', eventId: routeEventId,
        label, uploadedBy: currentProfileId, takenAt: now, role: 'dirty',
      })
      const upClean = await uploadEventPhotos(supabase, {
        dataUrls: formState.cleanPhotos, eventType: 'route', eventId: routeEventId,
        label, uploadedBy: currentProfileId, takenAt: now, role: 'clean',
      })
      const upSignature = await uploadEventPhotos(supabase, {
        dataUrls: [formState.signature], eventType: 'route', eventId: routeEventId,
        label, uploadedBy: currentProfileId, takenAt: now, role: 'signature',
      })
      ;[...upDirty, ...upClean, ...upSignature].forEach(addPhoto)
      dirtyIds = upDirty.map((p) => p.id)
      cleanIds = upClean.map((p) => p.id)
      signatureId = upSignature[0]?.id ?? null
    } catch (err) {
      console.error('[recorrido morgue] subir fotos falló (recorrido ya cerrado):', err)
      alert('El recorrido se finalizó, pero algunas fotos no se subieron por la conexión.')
    }
```

- [ ] **Step 4: Guardar `signature_photo_id` en el patch**

En el `const patch: Partial<RouteEvent> = {...}` (líneas 222-231), agregar el campo después de `photo_ids`:

```typescript
      dirty_photo_ids: dirtyIds,
      clean_photo_ids: cleanIds,
      photo_ids: [...dirtyIds, ...cleanIds],
      signature_photo_id: signatureId,
```

- [ ] **Step 5: Exigir firma en `canFinish`**

Reemplazar la línea 244 por:

```typescript
  const canFinish = totalContainers > 0 && formState.dirtyPhotos.length > 0 && !!formState.signature
```

- [ ] **Step 6: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: Sin errores.

Nota: Morgue es un único registro que se finaliza; no hay modo edición de firma existente, por eso no se pasan `existingSignature`/`onRemoveExistingSignature` al `RouteForm` (líneas 316-322) — quedan como `undefined`, que el componente maneja.

- [ ] **Step 7: Commit**

```bash
git add src/app/register/route/morgue/page.tsx
git commit -m "feat(recorrido): firma obligatoria en morgue"
```

---

## Task 6: Saludo con nombre en el dashboard

**Files:**
- Modify: `src/components/dashboard/dashboard-hero.tsx:19-43`
- Modify: `src/app/dashboard/page.tsx:16-21`, `:48-51`

- [ ] **Step 1: Aceptar la prop `name` en `DashboardHero`**

En `src/components/dashboard/dashboard-hero.tsx`, reemplazar la firma y el `<h1>`. Cambiar la línea 19:

```tsx
export function DashboardHero({ name }: { name?: string }) {
```

Y reemplazar el `<h1>` (línea 39) por:

```tsx
        <h1 className="text-2xl font-bold sm:text-3xl">
          {greeting}{name ? `, ${name}` : ''}
        </h1>
```

- [ ] **Step 2: Resolver el nombre en la página y pasarlo**

En `src/app/dashboard/page.tsx`, agregar `users` y `currentProfileId` al destructuring del store (líneas 17-20):

```tsx
  const {
    clients, companies, containers, routeEvents, receptions,
    storageEvents, treatmentRuns, externalTransfers, locations,
    users, currentProfileId,
  } = useStore()
```

Calcular el primer nombre (después del bloque de `useState` del mes, cerca de la línea 24):

```tsx
  const firstName = useMemo(() => {
    const full = users.find((u) => u.id === currentProfileId)?.name
    return full ? full.split(' ')[0] : undefined
  }, [users, currentProfileId])
```

Y pasar la prop al render (línea 50):

```tsx
      <DashboardHero name={firstName} />
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: Sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/dashboard-hero.tsx src/app/dashboard/page.tsx
git commit -m "feat(dashboard): saludo con el nombre del usuario logueado"
```

---

## Task 7: Redacción de "Tratar inmediatamente"

**Files:**
- Modify: `src/components/register/weighing-form.tsx:357`

- [ ] **Step 1: Reemplazar el texto descriptivo**

En `src/components/register/weighing-form.tsx`, reemplazar la línea 357:

```tsx
            <p className="text-xs text-muted-foreground">Al finalizar el pesaje, este tacho salta cámara fría y queda disponible.</p>
```

por:

```tsx
            <p className="text-xs text-muted-foreground">Marcar para enviar el tacho directamente a tratamiento.</p>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/register/weighing-form.tsx
git commit -m "fix(pesaje): redacción de tratar inmediatamente"
```

---

## Task 8: Verificación final

- [ ] **Step 1: Correr toda la suite de tests**

Run: `npm run test:jest`
Expected: PASS — todos los tests (los previos + el nuevo de `signature`).

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: Build OK, sin errores de tipo ni de lint.

- [ ] **Step 3: (Manual, usuario) E2E de la firma**

Verificar en navegador: iniciar un recorrido de andén, completar tachos + fotos, tocar el recuadro de firma, dibujar, "Listo", guardar el andén; editar ese andén y confirmar que la firma se muestra; re-firmar y guardar. Repetir el flujo en morgue. Confirmar que el dashboard saluda con el nombre y que el texto de pesaje cambió.

---

## Notas de implementación

- **Sin migración de Supabase:** `photos.role` ya es `string | null`; la firma usa `role='signature'`.
- **`next/image` con data URL / URL firmada:** el `SignaturePad` usa `unoptimized` para evitar el optimizador con data URLs; las URLs firmadas de Supabase ya están permitidas en `next.config.ts`.
- **Fuera de alcance (confirmado en el spec):** firma en el PDF, limpieza de firmas huérfanas, constraint de obligatoriedad en DB.
