'use client'

import { useMemo, useState } from 'react'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { MetricsCards, computeDashboardMetrics } from '@/components/dashboard/metrics-cards'
import { CirculationPieChart } from '@/components/dashboard/circulation-pie-chart'
import { DailyKgDonut } from '@/components/dashboard/daily-kg-donut'
import { MonthlyBarChart } from '@/components/dashboard/monthly-bar-chart'
import {
  computeCirculationBreakdown,
  computeDailyKg,
  computeMonthlyKgByCompany,
} from '@hospiwaste/shared/lib/data/dashboard-metrics'
import { useStore } from '@hospiwaste/shared/lib/store'

export default function DashboardPage() {
  const {
    clients, companies, containers, routeEvents, receptions,
    storageEvents, treatmentRuns, externalTransfers, locations,
    users, currentProfileId,
  } = useStore()

  const firstName = useMemo(() => {
    const full = users.find((u) => u.id === currentProfileId)?.name
    return full ? full.split(' ')[0] : undefined
  }, [users, currentProfileId])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const currentMonth = today.slice(0, 7) // 'YYYY-MM'
  const [month, setMonth] = useState<string>(currentMonth)

  const metrics = useMemo(
    () => computeDashboardMetrics(containers, routeEvents, receptions, treatmentRuns),
    [containers, routeEvents, receptions, treatmentRuns],
  )

  const circulation = useMemo(
    () => computeCirculationBreakdown({
      containers, routeEvents, receptions, storageEvents, treatmentRuns, externalTransfers, locations,
    }),
    [containers, routeEvents, receptions, storageEvents, treatmentRuns, externalTransfers, locations],
  )

  const dailyKg = useMemo(
    () => computeDailyKg({ containers, receptions, treatmentRuns }, today),
    [containers, receptions, treatmentRuns, today],
  )

  const monthlyKg = useMemo(
    () => computeMonthlyKgByCompany({ clients, companies, containers, receptions, treatmentRuns }, month),
    [clients, companies, containers, receptions, treatmentRuns, month],
  )

  return (
    <div className="space-y-6 pb-8">
      <DashboardHero name={firstName} />
      <MetricsCards metrics={metrics} />

      {/* Fila 1: torta de circulación + donut kg/día (2 columnas en ≥lg) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CirculationPieChart data={circulation} />
        <DailyKgDonut data={dailyKg} />
      </div>

      {/* Fila 2: barras kg/empresa/mes (ancho completo) — el mes es seleccionable */}
      <MonthlyBarChart
        data={monthlyKg}
        month={month}
        onMonthChange={setMonth}
        maxMonth={currentMonth}
      />
    </div>
  )
}
