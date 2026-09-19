import { Skeleton } from '@hospiwaste/shared/components/ui/skeleton'
import { getPendingWeighingContainerIds } from '@hospiwaste/shared/lib/data/containers'
import type {
  Container,
  ContainerReception,
  RouteEvent,
  TreatmentRun,
} from '@hospiwaste/shared/lib/types'

interface DashboardMetrics {
  routesToday: number
  containersInCirculation: number
  containersPendingWeighing: number
  containersInTreatment: number
}

export function computeDashboardMetrics(
  containers: Container[],
  routeEvents: RouteEvent[],
  receptions: ContainerReception[],
  treatmentRuns: TreatmentRun[],
  today: string = new Date().toISOString().slice(0, 10)
): DashboardMetrics {
  const routesToday = routeEvents.filter((r) => r.date === today && !r.voided_at).length
  const containersInCirculation = containers.filter((c) => c.status === 'active').length
  const containersPendingWeighing = getPendingWeighingContainerIds(containers, routeEvents, receptions).length
  const containersInTreatment = treatmentRuns.filter((t) => t.completed_at === null).length

  return {
    routesToday,
    containersInCirculation,
    containersPendingWeighing,
    containersInTreatment,
  }
}

/**
 * Las tres secundarias. La cola de pesaje no está acá: es la primaria y se
 * dibuja aparte, con el contexto que estas no tienen.
 */
const SECONDARY: Array<{ key: keyof DashboardMetrics; label: string }> = [
  { key: 'routesToday', label: 'Recorridos hoy' },
  { key: 'containersInCirculation', label: 'Tachos en circulación' },
  { key: 'containersInTreatment', label: 'En tratamiento' },
]

interface Props {
  metrics: DashboardMetrics
  loading?: boolean
}

/**
 * Fila de métricas del día. La cola de pesaje manda: en modo interino es lo
 * único sobre lo que el coordinador puede actuar, así que ocupa medio ancho y
 * lleva el denominador al lado. Las otras tres son referencia y se compactan.
 */
export function MetricsCards({ metrics, loading = false }: Props) {
  const pending = metrics.containersPendingWeighing
  const active = metrics.containersInCirculation
  const pendingPct = active > 0 ? Math.round((pending / active) * 100) : null

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      {/* Primaria — el acento marca que acá es donde se actúa. */}
      <div className="rounded-xl border-l-2 border-accent bg-card p-5 ring-1 ring-foreground/10 lg:col-span-6">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pendientes de pesar
        </span>
        {loading ? (
          <Skeleton className="mt-2 h-10 w-24" />
        ) : (
          <p className="mt-1 text-[40px] font-bold leading-none tabular-nums text-foreground">
            {pending}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {loading || pendingPct === null ? (
            <span className="tabular-nums">de {active} tachos en circulación</span>
          ) : (
            <span className="tabular-nums">
              de {active} tachos en circulación · {pendingPct}% de la flota activa
            </span>
          )}
        </p>
      </div>

      {SECONDARY.map(({ key, label }) => (
        <div
          key={key}
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-12" />
          ) : (
            <p className="mt-1.5 text-2xl font-bold leading-none tabular-nums text-foreground">
              {metrics[key]}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
