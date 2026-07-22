import { MapPin } from 'lucide-react'
import type { ContainerLocation } from '@hospiwaste/shared/lib/types'

const LOCATION_TYPE_LABELS: Record<string, string> = {
  client_site: 'Instalación del cliente',
  plant_storage: 'Planta — almacén',
  cold_storage: 'Planta — cámara fría',
  treatment: 'Planta — tratamiento',
}

interface Props {
  locations: ContainerLocation[]
  clientNames: Record<string, string>
}

export function LocationHistory({ locations, clientNames }: Props) {
  const sorted = [...locations].sort(
    (a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
  )

  if (sorted.length === 0) {
    return <p className="text-sm text-slate-400">Sin registros de ubicación.</p>
  }

  return (
    <ol className="relative border-l border-slate-200 space-y-4 ml-2">
      {sorted.map((loc, idx) => {
        const isLatest = idx === 0
        const detail =
          loc.location_type === 'client_site'
            ? [clientNames[loc.client_id ?? ''], `Piso ${loc.floor}`, loc.area]
                .filter(Boolean)
                .join(' · ')
            : LOCATION_TYPE_LABELS[loc.location_type] ?? loc.location_type

        return (
          <li key={loc.id} className="pl-4">
            <div
              className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border ${
                isLatest ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'
              }`}
            />
            <p className={`text-sm font-medium ${isLatest ? 'text-blue-700' : 'text-slate-700'}`}>
              {detail}
              {isLatest && (
                <span className="ml-2 text-xs font-normal bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                  Actual
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(loc.reported_at).toLocaleString('es-PA')}
              {loc.notes && <> · {loc.notes}</>}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
