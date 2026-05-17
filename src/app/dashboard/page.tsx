'use client'

import { useMemo } from 'react'
import { MetricsCards, computeDashboardMetrics } from '@/components/dashboard/metrics-cards'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { useStore } from '@/lib/store'

export default function DashboardPage() {
  const { containers, routeEvents, storageEvents, treatmentRuns } = useStore()

  const metrics = useMemo(
    () => computeDashboardMetrics(containers, routeEvents, storageEvents, treatmentRuns),
    [containers, routeEvents, storageEvents, treatmentRuns]
  )

  return (
    <div className="space-y-6">
      <DashboardHero />
      <MetricsCards metrics={metrics} />

      <section className="rounded-xl bg-card p-8 text-center text-muted-foreground ring-1 ring-foreground/10">
        <p className="text-sm">
          El dashboard completo (gráficos de circulación, kg por día y por cliente)
          se entrega en la Fase 5 del rediseño operativo.
        </p>
      </section>
    </div>
  )
}
