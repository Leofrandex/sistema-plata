'use client'

import { useMemo, useState } from 'react'
import { Pencil, Ban, X } from 'lucide-react'
import { useStore } from '@hospiwaste/shared/lib/store'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { ConfirmVoidDialog } from '@hospiwaste/shared/components/ui/confirm-void-dialog'
import { ConfirmDialog } from '@hospiwaste/shared/components/ui/confirm-dialog'
import { ContainerPickerSheet, type PickerVariant } from '@hospiwaste/shared/components/register/container-picker-sheet'
import { formatTachoNumber } from '@hospiwaste/shared/lib/data/containers'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import * as q from '@hospiwaste/shared/lib/supabase/queries'
import type { RouteEvent } from '@hospiwaste/shared/lib/types'

interface Draft {
  company_id: string | null
  area: string
  dirty: string[]
  clean: string[]
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sb = new Set(b)
  return a.every((x) => sb.has(x))
}

export function RouteHistory() {
  const {
    routeEvents, companies, containers, currentProfileId, currentRole,
    updateRouteEvent, voidRouteEvent,
  } = useStore()
  const isCoordinator = currentRole === 'coordinator'

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirmingSave, setConfirmingSave] = useState(false)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickerVariant | null>(null)

  const sorted = useMemo(
    () => [...routeEvents].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [routeEvents],
  )

  function startEdit(ev: RouteEvent) {
    setEditingId(ev.id)
    setDraft({
      company_id: ev.company_id ?? null,
      area: ev.area,
      dirty: [...ev.containers_dirty_received],
      clean: [...ev.containers_clean_delivered],
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
    setPicker(null)
    setConfirmingSave(false)
  }

  async function persist(ev: RouteEvent) {
    if (!draft) return
    const db = createClient()
    const patch: Partial<RouteEvent> = {}
    if (draft.company_id !== (ev.company_id ?? null)) patch.company_id = draft.company_id
    if (draft.area !== ev.area) patch.area = draft.area
    const dirtyChanged = !sameSet(draft.dirty, ev.containers_dirty_received)
    const cleanChanged = !sameSet(draft.clean, ev.containers_clean_delivered)
    try {
      if (Object.keys(patch).length) await q.updateRouteEvent(db, ev.id, patch)
      if (dirtyChanged) await q.setRouteContainersDirty(db, ev.id, draft.dirty)
      if (cleanChanged) await q.setRouteContainersClean(db, ev.id, draft.clean)
    } catch (err) {
      console.error('[historial recorrido] guardar falló:', err)
      return
    }
    updateRouteEvent(ev.id, {
      ...patch,
      containers_dirty_received: draft.dirty,
      containers_clean_delivered: draft.clean,
    })
    cancelEdit()
  }

  async function doVoid(ev: RouteEvent, reason: string) {
    if (!currentProfileId) return
    try {
      await q.voidRouteEvent(createClient(), ev.id, currentProfileId, reason)
    } catch (err) {
      console.error('[historial recorrido] anular falló:', err)
      return
    }
    voidRouteEvent(ev.id, currentProfileId, reason)
    setVoidingId(null)
    cancelEdit()
  }

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Sin recorridos registrados.</p>
  }

  return (
    <div className="space-y-3">
      {sorted.map((ev) => {
        const companyName = companies.find((c) => c.id === ev.company_id)?.name ?? '—'
        const isEditing = editingId === ev.id && isCoordinator && draft != null
        return (
          <div key={ev.id} className={ev.voided_at ? 'rounded-lg border border-border bg-muted/40 p-4 opacity-70' : 'rounded-lg border border-border bg-card p-4'}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {ev.date} · {ev.kind === 'morgue' ? 'Morgue' : ev.slot} · {companyName}
                  {ev.voided_at && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">ANULADO</span>}
                </p>
                <p className="text-xs mt-1 font-medium text-green-700">
                  Limpios ({ev.containers_clean_delivered.length}): {ev.containers_clean_delivered.map(formatTachoNumber).join(', ') || '—'}
                </p>
                <p className="text-xs font-medium text-red-700">
                  Sucios ({ev.containers_dirty_received.length}): {ev.containers_dirty_received.map(formatTachoNumber).join(', ') || '—'}
                </p>
                {ev.area && <p className="text-xs text-muted-foreground">Área: {ev.area}</p>}
              </div>
              {isCoordinator && !ev.voided_at && !isEditing && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => startEdit(ev)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Anular" className="text-red-600" onClick={() => setVoidingId(ev.id)}>
                    <Ban className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {isEditing && (
                <Button variant="ghost" size="icon" aria-label="Cancelar edición" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {isEditing && draft && (
              <div className="mt-4 space-y-3 border-t border-border pt-3">
                <label className="block text-xs font-medium text-foreground">
                  Empresa
                  <select
                    value={draft.company_id ?? ''}
                    onChange={(e) => setDraft({ ...draft, company_id: e.target.value || null })}
                    className="mt-1 block w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-medium text-foreground">
                  Área
                  <input
                    value={draft.area}
                    onChange={(e) => setDraft({ ...draft, area: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPicker('dirty')}>
                    Sucios ({draft.dirty.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPicker('clean')}>
                    Limpios ({draft.clean.length})
                  </Button>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={cancelEdit}>Cancelar</Button>
                  <Button size="sm" onClick={() => setConfirmingSave(true)}>Guardar cambios</Button>
                </div>
              </div>
            )}

            {isEditing && draft && picker && (
              <ContainerPickerSheet
                open
                variant={picker}
                containers={containers.filter((c) => !new Set(picker === 'dirty' ? draft.clean : draft.dirty).has(c.id))}
                selectedIds={picker === 'dirty' ? draft.dirty : draft.clean}
                onClose={() => setPicker(null)}
                onConfirm={(ids) => setDraft(picker === 'dirty' ? { ...draft, dirty: ids } : { ...draft, clean: ids })}
              />
            )}

            {isEditing && confirmingSave && (
              <ConfirmDialog
                title="¿Guardar los cambios?"
                description="Se actualizará este recorrido con los datos editados."
                confirmLabel="Guardar"
                onCancel={() => setConfirmingSave(false)}
                onConfirm={() => { setConfirmingSave(false); persist(ev) }}
              />
            )}
          </div>
        )
      })}

      {voidingId && (() => {
        const ev = routeEvents.find((r) => r.id === voidingId)
        if (!ev) return null
        return (
          <ConfirmVoidDialog
            title="¿Anular este recorrido?"
            description={<>El recorrido del <strong>{ev.date} · {ev.kind === 'morgue' ? 'Morgue' : ev.slot}</strong> dejará de contar en el estado de los tachos y en los reportes. No se borra: queda anulado con motivo.</>}
            confirmLabel="Anular recorrido"
            onCancel={() => setVoidingId(null)}
            onConfirm={(reason) => doVoid(ev, reason)}
          />
        )
      })()}
    </div>
  )
}
