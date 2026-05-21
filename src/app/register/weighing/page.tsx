'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, StopCircle, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  WeighingForm,
  EMPTY_WEIGHING_FORM,
  type WeighingFormState,
} from '@/components/register/weighing-form'
import { WeighingSessionDrawer } from '@/components/register/weighing-session-drawer'
import { useStore } from '@/lib/store'
import { useElapsed, formatElapsed } from '@/hooks/use-elapsed'
import {
  startSession,
  endSession,
  getActiveSession,
  weighingSessionKey,
  todayLocal,
  type ActiveSession,
} from '@/lib/active-session'
import { getPendingWeighingContainerIds } from '@/lib/data/containers'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'

export default function WeighingPage() {
  const router = useRouter()
  const {
    clients, companies, containers, weighingSessions, receptions, routeEvents, photos,
    addWeighingSession, updateWeighingSession, deleteWeighingSession,
    addReception, updateReception,
    addPhoto, addStorageEvent, addLocation,
    currentProfileId,
  } = useStore()
  const supabase = createClient()

  const [today] = useState<string>(todayLocal)
  const [hydrated, setHydrated] = useState(false)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [editingReceptionId, setEditingReceptionId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [formState, setFormState] = useState<WeighingFormState>(EMPTY_WEIGHING_FORM)

  const client = clients[0]

  // Hidrata desde IndexedDB al montar. Si falla, seguimos sin sesión activa.
  useEffect(() => {
    let cancelled = false
    const key = weighingSessionKey(today)
    getActiveSession(key)
      .then((session) => {
        if (cancelled) return
        setActiveSession(session ?? null)
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[weighing] Error hidratando sesión activa:', err)
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => { cancelled = true }
  }, [today])

  const sessionId =
    activeSession?.context.type === 'weighing'
      ? activeSession.context.weighing_session_id
      : null

  const session = sessionId ? weighingSessions.find((s) => s.id === sessionId) ?? null : null
  const sessionReceptions = session
    ? receptions.filter((r) => session.reception_ids.includes(r.id))
    : []

  const isRunning = !!activeSession
  const isEditing = editingReceptionId != null
  const elapsed = useElapsed(activeSession?.started_at ?? null)

  // Envases disponibles para pesar = cola de trabajo del pesador (helper compartido con dashboard).
  const pendingIds = new Set(getPendingWeighingContainerIds(containers, routeEvents, receptions))
  const availableContainers = containers.filter((c) => pendingIds.has(c.id))

  function updateForm(updates: Partial<WeighingFormState>) {
    setFormState((prev) => ({ ...prev, ...updates }))
  }

  function resetForm() {
    setFormState(EMPTY_WEIGHING_FORM)
    setEditingReceptionId(null)
  }

  async function handleStart() {
    if (!client || !currentProfileId) return
    const now = new Date().toISOString()
    // Crear sesión en Supabase y usar el id que retorna
    let createdId: string
    try {
      const row = await q.createWeighingSession(supabase, {
        client_id: client.id,
        date: today,
        started_at: now,
        operator_id: currentProfileId,
        status: 'in_progress',
      })
      createdId = row.id
    } catch (err) {
      console.error('[pesaje] crear sesión falló:', err)
      return
    }
    addWeighingSession({
      id: createdId,
      client_id: client.id,
      date: today,
      started_at: now,
      ended_at: null,
      operator_id: currentProfileId,
      status: 'in_progress',
      reception_ids: [],
    })
    const newSession: ActiveSession = {
      key: weighingSessionKey(today),
      type: 'weighing',
      started_at: now,
      context: {
        type: 'weighing',
        client_id: client.id,
        date: today,
        operator_id: currentProfileId,
        weighing_session_id: createdId,
      },
    }
    await startSession(newSession)
    setActiveSession(newSession)
  }

  function buildPhotoLabel(): string {
    return `PTDP ${client?.name ?? ''} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`
  }

  async function handleSubmitForm() {
    if (!sessionId || !session || !currentProfileId) return
    const gross = parseFloat(formState.gross_weight)
    if (!formState.container_id || !formState.photo_container || !formState.photo_scale || Number.isNaN(gross)) return

    if (editingReceptionId) {
      await handleSaveEdit(editingReceptionId, gross)
    } else {
      await handleCreateReception(sessionId, gross)
    }
  }

  async function handleCreateReception(currentSessionId: string, gross: number) {
    if (!session || !currentProfileId) return
    const now = new Date().toISOString()
    const label = buildPhotoLabel()

    // 1) Insertar reception en Supabase para obtener el id real
    let receptionId: string
    try {
      const row = await q.createReception(supabase, {
        container_id: formState.container_id,
        weighing_session_id: currentSessionId,
        arrived_at: now,
        gross_weight_kg: gross,
        operator_id: currentProfileId,
        observations: formState.observations,
      })
      receptionId = row.id
    } catch (err) {
      console.error('[pesaje] crear reception falló:', err)
      return
    }

    // 2) Fotos: por ahora viven en memoria (mock). Fase 5 las sube a Storage.
    const photoContainerId = `photo-${Date.now()}-c`
    const photoScaleId = `photo-${Date.now()}-s`
    addPhoto({
      id: photoContainerId,
      url: formState.photo_container!,
      event_type: 'weighing',
      event_id: receptionId,
      taken_at: now,
      label,
    })
    addPhoto({
      id: photoScaleId,
      url: formState.photo_scale!,
      event_type: 'weighing',
      event_id: receptionId,
      taken_at: now,
      label,
    })

    // 3) Actualizar store
    addReception({
      id: receptionId,
      container_id: formState.container_id,
      weighing_session_id: currentSessionId,
      arrived_at: now,
      gross_weight_kg: gross,
      operator_id: currentProfileId,
      photo_ids: [photoContainerId, photoScaleId],
      observations: formState.observations,
    })
    updateWeighingSession(currentSessionId, {
      reception_ids: [...session.reception_ids, receptionId],
    })

    resetForm()
  }

  async function handleSaveEdit(receptionId: string, gross: number) {
    const existing = receptions.find((r) => r.id === receptionId)
    if (!existing) return
    const now = new Date().toISOString()
    const label = buildPhotoLabel()

    // 1) Actualizar reception en Supabase
    try {
      await q.updateReception(supabase, receptionId, {
        container_id: formState.container_id,
        gross_weight_kg: gross,
        observations: formState.observations,
      })
    } catch (err) {
      console.error('[pesaje] editar reception falló:', err)
      return
    }

    // 2) Fotos en memoria (fase 5)
    const photoContainerId = `photo-${Date.now()}-c-edit`
    const photoScaleId = `photo-${Date.now()}-s-edit`
    addPhoto({
      id: photoContainerId,
      url: formState.photo_container!,
      event_type: 'weighing',
      event_id: receptionId,
      taken_at: now,
      label,
    })
    addPhoto({
      id: photoScaleId,
      url: formState.photo_scale!,
      event_type: 'weighing',
      event_id: receptionId,
      taken_at: now,
      label,
    })
    updateReception(receptionId, {
      container_id: formState.container_id,
      gross_weight_kg: gross,
      photo_ids: [photoContainerId, photoScaleId],
      observations: formState.observations,
    })

    resetForm()
  }

  function handleSelectForEdit(receptionId: string) {
    const r = receptions.find((rr) => rr.id === receptionId)
    if (!r) return

    // Cargar las fotos existentes desde el store (sus dataURLs)
    const containerPhoto = photos.find((p) => p.id === r.photo_ids[0])?.url ?? null
    const scalePhoto = photos.find((p) => p.id === r.photo_ids[1])?.url ?? null

    setFormState({
      container_id: r.container_id,
      photo_container: containerPhoto,
      photo_scale: scalePhoto,
      gross_weight: String(r.gross_weight_kg),
      observations: r.observations,
    })
    setEditingReceptionId(receptionId)
    setDrawerOpen(false)
  }

  function handleCancelEdit() {
    resetForm()
  }

  async function handleDeleteEditing() {
    if (!editingReceptionId || !sessionId || !session) return
    try {
      await q.deleteReception(supabase, editingReceptionId)
    } catch (err) {
      console.error('[pesaje] borrar reception falló:', err)
      return
    }
    updateWeighingSession(sessionId, {
      reception_ids: session.reception_ids.filter((id) => id !== editingReceptionId),
    })
    resetForm()
  }

  async function handleCancel() {
    if (!activeSession || activeSession.context.type !== 'weighing') return
    const ctx = activeSession.context
    // Borra sesión + receptions en Supabase, luego en store
    try {
      await q.deleteWeighingSession(supabase, ctx.weighing_session_id)
    } catch (err) {
      console.error('[pesaje] borrar sesión falló:', err)
      return
    }
    deleteWeighingSession(ctx.weighing_session_id)
    await endSession(activeSession.key)
    setActiveSession(null)
    resetForm()
    router.push('/dashboard')
  }

  async function handleFinish() {
    if (!activeSession || activeSession.context.type !== 'weighing' || !session || !currentProfileId) return
    const ctx = activeSession.context
    const now = new Date().toISOString()

    // 1. Cerrar la sesión en Supabase y luego en store
    try {
      await q.updateWeighingSession(supabase, ctx.weighing_session_id, {
        status: 'completed',
        ended_at: now,
      })
    } catch (err) {
      console.error('[pesaje] cerrar sesión falló:', err)
      return
    }
    updateWeighingSession(ctx.weighing_session_id, {
      status: 'completed',
      ended_at: now,
    })

    // 2. Crear StorageEvent + ContainerLocation por cada reception
    sessionReceptions.forEach((r, idx) => {
      addStorageEvent({
        id: `storage-${Date.now()}-${idx}`,
        container_id: r.container_id,
        entry_at: now,
        exit_at: null,
        operator_id: currentProfileId,
        photo_ids: [],
      })
      addLocation({
        id: `loc-${Date.now()}-${idx}`,
        container_id: r.container_id,
        reported_at: now,
        operator_id: currentProfileId,
        location_type: 'cold_storage',
        client_id: null,
        floor: null,
        area: null,
        notes: 'Cámara fría (auto tras pesaje)',
      })
    })

    // 3. Borrar la ActiveSession
    await endSession(activeSession.key)
    setActiveSession(null)

    // 4. Volver a dashboard
    router.push('/dashboard')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!hydrated) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-muted-foreground">
        Cargando…
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Pesaje</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inicia la sesión de pesaje para registrar varios envases de forma continua.
          Cada registro se puede editar desde la lista lateral hasta finalizar.
        </p>
      </header>

      {/* Banner de estado */}
      {isRunning ? (
        <Card className="bg-accent/5 border-accent/30">
          <CardContent className="pt-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Sesión de pesaje en curso
              </p>
              <p className="text-3xl font-bold tabular-nums text-foreground mt-1">
                {formatElapsed(elapsed)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {sessionReceptions.length} envase{sessionReceptions.length !== 1 ? 's' : ''} registrado{sessionReceptions.length !== 1 ? 's' : ''}
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
              <Button
                onClick={() => setConfirmingFinish(true)}
                disabled={sessionReceptions.length === 0}
                className="gap-2"
              >
                <StopCircle className="h-4 w-4" />
                Finalizar pesaje
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              El formulario está bloqueado. Inicia el pesaje para empezar el cronómetro y registrar envases.
            </p>
            <Button onClick={handleStart} className="gap-2 shrink-0">
              <Play className="h-4 w-4" />
              Iniciar pesaje
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Banner de modo edición */}
      {isEditing && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
          Editando envase <strong className="font-mono">{formState.container_id}</strong>.
          Los cambios se guardan en la sesión actual.
        </div>
      )}

      {/* Formulario */}
      <WeighingForm
        state={formState}
        onChange={updateForm}
        availableContainers={availableContainers}
        allContainers={containers}
        companies={companies}
        locked={!isRunning}
        mode={isEditing ? 'edit' : 'create'}
        onSubmit={handleSubmitForm}
        onCancelEdit={handleCancelEdit}
        onDelete={handleDeleteEditing}
      />

      {/* Drawer lateral */}
      <WeighingSessionDrawer
        receptions={sessionReceptions}
        containers={containers}
        selectedReceptionId={editingReceptionId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSelectReception={handleSelectForEdit}
      />

      {/* Dialog de confirmación de finalización */}
      {confirmingFinish && (
        <ConfirmFinishDialog
          count={sessionReceptions.length}
          elapsed={elapsed}
          onCancel={() => setConfirmingFinish(false)}
          onConfirm={async () => {
            setConfirmingFinish(false)
            await handleFinish()
          }}
        />
      )}

      {/* Dialog de confirmación de cancelación (destructiva) */}
      {confirmingCancel && (
        <ConfirmCancelDialog
          count={sessionReceptions.length}
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

interface DialogProps {
  count: number
  elapsed: number
  onCancel: () => void
  onConfirm: () => void
}

interface CancelDialogProps {
  count: number
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmCancelDialog({ count, onCancel, onConfirm }: CancelDialogProps) {
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
            <h2 className="text-base font-semibold text-foreground">¿Cancelar la sesión de pesaje?</h2>
            <p className="text-sm text-muted-foreground">
              Esta acción <strong className="text-red-700">descarta</strong> la sesión y
              los {count} envase{count !== 1 ? 's' : ''} ya registrado{count !== 1 ? 's' : ''},
              incluyendo sus fotos. Los envases no pasarán a cámara fría.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Seguir pesando</Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white">
            Sí, cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

function ConfirmFinishDialog({ count, elapsed, onCancel, onConfirm }: DialogProps) {
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
            <h2 className="text-base font-semibold text-foreground">¿Finalizar la sesión de pesaje?</h2>
            <p className="text-sm text-muted-foreground">
              Los {count} envase{count !== 1 ? 's' : ''} pasarán automáticamente a cámara fría.
              Después no se podrán editar los registros.
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
          <p>Duración: <strong className="font-mono">{formatElapsed(elapsed)}</strong></p>
          <p>Envases pesados: <strong>{count}</strong></p>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Seguir pesando</Button>
          <Button onClick={onConfirm}>Sí, finalizar</Button>
        </div>
      </div>
    </div>
  )
}
