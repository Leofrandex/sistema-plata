'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhotoCapture } from '@/components/register/photo-capture'
import { cn } from '@/lib/utils'
import { computeNetWeight } from '@/lib/data/containers'
import { CheckSquare, Square } from 'lucide-react'
import type { Container, Company, WasteType } from '@/lib/types'

const WASTE_LABELS: Record<WasteType, string> = {
  infectious: 'Peligroso infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

export interface WeighingFormState {
  container_id: string
  photo_container: string | null
  photo_scale: string | null
  gross_weight: string
  observations: string
  /** Pesaje proveniente de carga Yaris/Picanto. Cuando true, el envase elegido
   *  debe ser uno marcado como `is_yaris_dedicated`. */
  is_yaris_weighing: boolean
}

export const EMPTY_WEIGHING_FORM: WeighingFormState = {
  container_id: '',
  photo_container: null,
  photo_scale: null,
  gross_weight: '',
  observations: '',
  is_yaris_weighing: false,
}

interface Props {
  state: WeighingFormState
  onChange: (updates: Partial<WeighingFormState>) => void
  /** Envases pendientes de pesar (no yaris). */
  availableContainers: Container[]
  /** Envases dedicados a Yaris disponibles (siempre disponibles, no requieren recorrido previo). */
  yarisContainers: Container[]
  /** Lista completa para resolver datos del envase si se está editando uno ya pesado. */
  allContainers: Container[]
  companies: Company[]
  locked: boolean
  mode: 'create' | 'edit'
  onSubmit: () => void
  onCancelEdit?: () => void
  onDelete?: () => void
}

export function WeighingForm({
  state,
  onChange,
  availableContainers,
  yarisContainers,
  allContainers,
  companies,
  locked,
  mode,
  onSubmit,
  onCancelEdit,
  onDelete,
}: Props) {
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]))
  const selectedContainer = allContainers.find((c) => c.id === state.container_id) ?? null

  const isYaris = state.is_yaris_weighing

  // En modo edit, el envase actualmente cargado puede no estar en
  // availableContainers (porque ya tiene reception). Lo agregamos al inicio
  // para que siga visible y editable.
  const normalCatalog = isYaris ? [] : availableContainers
  const yarisCatalog = isYaris ? yarisContainers : []

  const dropdownContainers = (() => {
    const base = isYaris ? yarisCatalog : normalCatalog
    if (mode === 'edit' && selectedContainer && !base.some((c) => c.id === selectedContainer.id)) {
      return [selectedContainer, ...base]
    }
    return base
  })()

  const grossWeight = parseFloat(state.gross_weight)
  const hasValidWeight =
    !!state.gross_weight &&
    !Number.isNaN(grossWeight) &&
    selectedContainer != null &&
    grossWeight > selectedContainer.tare_weight_kg

  const netWeight = selectedContainer && hasValidWeight
    ? computeNetWeight(grossWeight, selectedContainer.tare_weight_kg)
    : null

  const canSubmit =
    !!state.container_id &&
    !!state.photo_container &&
    !!state.photo_scale &&
    hasValidWeight

  function toggleYaris() {
    // Al cambiar el modo Yaris, limpiamos la selección de envase (la lista
    // disponible cambia) para evitar enviar un envase inconsistente.
    onChange({
      is_yaris_weighing: !isYaris,
      container_id: '',
    })
  }

  return (
    <div
      className={cn(
        'space-y-5 transition-opacity',
        locked && 'pointer-events-none opacity-50 select-none',
      )}
      aria-disabled={locked}
    >
      {/* Envase: número normal | envase Yaris */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Número de envase <span className="text-red-500">*</span>
          </label>
          <Select
            value={!isYaris ? state.container_id : ''}
            onValueChange={(v) => !isYaris && onChange({ container_id: v ?? '' })}
            disabled={isYaris}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                isYaris
                  ? 'Modo Yaris activo'
                  : normalCatalog.length === 0
                    ? 'No hay envases pendientes'
                    : 'Seleccionar envase'
              } />
            </SelectTrigger>
            <SelectContent>
              {dropdownContainers.filter((c) => !c.is_yaris_dedicated).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.id} — {companyMap[c.company_id] ?? '—'} · {c.size_liters} L
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Envase Yaris {isYaris && <span className="text-red-500">*</span>}
          </label>
          <Select
            value={isYaris ? state.container_id : ''}
            onValueChange={(v) => isYaris && onChange({ container_id: v ?? '' })}
            disabled={!isYaris}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                !isYaris
                  ? 'Activá "Pesaje de Yaris" abajo'
                  : yarisCatalog.length === 0
                    ? 'No hay envases Yaris configurados'
                    : 'Seleccionar envase Yaris'
              } />
            </SelectTrigger>
            <SelectContent>
              {dropdownContainers.filter((c) => c.is_yaris_dedicated).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.id} — {c.size_liters} L
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {dropdownContainers.length === 0 && mode === 'create' && (
        <p className="text-xs text-amber-700">
          {isYaris
            ? 'No hay envases Yaris configurados. Marcá un envase como dedicado a Yaris desde Admin → Envases.'
            : 'No hay envases sucios recogidos pendientes de pesar. Registrá un recorrido primero.'}
        </p>
      )}
      {selectedContainer && (
        <div className="flex flex-wrap items-center gap-2 -mt-2">
          <Badge variant="outline" className="font-normal">
            Tipo: <strong className="ml-1 font-semibold">{WASTE_LABELS[selectedContainer.waste_type]}</strong>
          </Badge>
          <Badge variant="outline" className="font-normal">
            Tara: <strong className="ml-1 font-semibold">{selectedContainer.tare_weight_kg} kg</strong>
          </Badge>
          <Badge variant="outline" className="font-normal">
            Tamaño: <strong className="ml-1 font-semibold">{selectedContainer.size_liters} L</strong>
          </Badge>
          {selectedContainer.is_yaris_dedicated && (
            <Badge variant="outline" className="font-normal bg-amber-50 border-amber-300 text-amber-900">
              Dedicado a Yaris
            </Badge>
          )}
        </div>
      )}

      {/* Peso bruto + peso neto destacado */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Peso bruto (kg) <span className="text-red-500">*</span>
        </label>
        <div className="flex items-stretch gap-3">
          <Input
            type="number"
            step="0.1"
            min="0"
            value={state.gross_weight}
            onChange={(e) => onChange({ gross_weight: e.target.value })}
            placeholder="Ej: 43.7"
            className="text-lg h-14 max-w-[10rem] sm:max-w-[12rem] tabular-nums"
          />
          <div
            className={cn(
              'flex-1 min-w-0 flex flex-col justify-center px-4 py-2 rounded-lg border transition-colors',
              netWeight != null
                ? 'border-accent/40 bg-accent/5'
                : 'border-dashed border-muted-foreground/20 bg-muted/20',
            )}
            aria-live="polite"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Peso neto
            </span>
            {netWeight != null ? (
              <span className="text-2xl sm:text-3xl font-bold tabular-nums text-accent leading-tight">
                {netWeight} <span className="text-base font-semibold text-accent/80">kg</span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground/70">
                —
              </span>
            )}
          </div>
        </div>
        {state.gross_weight && selectedContainer && !hasValidWeight && (
          <p className="text-xs text-red-600">
            El peso bruto debe ser mayor que la tara ({selectedContainer.tare_weight_kg} kg).
          </p>
        )}
      </div>

      {/* Toggle "Pesaje de Yaris" estilo checklist */}
      <button
        type="button"
        onClick={toggleYaris}
        aria-pressed={isYaris}
        className={cn(
          'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
          isYaris
            ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
            : 'border-border bg-card hover:bg-muted/40',
        )}
      >
        {isYaris ? (
          <CheckSquare className="h-5 w-5 shrink-0 text-amber-700" />
        ) : (
          <Square className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1">
          <p className={cn('text-sm font-semibold', isYaris ? 'text-amber-900' : 'text-foreground')}>
            ¿Es un pesaje de Yaris?
          </p>
          <p className={cn('text-xs', isYaris ? 'text-amber-800/80' : 'text-muted-foreground')}>
            {isYaris
              ? 'Activado. Seleccioná un envase dedicado a Yaris arriba.'
              : 'Marcá esta opción si la carga viene de un tacho Yaris.'}
          </p>
        </div>
      </button>

      {/* Observaciones */}
      <div className="space-y-1.5">
        <label htmlFor="weighing-observations" className="text-sm font-medium text-foreground">
          Observaciones
        </label>
        <textarea
          id="weighing-observations"
          value={state.observations}
          onChange={(e) => onChange({ observations: e.target.value })}
          placeholder="Ej: Yaris #3, Picanto rojo, tacho con daño en tapa…"
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
        />
      </div>

      {/* Fotos — balanza arriba, envase abajo (solo orden visual; el orden de
          subida photo_container/photo_scale no cambia para no romper el reporte) */}
      <div className="grid grid-cols-1 gap-4">
        <PhotoCapture
          label="Foto de la balanza"
          required
          preview={state.photo_scale}
          onCapture={(url) => onChange({ photo_scale: url })}
          onRemove={() => onChange({ photo_scale: null })}
        />
        <PhotoCapture
          label="Foto del envase"
          required
          preview={state.photo_container}
          onCapture={(url) => onChange({ photo_container: url })}
          onRemove={() => onChange({ photo_container: null })}
        />
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse">
        {mode === 'create' ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="sm:flex-1"
            size="lg"
          >
            Guardar y agregar otro
          </Button>
        ) : (
          <>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="sm:flex-1"
            >
              Guardar cambios
            </Button>
            {onCancelEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancelEdit}
                className="sm:flex-1"
              >
                Cancelar
              </Button>
            )}
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 sm:flex-none"
              >
                Eliminar
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
