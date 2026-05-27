'use client'

import { use, useEffect, useState } from 'react'
import { notFound, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, StopCircle, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RouteForm, type RouteFormState } from '@/components/register/route-form'
import { useStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import { uploadEventPhotos } from '@/lib/data/photos'
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
import type { RouteSlot, RouteEvent } from '@/lib/types'

interface Props {
  params: Promise<{ slot: string }>
}

// Slots válidos para validar el path param
const VALID_SLOTS: RouteSlot[] = ['06:30', '10:30', '13:20', '14:30', '18:30', '21:00']

export default function RegisterRouteSlotPage({ params }: Props) {
  const { slot: rawSlot } = use(params)
  const slotId = decodeURIComponent(rawSlot) as RouteSlot
  if (!VALID_SLOTS.includes(slotId)) notFound()

  const slot = getRouteSlotDefinition(slotId)
  const router = useRouter()
  const {
    clients, companies, containers, routeEvents,
    addRouteEvent, updateRouteEvent, deleteRouteEvent, addPhoto,
    currentProfileId,
  } = useStore()

  const [today] = useState<string>(todayLocal)
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

  // Cliente: por ahora tomamos el primero (Centro de la Salud).
  const client = clients[0]

  // Hidrata el estado desde IndexedDB y el store al montar (una sola vez por
  // slot/día). NO depender de `routeEvents` porque cambia con cada edición
  // incremental del form y dispararía hidrataciones en loop.
  useEffect(() => {
    let cancelled = false
    const key = routeAndenSessionKey(today, slotId)
    getActiveSession(key)
      .then(async (session) => {
        if (cancelled) return

        // Caso 1: ya hay sesión activa en IndexedDB → restauramos su contexto.
        if (session) {
          setActiveSession(session)
          if (session.context.type === 'route') {
            const ctx = session.context
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
          return
        }

        // Caso 2: no hay sesión local pero quizá quedó un route_event in_progress
        // en Supabase (operador cerró la app sin finalizar, o cambió de dispositivo).
        // Lo reanudamos reconstruyendo la ActiveSession a partir del evento.
        const orphan = useStore.getState().routeEvents.find(
          (r) => r.kind === 'anden' && r.slot === slotId && r.date === today && r.status === 'in_progress',
        )
        if (!orphan || !currentProfileId) return
        const recovered: ActiveSession = {
          key,
          type: 'route',
          started_at: orphan.started_at,
          context: {
            type: 'route',
            client_id: orphan.client_id,
            kind: 'anden',
            slot: slotId,
            date: today,
            operator_id: orphan.operator_id,
            route_event_id: orphan.id,
          },
        }
        await startSession(recovered)
        if (cancelled) return
        setActiveSession(recovered)
        setFormState({
          dirtyReceivedIds: orphan.containers_dirty_received,
          cleanDeliveredIds: orphan.containers_clean_delivered,
          floor: orphan.floor,
          area: orphan.area,
          dock: orphan.dock,
          photos: [],
        })
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[route] Error hidratando sesión activa:', err)
      })
    return () => { cancelled = true }
  }, [today, slotId, currentProfileId])

  const completedEvent = routeEvents.find(
    (r) => r.kind === 'anden' && r.slot === slotId && r.date === today && r.status === 'completed',
  )
  const elapsed = useElapsed(activeSession?.started_at ?? null)

  function updateForm(updates: Partial<RouteFormState>) {
    setFormState((prev) => ({ ...prev, ...updates }))
    // Si hay un RouteEvent activo, persistimos los cambios incrementales en el store.
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
    if (!currentProfileId) {
      alert('Todavía no se cargó tu sesión (sin conexión con el servidor). Esperá a reconectar e intentá de nuevo.')
      return
    }
    if (!client) return
    const now = new Date().toISOString()

    // Crear el recorrido en Supabase y usar el id (uuid) que retorna.
    // Si ya existe uno in_progress (por unique parcial (date, slot) WHERE kind='anden'),
    // lo recuperamos y reanudamos en vez de fallar.
    const supabase = createClient()
    let routeEventId: string
    let startedAt = now
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
      // Probable 409 por (date, slot) ya in_progress → recuperar.
      console.warn('[recorrido andén] crear falló, intentando recuperar in_progress:', err)
      try {
        const existing = await q.findAndenInProgress(supabase, today, slotId)
        if (!existing) {
          console.error('[recorrido andén] no se pudo recuperar evento existente')
          return
        }
        routeEventId = existing.id
        startedAt = existing.started_at
      } catch (lookupErr) {
        console.error('[recorrido andén] lookup de recuperación falló:', lookupErr)
        return
      }
    }

    addRouteEvent({
      id: routeEventId,
      client_id: client.id,
      kind: 'anden',
      slot: slotId,
      date: today,
      started_at: startedAt,
      ended_at: null,
      operator_id: currentProfileId,
      status: 'in_progress',
      containers_dirty_received: formState.dirtyReceivedIds,
      containers_clean_delivered: formState.cleanDeliveredIds,
      floor: formState.floor,
      area: formState.area,
      dock: formState.dock,
      photo_ids: [],
    })
    const session: ActiveSession = {
      key: routeAndenSessionKey(today, slotId),
      type: 'route',
      started_at: startedAt,
      context: {
        type: 'route',
        client_id: client.id,
        kind: 'anden',
        slot: slotId,
        date: today,
        operator_id: currentProfileId,
        route_event_id: routeEventId,
      },
    }
    await startSession(session)
    setActiveSession(session)
  }

  async function handleCancel() {
    if (!activeSession || activeSession.context.type !== 'route') return
    const ctx = activeSession.context
    // Borrar el RouteEvent en Supabase (cascade limpia las join tables) y luego en store.
    try {
      const supabase = createClient()
      await q.deleteRouteEvent(supabase, ctx.route_event_id)
    } catch (err) {
      console.error('[recorrido andén] borrar recorrido falló:', err)
      return
    }
    deleteRouteEvent(ctx.route_event_id)
    // Borrar la ActiveSession de IndexedDB
    await endSession(activeSession.key)
    setActiveSession(null)
    setFormState({ dirtyReceivedIds: [], cleanDeliveredIds: [], floor: '', area: '', dock: '', photos: [] })
    router.push('/register/route/anden')
  }

  async function handleFinish() {
    if (!activeSession || activeSession.context.type !== 'route') return
    const now = new Date().toISOString()
    const routeEventId = activeSession.context.route_event_id

    const supabase = createClient()
    const label = `PTDP ${client?.name ?? ''} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`

    // 1. PRIMERO lo crítico: cerrar el recorrido y sincronizar los envases.
    //    Esto es rápido y es lo que NO debe quedar a medias. Si falla (sin
    //    señal), abortamos sin tocar fotos y el recorrido sigue editable.
    try {
      await q.updateRouteEvent(supabase, routeEventId, {
        status: 'completed',
        ended_at: now,
        floor: formState.floor,
        area: formState.area,
        dock: formState.dock,
      })
      await q.setRouteContainersDirty(supabase, routeEventId, formState.dirtyReceivedIds)
      await q.setRouteContainersClean(supabase, routeEventId, formState.cleanDeliveredIds)
    } catch (err) {
      console.error('[recorrido andén] cerrar recorrido falló:', err)
      alert('No se pudo finalizar el recorrido. Revisá tu conexión e intentá de nuevo.')
      return
    }

    // 2. DESPUÉS las fotos (lento). El recorrido ya quedó cerrado, así que si
    //    las fotos fallan no dejamos un evento huérfano: solo se pierden fotos.
    let photoIds: string[] = []
    try {
      const uploadedPhotos = await uploadEventPhotos(supabase, {
        dataUrls: formState.photos,
        eventType: 'route',
        eventId: routeEventId,
        label,
        uploadedBy: currentProfileId,
        takenAt: now,
      })
      uploadedPhotos.forEach(addPhoto)
      photoIds = uploadedPhotos.map((p) => p.id)
    } catch (err) {
      console.error('[recorrido andén] subir fotos falló (recorrido ya cerrado):', err)
      alert('El recorrido se finalizó, pero algunas fotos no se subieron por la conexión.')
    }

    // 3. Cerrar el RouteEvent en el store
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

    // 4. Borrar la ActiveSession de IndexedDB
    await endSession(activeSession.key)
    setActiveSession(null)

    // 5. Volver al listado
    router.push('/register/route/anden')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Estado: ya completado hoy → read-only
  if (completedEvent) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Header slot={slot} />
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-4 space-y-2">
            <p className="font-semibold text-emerald-800">Recorrido completado</p>
            <p className="text-sm text-emerald-700">
              Iniciado {new Date(completedEvent.started_at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })} ·
              Finalizado {completedEvent.ended_at ? new Date(completedEvent.ended_at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </p>
            <p className="text-sm text-emerald-700">
              {completedEvent.containers_dirty_received.length} recogido{completedEvent.containers_dirty_received.length !== 1 ? 's' : ''}
              {' · '}
              {completedEvent.containers_clean_delivered.length} entregado{completedEvent.containers_clean_delivered.length !== 1 ? 's' : ''}
              {' · '}
              Piso {completedEvent.floor || '—'}, {completedEvent.area || '—'}, {completedEvent.dock || '—'}
            </p>
            <p className="text-xs text-emerald-700/80 mt-2">
              No se puede reiniciar la ruta de hoy. Disponible nuevamente mañana.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isRunning = !!activeSession

  const totalContainers = formState.dirtyReceivedIds.length + formState.cleanDeliveredIds.length
  const canFinish = totalContainers > 0 && formState.photos.length > 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header slot={slot} />

      {/* Banner de estado */}
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
            <div>
              <p className="text-sm text-muted-foreground">
                El formulario está bloqueado. Inicia el recorrido para empezar el cronómetro y registrar.
              </p>
            </div>
            <Button onClick={handleStart} className="gap-2 shrink-0">
              <Play className="h-4 w-4" />
              Iniciar recorrido
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Formulario */}
      <RouteForm
        state={formState}
        onChange={updateForm}
        containers={containers}
        companies={companies}
        locked={!isRunning}
      />

      {/* Modal de confirmación de finalización */}
      {confirmingFinish && (
        <ConfirmFinishDialog
          dirtyCount={formState.dirtyReceivedIds.length}
          cleanCount={formState.cleanDeliveredIds.length}
          photoCount={formState.photos.length}
          elapsed={elapsed}
          onCancel={() => setConfirmingFinish(false)}
          onConfirm={async () => {
            setConfirmingFinish(false)
            await handleFinish()
          }}
        />
      )}

      {/* Modal de confirmación de cancelación (destructiva) */}
      {confirmingCancel && (
        <ConfirmCancelDialog
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

function Header({ slot }: { slot: ReturnType<typeof getRouteSlotDefinition> }) {
  return (
    <div className="flex items-center gap-3">
      <Link href="/register/route/anden">
        <Button variant="ghost" size="icon" aria-label="Volver">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>
      <div>
        <h1 className="text-xl font-bold text-foreground">{slot.ordinal} ruta</h1>
        <p className="text-sm text-muted-foreground">Horario fijo {slot.shortLabel}</p>
      </div>
    </div>
  )
}

interface DialogProps {
  dirtyCount: number
  cleanCount: number
  photoCount: number
  elapsed: number
  onCancel: () => void
  onConfirm: () => void
}

interface CancelDialogProps {
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmCancelDialog({ onCancel, onConfirm }: CancelDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-card rounded-xl ring-1 ring-red-200 p-6 max-w-sm w-full space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <X className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">¿Cancelar el recorrido?</h2>
            <p className="text-sm text-muted-foreground">
              Esta acción <strong className="text-red-700">descarta</strong> todos los datos
              ingresados durante el recorrido (envases, ubicación, fotos). El slot vuelve a
              quedar disponible para iniciar.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Seguir registrando</Button>
          <Button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Sí, cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

function ConfirmFinishDialog({ dirtyCount, cleanCount, photoCount, elapsed, onCancel, onConfirm }: DialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-card rounded-xl ring-1 ring-foreground/10 p-6 max-w-sm w-full space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
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
          <p>Sucios recogidos: <strong>{dirtyCount}</strong></p>
          <p>Limpios entregados: <strong>{cleanCount}</strong></p>
          <p>Fotos: <strong>{photoCount}</strong></p>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Seguir registrando</Button>
          <Button onClick={onConfirm}>Sí, finalizar</Button>
        </div>
      </div>
    </div>
  )
}
