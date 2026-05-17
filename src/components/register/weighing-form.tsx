'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhotoCapture } from '@/components/register/photo-capture'
import { cn } from '@/lib/utils'
import { computeNetWeight } from '@/lib/data/containers'
import type { Container, Company, WasteType } from '@/lib/types'

const WASTE_OPTIONS: { value: WasteType; label: string }[] = [
  { value: 'infectious', label: 'Peligroso infeccioso' },
  { value: 'anatomopathological', label: 'Anatomopatológico' },
  { value: 'cytotoxic', label: 'Citotóxico' },
  { value: 'liquid', label: 'Líquidos' },
  { value: 'morgue', label: 'Morgue' },
]

/**
 * Estado de un envase pesado dentro de la sesión actual. Se puede crear nuevo
 * o cargar desde una `ContainerReception` ya persistida para editar.
 */
export interface WeighingFormState {
  waste_type: WasteType | ''
  container_id: string
  photo_container: string | null  // dataURL
  photo_scale: string | null      // dataURL
  gross_weight: string
}

export const EMPTY_WEIGHING_FORM: WeighingFormState = {
  waste_type: '',
  container_id: '',
  photo_container: null,
  photo_scale: null,
  gross_weight: '',
}

interface Props {
  state: WeighingFormState
  onChange: (updates: Partial<WeighingFormState>) => void
  containers: Container[]
  companies: Company[]
  /** Cuando true: el formulario está atenuado y no es editable. */
  locked: boolean
  /** 'create' = botón "Guardar y agregar otro"; 'edit' = "Guardar cambios" + "Cancelar". */
  mode: 'create' | 'edit'
  onSubmit: () => void
  onCancelEdit?: () => void
  onDelete?: () => void
}

export function WeighingForm({
  state,
  onChange,
  containers,
  companies,
  locked,
  mode,
  onSubmit,
  onCancelEdit,
  onDelete,
}: Props) {
  // Solo envases activos cuyo waste_type coincide con el seleccionado
  const filteredContainers = state.waste_type
    ? containers.filter((c) => c.status === 'active' && c.waste_type === state.waste_type)
    : containers.filter((c) => c.status === 'active')

  const selectedContainer = containers.find((c) => c.id === state.container_id) ?? null
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]))

  const grossWeight = parseFloat(state.gross_weight)
  const hasValidWeight =
    !!state.gross_weight &&
    !Number.isNaN(grossWeight) &&
    selectedContainer != null &&
    grossWeight > selectedContainer.tare_weight_kg

  const canSubmit =
    !!state.waste_type &&
    !!state.container_id &&
    !!state.photo_container &&
    !!state.photo_scale &&
    hasValidWeight

  function handleWasteTypeChange(value: string | null) {
    const newType = (value || '') as WasteType | ''
    // Si el tipo cambia, reset container_id si ya no matcha
    if (selectedContainer && selectedContainer.waste_type !== newType) {
      onChange({ waste_type: newType, container_id: '' })
    } else {
      onChange({ waste_type: newType })
    }
  }

  return (
    <div
      className={cn(
        'space-y-5 transition-opacity',
        locked && 'pointer-events-none opacity-50 select-none',
      )}
      aria-disabled={locked}
    >
      {/* Tipo de desecho */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Tipo de desecho <span className="text-red-500">*</span>
        </label>
        <Select value={state.waste_type} onValueChange={handleWasteTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            {WASTE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Envase */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Número de envase <span className="text-red-500">*</span>
        </label>
        <Select
          value={state.container_id}
          onValueChange={(v) => onChange({ container_id: v ?? '' })}
          disabled={!state.waste_type}
        >
          <SelectTrigger>
            <SelectValue placeholder={state.waste_type ? 'Seleccionar envase' : 'Primero elige el tipo de desecho'} />
          </SelectTrigger>
          <SelectContent>
            {filteredContainers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.id} — {companyMap[c.company_id] ?? '—'} · {c.size_liters} L
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedContainer && (
          <p className="text-xs text-muted-foreground">
            Tara: <strong>{selectedContainer.tare_weight_kg} kg</strong>
          </p>
        )}
      </div>

      {/* Fotos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PhotoCapture
          label="Foto del envase"
          required
          preview={state.photo_container}
          onCapture={(url) => onChange({ photo_container: url })}
          onRemove={() => onChange({ photo_container: null })}
        />
        <PhotoCapture
          label="Foto de la balanza"
          required
          preview={state.photo_scale}
          onCapture={(url) => onChange({ photo_scale: url })}
          onRemove={() => onChange({ photo_scale: null })}
        />
      </div>

      {/* Peso bruto */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Peso bruto (kg) <span className="text-red-500">*</span>
        </label>
        <Input
          type="number"
          step="0.1"
          min="0"
          value={state.gross_weight}
          onChange={(e) => onChange({ gross_weight: e.target.value })}
          placeholder="Ej: 43.7"
          className="text-lg h-12"
        />
        {selectedContainer && hasValidWeight && (
          <p className="text-sm text-muted-foreground">
            Peso neto estimado:{' '}
            <strong className="text-foreground">
              {computeNetWeight(grossWeight, selectedContainer.tare_weight_kg)} kg
            </strong>
          </p>
        )}
        {state.gross_weight && selectedContainer && !hasValidWeight && (
          <p className="text-xs text-red-600">
            El peso bruto debe ser mayor que la tara ({selectedContainer.tare_weight_kg} kg).
          </p>
        )}
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
