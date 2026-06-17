'use client'

import { useMemo, useState } from 'react'
import { Pencil, Ban, Check, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { ConfirmVoidDialog } from '@/components/ui/confirm-void-dialog'
import { ContainerPickerSheet, type PickerVariant } from '@/components/register/container-picker-sheet'
import { formatTachoNumber } from '@/lib/data/containers'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import type { RouteEvent } from '@/lib/types'

export function RouteHistory() {
  const {
    routeEvents, companies, containers, currentProfileId, currentRole,
    updateRouteEvent, voidRouteEvent,
  } = useStore()
  const isCoordinator = currentRole === 'coordinator'

  const [editingId, setEditingId] = useState<string | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [picker, setPicker] = useState<{ id: string; variant: PickerVariant } | null>(null)

  const sorted = useMemo(
    () => [...routeEvents].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [routeEvents],
  )

  async function saveCompany(ev: RouteEvent, companyId: string | null) {
    try {
      await q.updateRouteEvent(createClient(), ev.id, { company_id: companyId })
    } catch (err) { console.error('[historial recorrido] empresa falló:', err); return }
    updateRouteEvent(ev.id, { company_id: companyId })
  }

  async function saveArea(ev: RouteEvent, area: string) {
    try {
      await q.updateRouteEvent(createClient(), ev.id, { area })
    } catch (err) { console.error('[historial recorrido] área falló:', err); return }
    updateRouteEvent(ev.id, { area })
  }

  async function saveContainers(ev: RouteEvent, variant: PickerVariant, ids: string[]) {
    const db = createClient()
    try {
      if (variant === 'dirty') await q.setRouteContainersDirty(db, ev.id, ids)
      else await q.setRouteContainersClean(db, ev.id, ids)
    } catch (err) { console.error('[historial recorrido] tachos falló:', err); return }
    updateRouteEvent(ev.id, variant === 'dirty'
      ? { containers_dirty_received: ids }
      : { containers_clean_delivered: ids })
  }

  async function doVoid(ev: RouteEvent, reason: string) {
    if (!currentProfileId) return
    try {
      await q.voidRouteEvent(createClient(), ev.id, currentProfileId, reason)
    } catch (err) { console.error('[historial recorrido] anular falló:', err); return }
    voidRouteEvent(ev.id, currentProfileId, reason)
    setVoidingId(null)
    setEditingId(null)
  }

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Sin recorridos registrados.</p>
  }

  return (
    <div className="space-y-3">
      {sorted.map((ev) => {
        const companyName = companies.find((c) => c.id === ev.company_id)?.name ?? '—'
        const isEditing = editingId === ev.id && isCoordinator
        return (
          <div key={ev.id} className={ev.voided_at ? 'rounded-lg border border-border bg-muted/40 p-4 opacity-70' : 'rounded-lg border border-border bg-card p-4'}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {ev.date} · {ev.kind === 'morgue' ? 'Morgue' : ev.slot} · {companyName}
                  {ev.voided_at && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">ANULADO</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sucios: {ev.containers_dirty_received.map(formatTachoNumber).join(', ') || '—'} · Limpios: {ev.containers_clean_delivered.map(formatTachoNumber).join(', ') || '—'}
                </p>
                {ev.area && <p className="text-xs text-muted-foreground">Área: {ev.area}</p>}
              </div>
              {isCoordinator && !ev.voided_at && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditingId(isEditing ? null : ev.id)}>
                    {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Anular" className="text-red-600" onClick={() => setVoidingId(ev.id)}>
                    <Ban className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {isEditing && (
              <div className="mt-4 space-y-3 border-t border-border pt-3">
                <label className="block text-xs font-medium text-foreground">
                  Empresa
                  <select
                    defaultValue={ev.company_id ?? ''}
                    onChange={(e) => saveCompany(ev, e.target.value || null)}
                    className="mt-1 block w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-medium text-foreground">
                  Área
                  <input
                    defaultValue={ev.area}
                    onBlur={(e) => { if (e.target.value !== ev.area) saveArea(ev, e.target.value) }}
                    className="mt-1 block w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPicker({ id: ev.id, variant: 'dirty' })}>Editar sucios</Button>
                  <Button variant="outline" size="sm" onClick={() => setPicker({ id: ev.id, variant: 'clean' })}>Editar limpios</Button>
                </div>
                <p className="flex items-center gap-1 text-xs text-emerald-700"><Check className="h-3 w-3" /> Los cambios se guardan al instante.</p>
              </div>
            )}
          </div>
        )
      })}

      {picker && (() => {
        const ev = routeEvents.find((r) => r.id === picker.id)
        if (!ev) return null
        const selected = picker.variant === 'dirty' ? ev.containers_dirty_received : ev.containers_clean_delivered
        const otherSide = picker.variant === 'dirty' ? ev.containers_clean_delivered : ev.containers_dirty_received
        const otherSet = new Set(otherSide)
        return (
          <ContainerPickerSheet
            open
            variant={picker.variant}
            containers={containers.filter((c) => !otherSet.has(c.id))}
            selectedIds={selected}
            onClose={() => setPicker(null)}
            onConfirm={(ids) => saveContainers(ev, picker.variant, ids)}
          />
        )
      })()}

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
