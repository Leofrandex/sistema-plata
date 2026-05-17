'use client'

import { X, Trash2, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContainerSelector } from '@/components/register/container-selector'
import { PhotoCaptureMulti } from '@/components/register/photo-capture-multi'
import { cn } from '@/lib/utils'
import type { Container, Company } from '@/lib/types'

export interface RouteFormState {
  /** Envases sucios recogidos en este recorrido (van a pesaje). */
  dirtyReceivedIds: string[]
  /** Envases limpios entregados al cliente durante el recorrido. */
  cleanDeliveredIds: string[]
  floor: string
  area: string
  dock: string
  photos: string[] // dataURLs
}

interface Props {
  state: RouteFormState
  onChange: (updates: Partial<RouteFormState>) => void
  containers: Container[]
  companies: Company[]
  locked: boolean
}

export function RouteForm({ state, onChange, containers, companies, locked }: Props) {
  const dirtyContainers = containers.filter((c) => state.dirtyReceivedIds.includes(c.id))
  const cleanContainers = containers.filter((c) => state.cleanDeliveredIds.includes(c.id))

  // Para evitar que el operador agregue el mismo envase a ambas listas, filtramos
  // el catálogo de cada selector excluyendo lo ya seleccionado en el otro.
  const dirtyCatalog = containers.filter((c) => !state.cleanDeliveredIds.includes(c.id))
  const cleanCatalog = containers.filter((c) => !state.dirtyReceivedIds.includes(c.id))

  function addDirty(container: Container) {
    if (state.dirtyReceivedIds.includes(container.id)) return
    onChange({ dirtyReceivedIds: [...state.dirtyReceivedIds, container.id] })
  }

  function removeDirty(id: string) {
    onChange({ dirtyReceivedIds: state.dirtyReceivedIds.filter((cid) => cid !== id) })
  }

  function addClean(container: Container) {
    if (state.cleanDeliveredIds.includes(container.id)) return
    onChange({ cleanDeliveredIds: [...state.cleanDeliveredIds, container.id] })
  }

  function removeClean(id: string) {
    onChange({ cleanDeliveredIds: state.cleanDeliveredIds.filter((cid) => cid !== id) })
  }

  function addPhoto(dataUrl: string) {
    onChange({ photos: [...state.photos, dataUrl] })
  }

  function removePhoto(index: number) {
    onChange({ photos: state.photos.filter((_, i) => i !== index) })
  }

  return (
    <div
      className={cn(
        'space-y-6 transition-opacity',
        locked && 'pointer-events-none opacity-50 select-none',
      )}
      aria-disabled={locked}
    >
      {/* Envases sucios recogidos */}
      <section className="space-y-3">
        <header className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <Trash2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Envases sucios recogidos</h2>
            <p className="text-xs text-muted-foreground">Pasarán a pesaje en planta.</p>
          </div>
        </header>
        <ContainerSelector
          containers={dirtyCatalog}
          companies={companies}
          onSelect={addDirty}
        />
        {dirtyContainers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {dirtyContainers.length} envase{dirtyContainers.length !== 1 ? 's' : ''} recogido{dirtyContainers.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {dirtyContainers.map((c) => (
                <Badge key={c.id} variant="secondary" className="gap-1 bg-amber-50 text-amber-900 hover:bg-amber-100">
                  <span className="font-mono">{c.id}</span>
                  <button type="button" onClick={() => removeDirty(c.id)} aria-label={`Quitar ${c.id}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Envases limpios entregados */}
      <section className="space-y-3">
        <header className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Envases limpios entregados</h2>
            <p className="text-xs text-muted-foreground">Envases vacíos y lavados que se dejan al cliente.</p>
          </div>
        </header>
        <ContainerSelector
          containers={cleanCatalog}
          companies={companies}
          onSelect={addClean}
        />
        {cleanContainers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {cleanContainers.length} envase{cleanContainers.length !== 1 ? 's' : ''} entregado{cleanContainers.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {cleanContainers.map((c) => (
                <Badge key={c.id} variant="secondary" className="gap-1 bg-emerald-50 text-emerald-900 hover:bg-emerald-100">
                  <span className="font-mono">{c.id}</span>
                  <button type="button" onClick={() => removeClean(c.id)} aria-label={`Quitar ${c.id}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Ubicación */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Ubicación del recorrido</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Piso</label>
            <Input
              value={state.floor}
              onChange={(e) => onChange({ floor: e.target.value })}
              placeholder="Ej: 2"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Área</label>
            <Input
              value={state.area}
              onChange={(e) => onChange({ area: e.target.value })}
              placeholder="Ej: Pediatría"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Andén</label>
            <Input
              value={state.dock}
              onChange={(e) => onChange({ dock: e.target.value })}
              placeholder="Ej: Andén Norte"
            />
          </div>
        </div>
      </section>

      {/* Fotos ilimitadas */}
      <section>
        <PhotoCaptureMulti
          label="Fotos del recorrido"
          required
          disabled={locked}
          photos={state.photos}
          onAdd={addPhoto}
          onRemove={removePhoto}
        />
      </section>

      {!locked && (state.dirtyReceivedIds.length > 0 || state.cleanDeliveredIds.length > 0) && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => onChange({ dirtyReceivedIds: [], cleanDeliveredIds: [] })}
          >
            Limpiar selección de envases
          </Button>
        </div>
      )}
    </div>
  )
}
