'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { notFound, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, StopCircle, AlertCircle, X, Plus } from 'lucide-react'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { Card, CardContent } from '@hospiwaste/shared/components/ui/card'
import { RouteForm, type RouteFormState } from '@/components/register/route-form'
import { RouteSessionDrawer } from '@/components/register/route-session-drawer'
import { StartSessionButton } from '@/components/register/start-session-button'
import { useStore } from '@hospiwaste/shared/lib/store'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import * as q from '@hospiwaste/shared/lib/supabase/queries'
import { uploadEventPhotos, saveEventPhotosLocal } from '@hospiwaste/shared/lib/data/photos'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { submitRouteEvent } from '@/lib/data/field-writes'
import { applyFieldEdit } from '@/lib/data/field-edits'
import { getSlotAndenEvents, computeSlotStatus } from '@hospiwaste/shared/lib/data/route-sessions'
import { getRouteSlotDefinition, paramToSlot } from '@hospiwaste/shared/lib/constants'
import { useElapsed, formatElapsed } from '@/hooks/use-elapsed'
import {
  startSession,
  endSession,
  getActiveSession,
  routeAndenSessionKey,
  todayLocal,
  type ActiveSession,
} from '@/lib/active-session'

interface Props {
  params: Promise<{ slot: string }>
}

const EMPTY_FORM: RouteFormState = {
  companyId: '',
  dirtyReceivedIds: [],
  cleanDeliveredIds: [],
  area: '',
  dirtyPhotos: [],
  cleanPhotos: [],
  signature: null,
}

export default function RegisterRouteSlotClient({ params }: Props) {
  const { slot: rawSlot } = use(params)
  const parsedSlot = paramToSlot(rawSlot)
  if (!parsedSlot) notFound()
  // Const no-nulo: garantiza el narrowing dentro de los closures (handleStart, etc.).
  const slotId = parsedSlot

  const slot = getRouteSlotDefinition(slotId)
  const router = useRouter()
  const {
    clients, companies, containers, routeEvents,
    addRouteEvent, updateRouteEvent, deleteRouteEvent, addPhoto, photos,
    currentProfileId,
  } = useStore()

  const [today] = useState<string>(todayLocal)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [formState, setFormState] = useState<RouteFormState>(EMPTY_FORM)
  // Andén actualmente en edición (null = creando uno nuevo).
  const [editingAndenId, setEditingAndenId] = useState<string | null>(null)
  // Fotos existentes del andén en edición que se conservan (no se re-suben).
  const [existingDirty, setExistingDirty] = useState<{ id: string; url: string }[]>([])
  const [existingClean, setExistingClean] = useState<{ id: string; url: string }[]>([])
  const [existingSignature, setExistingSignature] = useState<{ id: string; url: string } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [saving, setSaving] = useState(false)

  const client = clients[0]
  const clientCompanies = companies.filter((c) => c.client_id === client?.id)

  // Andenes in_progress de este horario/día = la sesión abierta.
  const sessionAndenes = useMemo(
    () => getSlotAndenEvents(routeEvents, today, slotId, 'in_progress'),
    [routeEvents, today, slotId],
  )
  const completedAndenes = useMemo(
    () => getSlotAndenEvents(routeEvents, today, slotId, 'completed'),
    [routeEvents, today, slotId],
  )

  // Hidrata la sesión abierta desde IndexedDB. Si no hay ActiveSession pero
  // existen andenes in_progress (app cerrada a mitad), reconstruye la sesión.
  useEffect(() => {
    let cancelled = false
    const key = routeAndenSessionKey(today, slotId)
    getActiveSession(key)
      .then(async (session) => {
        if (cancelled) return
        const events = useStore.getState().routeEvents
        // Si el horario ya cerró en la BD (andenes completed, ninguno in_progress),
        // cualquier sesión local es fantasma: limpiarla y no marcar "en curso".
        const decision = computeSlotStatus(events, today, slotId, session?.started_at ?? null)
        if (decision.status === 'completed') {
          if (session) await endSession(key)
          if (!cancelled) setActiveSession(null)
          return
        }
        if (session) {
          setActiveSession(session)
          return
        }
        const orphans = getSlotAndenEvents(events, today, slotId, 'in_progress')
        if (orphans.length === 0 || !currentProfileId) return
        const recovered: ActiveSession = {
          key,
          type: 'route',
          started_at: orphans[0].started_at,
          context: {
            type: 'route',
            client_id: orphans[0].client_id,
            company_id: orphans[0].company_id ?? null,
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
        // eslint-disable-next-line no-console
        console.error('[route] Error hidratando sesión activa:', err)
      })
    return () => { cancelled = true }
  }, [today, slotId, currentProfileId, routeEvents])

  const elapsed = useElapsed(activeSession?.started_at ?? null)
  const isRunning = !!activeSession
  const isEditing = editingAndenId != null

  function updateForm(updates: Partial<RouteFormState>) {
    setFormState((prev) => ({ ...prev, ...updates }))
  }

  function resetForm() {
    setFormState(EMPTY_FORM)
    setEditingAndenId(null)
    setExistingDirty([])
    setExistingClean([])
    setExistingSignature(null)
  }

  function buildLabel(): string {
    return `PTDP ${client?.name ?? ''} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`
  }

  async function handleSaveAnden() {
    if (!currentProfileId || !client || saving) return
    setSaving(true)
    try {
      if (editingAndenId) {
        await handleUpdateAnden(editingAndenId)
      } else {
        await handleCreateAnden()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateAnden() {
    if (!currentProfileId || !client) return
    const now = new Date().toISOString()
    const recordCompanyId = formState.companyId
    const routeEventId = crypto.randomUUID()

    await submitRouteEvent(
      {
        id: routeEventId, client_id: client.id, company_id: recordCompanyId || null,
        kind: 'anden', slot: slotId, date: today, started_at: now,
        operator_id: currentProfileId, status: 'in_progress', area: formState.area,
      },
      formState.dirtyReceivedIds,
      formState.cleanDeliveredIds,
    )

    const label = buildLabel()
    const toPhotos = (dataUrls: (string | null | undefined)[], role: string) =>
      dataUrls.filter((d): d is string => !!d).map((dataUrl) => ({ dataUrl, label, role }))
    const upDirty = await saveEventPhotosLocal('route', routeEventId, toPhotos(formState.dirtyPhotos, 'dirty'), currentProfileId)
    const upClean = await saveEventPhotosLocal('route', routeEventId, toPhotos(formState.cleanPhotos, 'clean'), currentProfileId)
    const upSig = await saveEventPhotosLocal('route', routeEventId, toPhotos(formState.signature ? [formState.signature] : [], 'signature'), currentProfileId)
    ;[...upDirty, ...upClean, ...upSig].forEach(addPhoto)
    const dirtyIds = upDirty.map((p) => p.id)
    const cleanIds = upClean.map((p) => p.id)
    const signatureId = upSig[0]?.id ?? null

    addRouteEvent({
      id: routeEventId, client_id: client.id, company_id: recordCompanyId || null,
      kind: 'anden', slot: slotId, date: today, started_at: now, ended_at: null,
      operator_id: currentProfileId, status: 'in_progress',
      containers_dirty_received: formState.dirtyReceivedIds,
      containers_clean_delivered: formState.cleanDeliveredIds,
      area: formState.area, dirty_photo_ids: dirtyIds, clean_photo_ids: cleanIds,
      photo_ids: [...dirtyIds, ...cleanIds], signature_photo_id: signatureId,
    })

    resetForm()
  }

  function handleSelectAnden(id: string) {
    const ev = routeEvents.find((r) => r.id === id)
    if (!ev) return
    const toPhoto = (pid: string) => {
      const p = photos.find((ph) => ph.id === pid)
      return p ? { id: p.id, url: p.url } : null
    }
    setFormState({
      companyId: ev.company_id ?? '',
      dirtyReceivedIds: ev.containers_dirty_received,
      cleanDeliveredIds: ev.containers_clean_delivered,
      area: ev.area,
      dirtyPhotos: [],
      cleanPhotos: [],
      signature: null,
    })
    setExistingDirty((ev.dirty_photo_ids ?? []).map(toPhoto).filter((x): x is { id: string; url: string } => x !== null))
    setExistingClean((ev.clean_photo_ids ?? []).map(toPhoto).filter((x): x is { id: string; url: string } => x !== null))
    setExistingSignature(ev.signature_photo_id ? toPhoto(ev.signature_photo_id) : null)
    setEditingAndenId(id)
    setDrawerOpen(false)
  }

  async function handleUpdateAnden(id: string) {
    if (!currentProfileId) return
    const now = new Date().toISOString()
    const existing = routeEvents.find((r) => r.id === id)
    if (!existing) return

    // 1) Reescribir localmente si aún no sincronizó; si ya sincronizó, editar online
    // (el error se muestra: nunca falla en silencio).
    try {
      const mode = await applyFieldEdit('route_events', id, {
        id, client_id: existing.client_id, company_id: formState.companyId || null,
        kind: existing.kind, slot: existing.slot, date: existing.date,
        started_at: existing.started_at, ended_at: existing.ended_at,
        operator_id: existing.operator_id, status: existing.status,
        area: formState.area,
      }, async () => {
        const supabase = createClient()
        await q.updateRouteEvent(supabase, id, {
          company_id: formState.companyId || null,
          area: formState.area,
        })
        await q.setRouteContainersDirty(supabase, id, formState.dirtyReceivedIds)
        await q.setRouteContainersClean(supabase, id, formState.cleanDeliveredIds)
      })
      if (mode === 'local') {
        // Reescribe también las filas join locales con la selección de tachos actual.
        const store = await getLocalStore()
        for (const cid of formState.dirtyReceivedIds) {
          await store.putRow('route_event_containers_dirty', `${id}:${cid}`, { route_event_id: id, container_id: cid })
        }
        for (const cid of formState.cleanDeliveredIds) {
          await store.putRow('route_event_containers_clean', `${id}:${cid}`, { route_event_id: id, container_id: cid })
        }
      }
    } catch (err) {
      console.error('[recorrido andén] actualizar andén falló:', err)
      alert('No se pudieron guardar los cambios. Revisá tu conexión.')
      return
    }

    // 2) Subir fotos nuevas por categoría; conservar las existentes que quedaron.
    let newDirtyIds: string[] = []
    let newCleanIds: string[] = []
    let newSignatureId: string | null = null
    const label = buildLabel()
    const supabase = createClient()
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
        dataUrls: formState.signature ? [formState.signature] : [], eventType: 'route', eventId: id,
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

    // photo_ids/dirty_photo_ids/clean_photo_ids son campos solo-store: se derivan al
    // hidratar desde photos.event_id (no hay columna en route_events que actualizar aquí).
    updateRouteEvent(id, {
      company_id: formState.companyId || null,
      containers_dirty_received: formState.dirtyReceivedIds,
      containers_clean_delivered: formState.cleanDeliveredIds,
      area: formState.area,
      dirty_photo_ids: dirtyIds,
      clean_photo_ids: cleanIds,
      photo_ids: [...dirtyIds, ...cleanIds],
      signature_photo_id: signatureId,
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

  function removeExistingDirty(id: string) {
    setExistingDirty((prev) => prev.filter((p) => p.id !== id))
    // Nota: quita la foto del registro pero no borra la fila/archivo en Supabase (queda huérfana). Pendiente: limpieza.
  }
  function removeExistingClean(id: string) {
    setExistingClean((prev) => prev.filter((p) => p.id !== id))
    // Nota: quita la foto del registro pero no borra la fila/archivo en Supabase (queda huérfana). Pendiente: limpieza.
  }
  function removeExistingSignature() {
    setExistingSignature(null)
    // Nota: quita la firma del registro pero no borra la fila/archivo en Supabase (queda huérfana). Pendiente: limpieza.
  }

  async function handleStart() {
    // El botón ya está bloqueado hasta que currentProfileId esté hidratado
    // (ver StartSessionButton); este guard es defensivo.
    if (!currentProfileId || !client) return
    const now = new Date().toISOString()
    const session: ActiveSession = {
      key: routeAndenSessionKey(today, slotId),
      type: 'route',
      started_at: now,
      context: {
        type: 'route',
        client_id: client.id,
        company_id: null, // la empresa ahora es por registro, no por sesión
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
    // Marcar todos los andenes in_progress del horario como completed.
    // Re-encolar con el mismo op_id → sobrescribe la op pendiente (idempotente offline).
    for (const a of sessionAndenes) {
      await submitRouteEvent(
        {
          id: a.id, client_id: a.client_id, company_id: a.company_id ?? null,
          kind: 'anden', slot: a.slot, date: a.date, started_at: a.started_at,
          ended_at: now, operator_id: a.operator_id, status: 'completed', area: a.area,
        },
        a.containers_dirty_received, a.containers_clean_delivered,
      )
      updateRouteEvent(a.id, { status: 'completed', ended_at: now })
    }
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

  const hasSignature = !!formState.signature || !!existingSignature
  // Las fotos ya no bloquean el guardado: basta empresa + al menos un tacho + firma.
  const canSaveAnden =
    isRunning &&
    !!formState.companyId &&
    (formState.dirtyReceivedIds.length + formState.cleanDeliveredIds.length > 0) &&
    hasSignature
  const canFinish = sessionAndenes.length > 0

  // Requisitos faltantes para habilitar "Guardar andén". Se muestran bajo el
  // botón para que nunca quede "bloqueado" sin explicación.
  const missingToSave = [
    !formState.companyId && 'empresa',
    formState.dirtyReceivedIds.length + formState.cleanDeliveredIds.length === 0 && 'tachos',
    !hasSignature && 'firma',
  ].filter(Boolean) as string[]

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
              Iniciá el recorrido para registrar los andenes. La empresa se elige en cada registro.
            </p>
            <StartSessionButton
              sessionReady={!!currentProfileId}
              onStart={handleStart}
              icon={<Play className="h-4 w-4" />}
            >
              Iniciar recorrido
            </StartSessionButton>
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
        companies={clientCompanies}
        showCompanySelector
        dirtyPhotoRequired={false}
        cleanPhotoRequired={false}
        locked={!isRunning}
        existingDirtyPhotos={existingDirty}
        existingCleanPhotos={existingClean}
        onRemoveExistingDirty={removeExistingDirty}
        onRemoveExistingClean={removeExistingClean}
        existingSignature={existingSignature}
        onRemoveExistingSignature={removeExistingSignature}
      />

      {/* Acción: guardar andén y agregar otro */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Button onClick={handleSaveAnden} disabled={!canSaveAnden || saving} size="lg" className="gap-2 sm:flex-1">
              <Plus className="h-4 w-4" />
              {saving ? 'Guardando…' : isEditing ? 'Guardar cambios del andén' : 'Guardar andén y agregar otro'}
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
          {!canSaveAnden && !saving && missingToSave.length > 0 && (
            <p className="text-xs font-medium text-amber-700 text-center sm:text-right">
              Falta para guardar: {missingToSave.join(', ')}.
            </p>
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
              Esta acción <strong className="text-red-700">descarta</strong> los {andenCount} andén{andenCount !== 1 ? 'es' : ''} registrado{andenCount !== 1 ? 's' : ''} (tachos, ubicación y fotos). El horario vuelve a quedar disponible.
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
