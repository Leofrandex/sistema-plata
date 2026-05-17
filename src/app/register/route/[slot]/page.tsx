'use client'

import { use, useEffect, useState } from 'react'
import { notFound, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, StopCircle, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RouteForm, type RouteFormState } from '@/components/register/route-form'
import { useStore } from '@/lib/store'
import { getRouteSlotDefinition } from '@/lib/constants'
import { useElapsed, formatElapsed } from '@/hooks/use-elapsed'
import {
  startSession,
  endSession,
  getActiveSession,
  routeSessionKey,
  todayLocal,
  type ActiveSession,
} from '@/lib/active-session'
import type { RouteSlot, RouteEvent, Photo } from '@/lib/types'

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

  // Cliente: por ahora tomamos el primero (Centro de la Salud).
  const client = clients[0]

  // Hidrata el estado desde IndexedDB y el store al montar (una sola vez por
  // slot/día). NO depender de `routeEvents` porque cambia con cada edición
  // incremental del form y dispararía hidrataciones en loop.
  useEffect(() => {
    let cancelled = false
    const key = routeSessionKey(today, slotId)
    getActiveSession(key)
      .then((session) => {
        if (cancelled) return
        setActiveSession(session ?? null)
        if (session && session.context.type === 'route') {
          const ctx = session.context
          // Leemos el routeEvent vía getState() para evitar acoplar este
          // effect a `routeEvents` (snapshot puntual, no suscripción).
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
        // Si IndexedDB falla, no dejamos el spinner colgado: seguimos como
        // si no hubiera sesión activa.
        // eslint-disable-next-line no-console
        console.error('[route] Error hidratando sesión activa:', err)
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => { cancelled = true }
  }, [today, slotId])

  const completedEvent = routeEvents.find(
    (r) => r.slot === slotId && r.date === today && r.status === 'completed',
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
    if (!client) return
    const now = new Date().toISOString()
    const routeEventId = `route-${Date.now()}`
    addRouteEvent({
      id: routeEventId,
      client_id: client.id,
      slot: slotId,
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
      key: routeSessionKey(today, slotId),
      type: 'route',
      started_at: now,
      context: {
        type: 'route',
        client_id: client.id,
        slot: slotId,
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
    // Borrar el RouteEvent del store (también limpia sus fotos persistidas)
    deleteRouteEvent(ctx.route_event_id)
    // Borrar la ActiveSession de IndexedDB
    await endSession(activeSession.key)
    setActiveSession(null)
    setFormState({ dirtyReceivedIds: [], cleanDeliveredIds: [], floor: '', area: '', dock: '', photos: [] })
    router.push('/register/route')
  }

  async function handleFinish() {
    if (!activeSession || activeSession.context.type !== 'route') return
    const now = new Date().toISOString()
    const routeEventId = activeSession.context.route_event_id

    // 1. Persistir todas las photos al store
    const photoIds: string[] = []
    formState.photos.forEach((dataUrl, idx) => {
      const photoId = `photo-${Date.now()}-${idx}`
      const photo: Photo = {
        id: photoId,
        url: dataUrl,
        event_type: 'route',
        event_id: routeEventId,
        taken_at: now,
        label: `PTDP ${client?.name ?? ''} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`,
      }
      addPhoto(photo)
      photoIds.push(photoId)
    })

    // 2. Cerrar el RouteEvent en el store
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

    // 3. Borrar la ActiveSession de IndexedDB
    await endSession(activeSession.key)
    setActiveSession(null)

    // 4. Volver al listado
    router.push('/register/route')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Loading skeleton mientras hidrata IndexedDB
  if (!hydrated) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-muted-foreground">
        Cargando…
      </div>
    )
  }

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
      <Link href="/register/route">
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
