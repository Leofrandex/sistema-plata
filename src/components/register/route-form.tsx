'use client'

import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContainerSelector } from '@/components/register/container-selector'
import { PhotoCaptureMulti } from '@/components/register/photo-capture-multi'
import { cn } from '@/lib/utils'
import type { Container, Company } from '@/lib/types'

export interface RouteFormState {
  containerIds: string[]
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
  /** Cuando es true, el formulario se ve atenuado y no es editable. */
  locked: boolean
}

export function RouteForm({ state, onChange, containers, companies, locked }: Props) {
  const selectedContainers = containers.filter((c) => state.containerIds.includes(c.id))

  function handleContainerSelect(container: Container) {
    if (state.containerIds.includes(container.id)) return
    onChange({ containerIds: [...state.containerIds, container.id] })
  }

  function removeContainer(id: string) {
    onChange({ containerIds: state.containerIds.filter((cid) => cid !== id) })
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
      {/* Envases (selección acumulativa) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Envases del recorrido</h2>
        <ContainerSelector
          containers={containers}
          companies={companies}
          onSelect={handleContainerSelect}
        />
        {selectedContainers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {selectedContainers.length} seleccionado{selectedContainers.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedContainers.map((c) => (
                <Badge key={c.id} variant="secondary" className="gap-1">
                  <span className="font-mono">{c.id}</span>
                  <button
                    type="button"
                    onClick={() => removeContainer(c.id)}
                    aria-label={`Quitar ${c.id}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {!locked && state.containerIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => onChange({ containerIds: [] })}
              >
                Limpiar selección
              </Button>
            )}
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
    </div>
  )
}
