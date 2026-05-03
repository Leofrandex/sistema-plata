import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Batch, Container, StorageEvent, TreatmentRun } from '@/lib/types'

interface DashboardMetrics {
  activeBatches: number
  containersInCirculation: number
  containersInStorage: number
  containersInTreatment: number
}

export function computeDashboardMetrics(
  batches: Batch[],
  containers: Container[],
  storageEvents: StorageEvent[],
  treatmentRuns: TreatmentRun[]
): DashboardMetrics {
  const activeBatches = batches.filter((b) => b.status === 'active')
  const containerIdsInActiveBatches = new Set(
    activeBatches.flatMap((b) => b.container_ids)
  )
  const containersInStorage = storageEvents.filter((s) => s.exit_at === null).length
  const containersInTreatment = treatmentRuns.filter((t) => t.completed_at === null).length

  return {
    activeBatches: activeBatches.length,
    containersInCirculation: containerIdsInActiveBatches.size,
    containersInStorage,
    containersInTreatment,
  }
}

interface Props {
  metrics: DashboardMetrics
}

export function MetricsCards({ metrics }: Props) {
  const cards = [
    { label: 'Lotes activos', value: metrics.activeBatches },
    { label: 'Envases en circulación', value: metrics.containersInCirculation },
    { label: 'En cámara fría', value: metrics.containersInStorage },
    { label: 'En tratamiento', value: metrics.containersInTreatment },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(({ label, value }) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-800">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
