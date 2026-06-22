'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Play, StopCircle, AlertCircle, X, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  WeighingForm,
  EMPTY_WEIGHING_FORM,
  type WeighingFormState,
} from '@/components/register/weighing-form'
import { WeighingSessionDrawer } from '@/components/register/weighing-session-drawer'
import { StartSessionButton } from '@/components/register/start-session-button'
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
import { getPendingWeighingContainerIds, getContainerCurrentCompanyId, formatTachoNumber, getMetallicContainers } from '@/lib/data/containers'
import { enqueueEventPhotos } from '@/lib/data/photos'
import { submitWeighingSession, submitReception, submitTreatmentRun, submitStorageEvent, submitContainerLocation, receptionOpId } from '@/lib/data/field-writes'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import { ConfirmVoidDialog } from '@/components/ui/confirm-void-dialog'

export default function WeighingPage() {
  const router = useRouter()
  const {
    clients, companies, containers, weighingSessions, receptions, routeEvents, photos,
    treatmentRuns, externalTransfers,
    addWeighingSession, updateWeighingSession, deleteWeighingSession,
    addReception, updateReception,
    addPhoto, addStorageEvent, addLocation, addTreatmentRun,
    currentProfileId,
  } = useStore()

  const [today] = useState<string>(todayLocal)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [editingReceptionId, setEditingReceptionId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [confirmingVoid, setConfirmingVoid] = useState(false)
  const [formState, setFormState] = useState<WeighingFormState>(EMPTY_WEIGHING_FORM)

  const client = clients[0]

  // Hidrata desde IndexedDB en background. No bloqueamos el render: si IDB
  // está lento o falla, la página sigue siendo usable como si no hubiera
  // sesión activa (start arranca una nueva).
  useEffect(() => {
    let cancelled = false
    const key = weighingSessionKey(today)
    getActiveSession(key)
      .then((session) => {
        if (cancelled) return
        if (session) setActiveSession(session)
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[weighing] Error hidratando sesión activa:', err)
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

  // Tachos disponibles para pesar = cola de trabajo del pesador (helper compartido con dashboard).
  // Excluimos los dedicados a Yaris: éstos viven en una lista aparte y solo se eligen cuando el operador activa el modo Yaris.
  const pendingIds = new Set(getPendingWeighingContainerIds(containers, routeEvents, receptions))
  const availableContainers = containers.filter(
    (c) => pendingIds.has(c.id) && !c.is_yaris_dedicated && !c.is_metallic_dedicated,
  )
  const yarisContainers = containers.filter(
    (c) => c.is_yaris_dedicated && c.status === 'active',
  )
  const metallicContainers = getMetallicContainers(containers)

  const inheritedCompanyId = formState.container_id
    ? getContainerCurrentCompanyId(formState.container_id, routeEvents, treatmentRuns, externalTransfers)
    : null
  const inheritedCompanyName = inheritedCompanyId
    ? companies.find((c) => c.id === inheritedCompanyId)?.name ?? null
    : null

  const skipped = activeSession?.context.type === 'weighing' ? (activeSession.context.skipped ?? []) : []
  const skippedIds = new Set(skipped.map((s) => s.container_id))
  const pendingList = availableContainers
    .map((c) => c.id)
    .filter((id) => !sessionReceptions.some((r) => r.container_id === id))
  const pendingNotSkipped = pendingList.filter((id) => !skippedIds.has(id))

  function updateForm(updates: Partial<WeighingFormState>) {
    setFormState((prev) => ({ ...prev, ...updates }))
  }

  function resetForm() {
    setFormState(EMPTY_WEIGHING_FORM)
    setEditingReceptionId(null)
  }

  async function markAbsent(containerId: string) {
    if (!activeSession || activeSession.context.type !== 'weighing') return
    const note = window.prompt('Nota (opcional) — por qué este tacho no se pesa:') ?? ''
    const next: ActiveSession = {
      ...activeSession,
      context: {
        ...activeSession.context,
        skipped: [
          ...(activeSession.context.skipped ?? []).filter((s) => s.container_id !== containerId),
          { container_id: containerId, note },
        ],
      },
    }
    await startSession(next)
    setActiveSession(next)
  }

  async function handleStart() {
    if (!currentProfileId || !client) return
    const now = new Date().toISOString()
    const createdId = crypto.randomUUID()
    await submitWeighingSession({
      id: createdId, client_id: client.id, date: today,
      started_at: now, operator_id: currentProfileId,
    })
    addWeighingSession({
      id: createdId, client_id: client.id, date: today, started_at: now,
      ended_at: null, operator_id: currentProfileId, status: 'in_progress', reception_ids: [],
    })
    const newSession: ActiveSession = {
      key: weighingSessionKey(today), type: 'weighing', started_at: now,
      context: { type: 'weighing', client_id: client.id, date: today, operator_id: currentProfileId, weighing_session_id: createdId },
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

  async function persistWeighingPhotos(
    receptionId: string, label: string, takenAt: string, dataUrls: (string | null | undefined)[],
  ): Promise<string[]> {
    const enqueued = await enqueueEventPhotos({
      dataUrls, eventType: 'weighing', eventId: receptionId, label,
      uploadedBy: currentProfileId, takenAt, parentOpId: receptionOpId(receptionId),
    })
    enqueued.forEach(addPhoto)
    return enqueued.map((p) => p.id)
  }

  async function handleCreateReception(currentSessionId: string, gross: number) {
    if (!session || !currentProfileId) return
    const now = new Date().toISOString()
    const label = buildPhotoLabel()
    const receptionId = crypto.randomUUID()

    await submitReception({
      id: receptionId, container_id: formState.container_id, weighing_session_id: currentSessionId,
      arrived_at: now, gross_weight_kg: gross, operator_id: currentProfileId,
      observations: formState.observations, company_id: inheritedCompanyId,
      waste_type: formState.waste_type, treat_immediately: formState.treat_immediately,
    })

    const photoIds = await persistWeighingPhotos(receptionId, label, now, [
      formState.photo_container, formState.photo_scale,
    ])

    addReception({
      id: receptionId, container_id: formState.container_id, weighing_session_id: currentSessionId,
      arrived_at: now, gross_weight_kg: gross, operator_id: currentProfileId, photo_ids: photoIds,
      observations: formState.observations, company_id: inheritedCompanyId,
      waste_type: formState.waste_type, treat_immediately: formState.treat_immediately,
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
      const supabase = createClient()
      await q.updateReception(supabase, receptionId, {
        container_id: formState.container_id,
        gross_weight_kg: gross,
        observations: formState.observations,
        waste_type: formState.waste_type,
        treat_immediately: formState.treat_immediately,
      })
    } catch (err) {
      console.error('[pesaje] editar reception falló:', err)
      return
    }

    // 2) Subir fotos a Storage + registrar en public.photos
    const photoIds = await persistWeighingPhotos(receptionId, label, now, [
      formState.photo_container,
      formState.photo_scale,
    ])
    updateReception(receptionId, {
      container_id: formState.container_id,
      gross_weight_kg: gross,
      photo_ids: photoIds,
      observations: formState.observations,
      waste_type: formState.waste_type,
      treat_immediately: formState.treat_immediately,
    })

    resetForm()
  }

  function handleSelectForEdit(receptionId: string) {
    const r = receptions.find((rr) => rr.id === receptionId)
    if (!r) return

    // Cargar las fotos existentes desde el store (sus dataURLs)
    const containerPhoto = photos.find((p) => p.id === r.photo_ids[0])?.url ?? null
    const scalePhoto = photos.find((p) => p.id === r.photo_ids[1])?.url ?? null

    const container = containers.find((c) => c.id === r.container_id)
    setFormState({
      container_id: r.container_id,
      photo_container: containerPhoto,
      photo_scale: scalePhoto,
      gross_weight: String(r.gross_weight_kg),
      observations: r.observations,
      is_yaris_weighing: container?.is_yaris_dedicated === true,
      waste_type: r.waste_type ?? 'infectious',
      treat_immediately: r.treat_immediately ?? false,
    })
    setEditingReceptionId(receptionId)
    setDrawerOpen(false)
  }

  function handleCancelEdit() {
    resetForm()
  }

  // Deshacer pesaje: anulación lógica (soft-delete) con motivo obligatorio.
  // No se borra la recepción; se marca voided_* para conservar trazabilidad y el
  // tacho vuelve a estar disponible para pesar.
  async function handleVoidEditing(reason: string) {
    if (!editingReceptionId || !sessionId || !session || !currentProfileId) return
    const now = new Date().toISOString()
    try {
      const supabase = createClient()
      await q.voidReception(supabase, editingReceptionId, currentProfileId, reason)
    } catch (err) {
      console.error('[pesaje] deshacer pesaje falló:', err)
      return
    }
    updateReception(editingReceptionId, {
      voided_at: now,
      voided_by: currentProfileId,
      void_reason: reason,
    })
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
      const supabase = createClient()
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

    // Cerrar sesión: optimista en store + intento online best-effort (si la
    // sesión aún está en cola, el upsert de creación ya la llevará como in_progress;
    // el cierre se reintenta al reabrir/hidratar). No bloquea.
    updateWeighingSession(ctx.weighing_session_id, { status: 'completed', ended_at: now })
    try {
      await q.updateWeighingSession(createClient(), ctx.weighing_session_id, { status: 'completed', ended_at: now })
    } catch (err) {
      console.error('[pesaje] cerrar sesión (online) falló, sigue local:', err)
    }

    // Derivados por reception: TreatmentRun (inmediato) o StorageEvent + ContainerLocation.
    for (const r of sessionReceptions) {
      if (r.treat_immediately && r.waste_type === 'infectious') {
        const trId = crypto.randomUUID()
        await submitTreatmentRun({ id: trId, container_id: r.container_id, started_at: now, completed_at: now, operator_id: currentProfileId })
        addTreatmentRun({ id: trId, container_id: r.container_id, started_at: now, completed_at: now, operator_id: currentProfileId })
        const locId = crypto.randomUUID()
        await submitContainerLocation({ id: locId, container_id: r.container_id, reported_at: now, operator_id: currentProfileId, location_type: 'treatment', client_id: null, floor: null, area: null, notes: 'Tratado al finalizar pesaje' })
        addLocation({ id: locId, container_id: r.container_id, reported_at: now, operator_id: currentProfileId, location_type: 'treatment', client_id: null, floor: null, area: null, notes: 'Tratado al finalizar pesaje' })
      } else {
        const stId = crypto.randomUUID()
        await submitStorageEvent({ id: stId, container_id: r.container_id, entry_at: now, operator_id: currentProfileId })
        addStorageEvent({ id: stId, container_id: r.container_id, entry_at: now, exit_at: null, operator_id: currentProfileId, photo_ids: [] })
        const locId = crypto.randomUUID()
        await submitContainerLocation({ id: locId, container_id: r.container_id, reported_at: now, operator_id: currentProfileId, location_type: 'cold_storage', client_id: null, floor: null, area: null, notes: 'Cámara fría (auto tras pesaje)' })
        addLocation({ id: locId, container_id: r.container_id, reported_at: now, operator_id: currentProfileId, location_type: 'cold_storage', client_id: null, floor: null, area: null, notes: 'Cámara fría (auto tras pesaje)' })
      }
    }

    await endSession(activeSession.key)
    setActiveSession(null)
    router.push('/dashboard')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
          <header className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pesaje</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Inicia la sesión de pesaje para registrar varios tachos de forma continua.
                Cada registro se puede editar desde la lista lateral hasta finalizar.
              </p>
            </div>
            <Link
              href="/register/weighing/history"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
            >
              <History className="h-4 w-4" />
              Historial
            </Link>
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
                    {sessionReceptions.length} tacho{sessionReceptions.length !== 1 ? 's' : ''} registrado{sessionReceptions.length !== 1 ? 's' : ''}
                  </p>
                  {pendingList.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Pendientes por pesar ({pendingNotSkipped.length}):{' '}
                      {pendingList.map((id) => (
                        <span key={id} className={cn('font-mono mr-1', skippedIds.has(id) && 'line-through opacity-60')}>
                          {formatTachoNumber(id)}
                          {!skippedIds.has(id) && (
                            <button type="button" onClick={() => markAbsent(id)} className="ml-0.5 text-[10px] underline">ausente</button>
                          )}
                        </span>
                      ))}
                    </p>
                  )}
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
                    disabled={sessionReceptions.length === 0 || pendingNotSkipped.length > 0}
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
                  El formulario está bloqueado. Inicia el pesaje para empezar el cronómetro y registrar tachos.
                </p>
                <StartSessionButton
                  sessionReady={!!currentProfileId}
                  onStart={handleStart}
                  icon={<Play className="h-4 w-4" />}
                >
                  Iniciar pesaje
                </StartSessionButton>
              </CardContent>
            </Card>
          )}

          {/* Banner de modo edición */}
          {isEditing && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
              Editando tacho <strong className="font-mono">{formState.container_id}</strong>.
              Los cambios se guardan en la sesión actual.
            </div>
          )}

          {/* Formulario */}
          <WeighingForm
            state={formState}
            onChange={updateForm}
            availableContainers={availableContainers}
            yarisContainers={yarisContainers}
            metallicContainers={metallicContainers}
            allContainers={containers}
            inheritedCompanyName={inheritedCompanyName}
            locked={!isRunning}
            mode={isEditing ? 'edit' : 'create'}
            onSubmit={handleSubmitForm}
            onCancelEdit={handleCancelEdit}
            onDelete={() => setConfirmingVoid(true)}
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

          {/* Dialog de "Deshacer pesaje" (anulación lógica con motivo obligatorio) */}
          {confirmingVoid && (
            <ConfirmVoidDialog
              title="¿Deshacer el pesaje?"
              description={<>El tacho <strong className="font-mono">{formState.container_id}</strong> volverá a quedar disponible para pesar. El registro no se borra: queda anulado con motivo para trazabilidad.</>}
              confirmLabel="Deshacer pesaje"
              onCancel={() => setConfirmingVoid(false)}
              onConfirm={async (reason) => { setConfirmingVoid(false); await handleVoidEditing(reason) }}
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
              los {count} tacho{count !== 1 ? 's' : ''} ya registrado{count !== 1 ? 's' : ''},
              incluyendo sus fotos. Los tachos no pasarán a cámara fría.
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
              Los {count} tacho{count !== 1 ? 's' : ''} pasarán automáticamente a cámara fría.
              Después no se podrán editar los registros.
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
          <p>Duración: <strong className="font-mono">{formatElapsed(elapsed)}</strong></p>
          <p>Tachos pesados: <strong>{count}</strong></p>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Seguir pesando</Button>
          <Button onClick={onConfirm}>Sí, finalizar</Button>
        </div>
      </div>
    </div>
  )
}

