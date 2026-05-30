'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, StopCircle, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RouteForm, type RouteFormState } from '@/components/register/route-form'
import { useStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import { uploadEventPhotos } from '@/lib/data/photos'
import { useElapsed, formatElapsed } from '@/hooks/use-elapsed'
import {
  startSession,
  endSession,
  listActiveSessions,
  routeMorgueSessionKey,
  todayLocal,
  type ActiveSession,
} from '@/lib/active-session'
import type { RouteEvent } from '@/lib/types'

export default function RegisterMorgueRoutePage() {
  const router = useRouter()
  const {
    clients, companies, containers,
    addRouteEvent, updateRouteEvent, deleteRouteEvent, addPhoto,
    currentProfileId,
  } = useStore()

  const [today] = useState<string>(todayLocal)
  const [companyId, setCompanyId] = useState('')
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
  const clientCompanies = companies.filter((c) => c.client_id === client?.id)

  useEffect(() => {
    let cancelled = false
    listActiveSessions('route')
      .then((sessions) => {
        if (cancelled) return
        const morgue = sessions.find(
          (s) => s.context.type === 'route' && s.context.kind === 'morgue' && s.context.date === today,
        )
        if (!morgue) return
        setActiveSession(morgue)
        if (morgue.context.type === 'route') {
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
    if (!currentProfileId) {
      alert('Todavía no se cargó tu sesión (sin conexión con el servidor). Esperá a reconectar e intentá de nuevo.')
      return
    }
    if (!client) return
    if (!companyId) { alert('Seleccioná la empresa del recorrido antes de iniciar.'); return }
    const now = new Date().toISOString()

    // Crear el recorrido en Supabase y usar el id (uuid) que retorna.
    let routeEventId: string
    try {
      const supabase = createClient()
      const row = await q.createRouteEvent(supabase, {
        client_id: client.id,
        company_id: companyId || null,
        kind: 'morgue',
        slot: null,
        date: today,
        started_at: now,
        operator_id: currentProfileId,
        status: 'in_progress',
      })
      routeEventId = row.id
    } catch (err) {
      console.error('[recorrido morgue] crear recorrido falló:', err)
      return
    }

    addRouteEvent({
      id: routeEventId,
      client_id: client.id,
      company_id: companyId || null,
      kind: 'morgue',
      slot: null,
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
      photo_ids: [],
    })
    const session: ActiveSession = {
      key: routeMorgueSessionKey(today, now),
      type: 'route',
      started_at: now,
      context: {
        type: 'route',
        client_id: client.id,
        company_id: companyId,
        kind: 'morgue',
        slot: null,
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
    // Borrar en Supabase (cascade limpia las join tables) y luego en store.
    try {
      const supabase = createClient()
      await q.deleteRouteEvent(supabase, ctx.route_event_id)
    } catch (err) {
      console.error('[recorrido morgue] borrar recorrido falló:', err)
      return
    }
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

    const supabase = createClient()
    const label = `PTDP Morgue ${client?.name ?? ''} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`

    // 1. PRIMERO lo crítico: cerrar el recorrido + sincronizar tachos (rápido).
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
      console.error('[recorrido morgue] cerrar recorrido falló:', err)
      alert('No se pudo finalizar el recorrido. Revisá tu conexión e intentá de nuevo.')
      return
    }

    // 2. DESPUÉS las fotos (lento). El recorrido ya quedó cerrado.
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
      console.error('[recorrido morgue] subir fotos falló (recorrido ya cerrado):', err)
      alert('El recorrido se finalizó, pero algunas fotos no se subieron por la conexión.')
    }

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
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Empresa del recorrido <span className="text-red-500">*</span></label>
              <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                <SelectContent>
                  {clientCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Iniciá el recorrido de Morgue para empezar el cronómetro.</p>
              <Button onClick={handleStart} disabled={!companyId} className="gap-2 shrink-0">
                <Play className="h-4 w-4" />
                Iniciar recorrido
              </Button>
            </div>
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
          body="Esta acción descarta todos los datos ingresados (tachos, ubicación, fotos)."
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
