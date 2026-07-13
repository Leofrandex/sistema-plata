'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, Trash2, Sparkles, Plus } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContainerPickerSheet } from '@/components/register/container-picker-sheet'
import { PhotoCaptureMulti } from '@/components/register/photo-capture-multi'
import { SignaturePad } from '@/components/register/signature-pad'
import { cn } from '@/lib/utils'
import type { Container, Company } from '@/lib/types'
import { formatTachoNumber } from '@/lib/data/containers'

/** Opciones fijas para la ubicación del recorrido. */
const LOCATION_OPTIONS = ['Pediatría', 'Andén 3'] as const

export interface RouteFormState {
  /** Empresa de ESTE registro (ION/Airkem). Propiedad del registro, no del tacho. */
  companyId: string
  /** Tachos sucios recogidos en este recorrido (van a pesaje). */
  dirtyReceivedIds: string[]
  /** Tachos limpios entregados al cliente durante el recorrido. */
  cleanDeliveredIds: string[]
  area: string
  /** Fotos NUEVAS (dataURLs) a subir, por categoría. */
  dirtyPhotos: string[]
  cleanPhotos: string[]
  /** Firma nueva (data URL) a subir. */
  signature: string | null
}

interface Props {
  state: RouteFormState
  onChange: (updates: Partial<RouteFormState>) => void
  containers: Container[]
  /** Empresas seleccionables para el registro (las del cliente del recorrido). */
  companies: Company[]
  locked: boolean
  /** Muestra el selector de empresa dentro del formulario (andén multi-registro).
   *  Morgue lo desactiva: elige empresa al iniciar (un solo registro). */
  showCompanySelector?: boolean
  /** Marca las fotos como obligatorias (asterisco). Por defecto true para no
   *  cambiar el comportamiento histórico; los flujos donde las fotos ya no
   *  bloquean el guardado las pasan en false. */
  dirtyPhotoRequired?: boolean
  cleanPhotoRequired?: boolean
  /** Fotos ya subidas que se conservan (modo edición), por categoría. */
  existingDirtyPhotos?: { id: string; url: string }[]
  existingCleanPhotos?: { id: string; url: string }[]
  onRemoveExistingDirty?: (id: string) => void
  onRemoveExistingClean?: (id: string) => void
  /** Firma ya subida que se conserva (modo edición). */
  existingSignature?: { id: string; url: string } | null
  onRemoveExistingSignature?: () => void
}

export function RouteForm({
  state, onChange, containers, companies, locked, showCompanySelector = false,
  dirtyPhotoRequired = true, cleanPhotoRequired = true,
  existingDirtyPhotos, existingCleanPhotos, onRemoveExistingDirty, onRemoveExistingClean,
  existingSignature, onRemoveExistingSignature,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState<'dirty' | 'clean' | null>(null)

  const dirtyContainers = containers.filter((c) => state.dirtyReceivedIds.includes(c.id))
  const cleanContainers = containers.filter((c) => state.cleanDeliveredIds.includes(c.id))

  // Para evitar que el operador agregue el mismo tacho a ambas listas, filtramos
  // el catálogo de cada selector excluyendo lo ya seleccionado en el otro.
  const dirtyCatalog = containers.filter((c) => !state.cleanDeliveredIds.includes(c.id))
  const cleanCatalog = containers.filter((c) => !state.dirtyReceivedIds.includes(c.id))

  function removeDirty(id: string) {
    onChange({ dirtyReceivedIds: state.dirtyReceivedIds.filter((cid) => cid !== id) })
  }

  function removeClean(id: string) {
    onChange({ cleanDeliveredIds: state.cleanDeliveredIds.filter((cid) => cid !== id) })
  }

  return (
    <div
      className={cn(
        'space-y-6 transition-opacity',
        locked && 'pointer-events-none opacity-50 select-none',
      )}
      aria-disabled={locked}
    >
      {/* Empresa de este registro */}
      {showCompanySelector && (
        <section className="space-y-3">
          <header>
            <h2 className="text-sm font-semibold text-foreground">
              Empresa <span className="text-red-500">*</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Cada registro es de una sola empresa. Para otra empresa, guardá este y abrí uno nuevo.
            </p>
          </header>
          <Select
            value={state.companyId || undefined}
            onValueChange={(v) => onChange({ companyId: v ?? '' })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar empresa" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>
      )}

      {/* Tachos sucios recogidos */}
      <section className="space-y-3">
        <header className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-100 text-red-700">
            <Trash2 className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-red-900">Tachos sucios recogidos</h2>
            <p className="text-xs text-muted-foreground">Pasarán a pesaje en planta.</p>
          </div>
        </header>

        <Button
          type="button"
          variant="outline"
          onClick={() => setPickerOpen('dirty')}
          className="w-full h-14 gap-2 justify-center border-red-200 bg-red-50/50 hover:bg-red-50 text-red-900"
        >
          <Plus className="h-5 w-5" />
          <span className="font-medium">
            {dirtyContainers.length === 0
              ? 'Agregar tachos sucios'
              : `Agregar / editar (${dirtyContainers.length} seleccionado${dirtyContainers.length !== 1 ? 's' : ''})`}
          </span>
        </Button>

        {dirtyContainers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {dirtyContainers.map((c) => (
              <Badge
                key={c.id}
                variant="secondary"
                className="gap-1.5 bg-red-100 text-red-900 hover:bg-red-200 border border-red-200 py-1.5 pl-2.5 pr-1.5 text-sm"
              >
                <span className="font-mono font-semibold">{formatTachoNumber(c.id)}</span>
                <button
                  type="button"
                  onClick={() => removeDirty(c.id)}
                  aria-label={`Quitar ${formatTachoNumber(c.id)}`}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-red-300/60"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Tachos limpios entregados */}
      <section className="space-y-3">
        <header className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-emerald-900">Tachos limpios entregados</h2>
            <p className="text-xs text-muted-foreground">Tachos vacíos y lavados que se dejan al cliente.</p>
          </div>
        </header>

        <Button
          type="button"
          variant="outline"
          onClick={() => setPickerOpen('clean')}
          className="w-full h-14 gap-2 justify-center border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-900"
        >
          <Plus className="h-5 w-5" />
          <span className="font-medium">
            {cleanContainers.length === 0
              ? 'Agregar tachos limpios'
              : `Agregar / editar (${cleanContainers.length} seleccionado${cleanContainers.length !== 1 ? 's' : ''})`}
          </span>
        </Button>

        {cleanContainers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {cleanContainers.map((c) => (
              <Badge
                key={c.id}
                variant="secondary"
                className="gap-1.5 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border border-emerald-200 py-1.5 pl-2.5 pr-1.5 text-sm"
              >
                <span className="font-mono font-semibold">{formatTachoNumber(c.id)}</span>
                <button
                  type="button"
                  onClick={() => removeClean(c.id)}
                  aria-label={`Quitar ${formatTachoNumber(c.id)}`}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-300/60"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Ubicación */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Ubicación del recorrido</h2>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Ubicación</label>
          <Select
            value={state.area || undefined}
            onValueChange={(v) => onChange({ area: v ?? '' })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar ubicación" />
            </SelectTrigger>
            <SelectContent>
              {LOCATION_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Fotos de tachos sucios (primero) */}
      <section className="space-y-2">
        <ExistingPhotosGrid
          label="Foto de tachos sucios — ya cargadas"
          photos={existingDirtyPhotos ?? []}
          disabled={locked}
          onRemove={onRemoveExistingDirty}
        />
        <PhotoCaptureMulti
          label="Foto de tachos sucios"
          required={dirtyPhotoRequired}
          disabled={locked}
          photos={state.dirtyPhotos}
          onAdd={(url) => onChange({ dirtyPhotos: [...state.dirtyPhotos, url] })}
          onRemove={(i) => onChange({ dirtyPhotos: state.dirtyPhotos.filter((_, idx) => idx !== i) })}
        />
      </section>

      {/* Fotos de tachos limpios (después) */}
      <section className="space-y-2">
        <ExistingPhotosGrid
          label="Foto de tachos limpios — ya cargadas"
          photos={existingCleanPhotos ?? []}
          disabled={locked}
          onRemove={onRemoveExistingClean}
        />
        <PhotoCaptureMulti
          label="Foto de tachos limpios"
          required={cleanPhotoRequired}
          disabled={locked}
          photos={state.cleanPhotos}
          onAdd={(url) => onChange({ cleanPhotos: [...state.cleanPhotos, url] })}
          onRemove={(i) => onChange({ cleanPhotos: state.cleanPhotos.filter((_, idx) => idx !== i) })}
        />
      </section>

      {/* Firma del recorrido */}
      <SignaturePad
        value={state.signature}
        existing={existingSignature ?? null}
        onChange={(dataUrl) => onChange({ signature: dataUrl })}
        onRemoveExisting={onRemoveExistingSignature}
        disabled={locked}
      />

      {!locked && (state.dirtyReceivedIds.length > 0 || state.cleanDeliveredIds.length > 0) && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => onChange({ dirtyReceivedIds: [], cleanDeliveredIds: [] })}
          >
            Limpiar selección de tachos
          </Button>
        </div>
      )}

      {/* Picker modal full-screen — fuera del wrapper "locked" para no heredar el pointer-events-none */}
      <ContainerPickerSheet
        open={pickerOpen === 'dirty'}
        variant="dirty"
        containers={dirtyCatalog}
        selectedIds={state.dirtyReceivedIds}
        onClose={() => setPickerOpen(null)}
        onConfirm={(ids) => onChange({ dirtyReceivedIds: ids })}
      />
      <ContainerPickerSheet
        open={pickerOpen === 'clean'}
        variant="clean"
        containers={cleanCatalog}
        selectedIds={state.cleanDeliveredIds}
        onClose={() => setPickerOpen(null)}
        onConfirm={(ids) => onChange({ cleanDeliveredIds: ids })}
      />
    </div>
  )
}

function ExistingPhotosGrid({
  label, photos, disabled, onRemove,
}: {
  label: string
  photos: { id: string; url: string }[]
  disabled: boolean
  onRemove?: (id: string) => void
}) {
  if (photos.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative">
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden border bg-slate-900">
              <Image src={p.url} alt="Foto cargada" fill className="object-contain" sizes="(max-width: 640px) 50vw, 33vw" />
            </div>
            {!disabled && onRemove && (
              <Button
                type="button" variant="destructive" size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => onRemove(p.id)} aria-label="Quitar foto cargada"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
