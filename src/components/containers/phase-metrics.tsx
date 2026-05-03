import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ContainerReception, StorageEvent, TreatmentRun, ExternalTransfer } from '@/lib/types'

interface PhaseMetrics {
  weighingDurationHours: number | null
  coldStorageDurationHours: number | null
  treatmentDurationHours: number | null
}

export function computePhaseMetrics(
  reception: ContainerReception | null,
  storage: StorageEvent | null,
  treatmentOrTransfer: TreatmentRun | ExternalTransfer | null
): PhaseMetrics {
  const hoursBetween = (start: string, end: string | null): number | null => {
    if (!end) return null
    return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60)
  }

  return {
    weighingDurationHours: reception && storage
      ? hoursBetween(reception.arrived_at, storage.entry_at)
      : null,
    coldStorageDurationHours: storage
      ? hoursBetween(storage.entry_at, storage.exit_at)
      : null,
    treatmentDurationHours: treatmentOrTransfer
      ? (() => {
          if ('started_at' in treatmentOrTransfer) {
            return hoursBetween(treatmentOrTransfer.started_at, treatmentOrTransfer.completed_at)
          }
          return hoursBetween(
            (treatmentOrTransfer as ExternalTransfer).storage_started_at,
            (treatmentOrTransfer as ExternalTransfer).transferred_at
          )
        })()
      : null,
  }
}

function formatHours(hours: number | null): string {
  if (hours === null) return 'En curso'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  return `${hours.toFixed(1)} h`
}

interface Props {
  reception: ContainerReception | null
  storage: StorageEvent | null
  treatmentOrTransfer: TreatmentRun | ExternalTransfer | null
}

export function PhaseMetrics({ reception, storage, treatmentOrTransfer }: Props) {
  const metrics = computePhaseMetrics(reception, storage, treatmentOrTransfer)

  const cards = [
    { label: 'Pesaje → Cámara fría', value: metrics.weighingDurationHours, show: !!reception },
    { label: 'Tiempo en cámara fría', value: metrics.coldStorageDurationHours, show: !!storage },
    { label: 'Tratamiento / Traslado', value: metrics.treatmentDurationHours, show: !!treatmentOrTransfer },
  ].filter(({ show }) => show)

  if (cards.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-600 mb-3">Tiempo por fase</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(({ label, value }) => (
          <Card key={label} className="border-slate-100">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-slate-500">{label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-xl font-semibold text-slate-800">{formatHours(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
