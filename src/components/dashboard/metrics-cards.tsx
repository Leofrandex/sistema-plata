import { Boxes, Route, Scale, Flame, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPendingWeighingContainerIds } from '@/lib/data/containers'
import type {
  Container,
  ContainerReception,
  RouteEvent,
  TreatmentRun,
} from '@/lib/types'

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
  const routesToday = routeEvents.filter((r) => r.date === today).length
  // Los contenedores Yaris de flota no atraviesan el ciclo de planta:
  // fuera del pool en circulación (igual que computeCirculationBreakdown).
  const containersInCirculation = containers.filter(
    (c) => c.status === 'active' && !c.is_yaris_container,
  ).length
  const containersPendingWeighing = getPendingWeighingContainerIds(containers, routeEvents, receptions).length
  const containersInTreatment = treatmentRuns.filter((t) => t.completed_at === null).length

  return {
    routesToday,
    containersInCirculation,
    containersPendingWeighing,
    containersInTreatment,
  }
}

interface CardSpec {
  key: keyof DashboardMetrics
  label: string
  icon: LucideIcon
  iconBg: string
  iconText: string
  decoration: string
}

const CARDS: CardSpec[] = [
  { key: 'routesToday',                label: 'Recorridos hoy',         icon: Route,  iconBg: 'bg-accent/10',  iconText: 'text-accent',     decoration: 'from-accent/15    to-accent/0' },
  { key: 'containersInCirculation',    label: 'Tachos en circulación', icon: Boxes,  iconBg: 'bg-primary/10', iconText: 'text-primary',    decoration: 'from-primary/15   to-primary/0' },
  { key: 'containersPendingWeighing',  label: 'Pendientes de pesar',    icon: Scale,  iconBg: 'bg-amber-100',  iconText: 'text-amber-700',  decoration: 'from-amber-200/40 to-amber-200/0' },
  { key: 'containersInTreatment',      label: 'En tratamiento',         icon: Flame,  iconBg: 'bg-violet-100', iconText: 'text-violet-700', decoration: 'from-violet-200/40 to-violet-200/0' },
]

interface Props {
  metrics: DashboardMetrics
}

export function MetricsCards({ metrics }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {CARDS.map(({ key, label, icon: Icon, iconBg, iconText, decoration }) => (
        <div
          key={key}
          className="group relative overflow-hidden rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div aria-hidden className={cn('pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br blur-2xl', decoration)} />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <span className={cn('flex size-9 items-center justify-center rounded-lg ring-1 ring-foreground/5', iconBg, iconText)}>
                <Icon aria-hidden className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-bold tabular-nums text-foreground">{metrics[key]}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
