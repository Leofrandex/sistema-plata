'use client'

import { useEffect, useMemo, useState } from 'react'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { InterimModeBanner } from '@/components/dashboard/interim-mode-banner'
import { MetricsCards, computeDashboardMetrics } from '@/components/dashboard/metrics-cards'
import { CirculationPieChart } from '@/components/dashboard/circulation-pie-chart'
import { DailyKgDonut } from '@/components/dashboard/daily-kg-donut'
import { MonthlyBarChart } from '@/components/dashboard/monthly-bar-chart'
import { WasteTypeSection, type WasteRange } from '@/components/dashboard/waste-type-section'
import { RoutesComplianceSection } from '@/components/dashboard/routes-compliance-section'
import { StagnantContainersSection } from '@/components/dashboard/stagnant-containers-section'
import { KgTrendsSection } from '@/components/dashboard/kg-trends-section'
import { OperatorActivitySection } from '@/components/dashboard/operator-activity-section'
import { QualitySection } from '@/components/dashboard/quality-section'
import { FleetSection } from '@/components/dashboard/fleet-section'
import { EquipmentSummaryCard } from '@/components/dashboard/equipment-summary-card'
import {
  computeCirculationBreakdown,
  computeDailyKg,
  computeMonthlyKgByCompany,
} from '@hospiwaste/shared/lib/data/dashboard-metrics'
import {
  addDaysISO,
  computeAvgWeightPerContainer,
  computeDailyKgSeries,
  computeFleetBreakdown,
  computeKgByWasteType,
  computeMonthComparison,
  computeOperatorActivity,
  computeQualityIndicators,
  computeRouteStats,
  computeSlotComplianceToday,
  computeStagnantContainers,
} from '@hospiwaste/shared/lib/data/dashboard-analytics'
import { useStore } from '@hospiwaste/shared/lib/store'

/**
 * Dashboard del coordinador: solo el día a día.
 *
 * Todo lo que mira hacia atrás —el histórico de planta 2024–2026, el
 * comparativo año contra año, el acumulado anual, la navegación por meses—
 * vive en `/analytics`. Acá no se toca `historical_daily_kg`: esta página se
 * alimenta únicamente del store, así que carga con la hidratación y nada más.
 * Ver el log 2026-09-18-dashboard-operativo-vs-analitico.
 */
export default function DashboardPage() {
  const {
    clients, companies, containers, routeEvents, receptions, weighingSessions,
    storageEvents, treatmentRuns, externalTransfers, locations,
    users, currentProfileId, connectionStatus,
  } = useStore()

  const firstName = useMemo(() => {
    const full = users.find((u) => u.id === currentProfileId)?.name
    return full ? full.split(' ')[0] : undefined
  }, [users, currentProfileId])

  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])
  const currentMonth = today.slice(0, 7) // 'YYYY-MM'
  const [wasteRange, setWasteRange] = useState<WasteRange>('30d')

  // El store arranca sembrado con los mocks, cuyas fechas son viejas: hasta que
  // la hidratación termina, todo lo que se calcula contra hoy da 0 y las
  // gráficas dibujan una planta parada que no existe. Mientras tanto van
  // esqueletos. 'connecting' es exclusivo del primer intento — las
  // rehidrataciones (foco, reconexión, login) no vuelven a ese estado, así que
  // el dashboard ya cargado nunca parpadea.
  const loading = connectionStatus === 'connecting'

  // Reloj para "tiempo en estado" de los tachos estancados (refresco 60s).
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

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

  // Mes en curso y solo del sistema. El mes del corte (sep-2026) tiene días que
  // vienen de las planillas de planta, pero completarlos exigiría traer el
  // histórico: eso es el trabajo de Analíticas, no del tablero del día.
  const monthlyKg = useMemo(
    () => computeMonthlyKgByCompany(
      { clients, companies, containers, receptions, treatmentRuns },
      currentMonth,
    ),
    [clients, companies, containers, receptions, treatmentRuns, currentMonth],
  )

  const wasteByType = useMemo(() => {
    const startDay =
      wasteRange === '7d' ? addDaysISO(today, -6)
      : wasteRange === '30d' ? addDaysISO(today, -29)
      : `${currentMonth}-01`
    return computeKgByWasteType({ containers, receptions }, startDay, today)
  }, [containers, receptions, today, currentMonth, wasteRange])

  const slotCompliance = useMemo(
    () => computeSlotComplianceToday(routeEvents, today),
    [routeEvents, today],
  )

  const routeStats = useMemo(
    () => computeRouteStats(routeEvents, today),
    [routeEvents, today],
  )

  const stagnant = useMemo(
    () => computeStagnantContainers(
      { containers, routeEvents, receptions, treatmentRuns, externalTransfers },
      nowMs,
      5,
    ),
    [containers, routeEvents, receptions, treatmentRuns, externalTransfers, nowMs],
  )

  const kgSeries = useMemo(
    () => computeDailyKgSeries({ containers, receptions }, today, 30),
    [containers, receptions, today],
  )

  const monthComparison = useMemo(
    () => computeMonthComparison({ containers, receptions }, currentMonth),
    [containers, receptions, currentMonth],
  )

  const avgWeight = useMemo(
    () => computeAvgWeightPerContainer({ containers, receptions }, addDaysISO(today, -29), today),
    [containers, receptions, today],
  )

  const operatorActivity = useMemo(
    () => computeOperatorActivity(
      { users, routeEvents, receptions, treatmentRuns },
      addDaysISO(today, -6),
      today,
    ),
    [users, routeEvents, receptions, treatmentRuns, today],
  )

  const quality = useMemo(
    () => computeQualityIndicators(
      { routeEvents, receptions, weighingSessions },
      addDaysISO(today, -6),
    ),
    [routeEvents, receptions, weighingSessions, today],
  )

  const fleet = useMemo(
    () => computeFleetBreakdown(
      { companies, containers, routeEvents, receptions, treatmentRuns, externalTransfers },
      today,
    ),
    [companies, containers, routeEvents, receptions, treatmentRuns, externalTransfers, today],
  )

  return (
    <div className="space-y-4 pb-8">
      <DashboardHero name={firstName} />
      <InterimModeBanner />
      <MetricsCards metrics={metrics} loading={loading} />

      {/*
        Una sola grilla de 12 columnas para todas las tarjetas, en vez de filas
        sueltas de 1 y 2 columnas. Cada tarjeta pide el ancho que su contenido
        necesita: el semáforo de equipos son cuatro chips y no merece la página
        entera, la tendencia de kg es un gráfico de 30 puntos y sí.

        `items-start` es el default: una tarjeta corta no se estira hasta el
        alto de su vecina alta, porque estirarla solo agregaría hueco al pie.
        Las que sí se estiran lo piden con `self-stretch flex flex-col`, y a
        cambio tienen adentro una región `flex-1` que se come el alto extra —
        el gráfico crece, no el vacío.
      */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {/* Kilos: la tendencia manda, el donut del día la acompaña */}
        <KgTrendsSection
          series={kgSeries}
          monthComparison={monthComparison}
          avgWeightPerContainer={avgWeight}
          loading={loading}
          className="flex flex-col self-stretch lg:col-span-8"
        />
        <DailyKgDonut data={dailyKg} loading={loading} className="lg:col-span-4" />

        {/* Estado de la operación ahora mismo */}
        <RoutesComplianceSection
          compliance={slotCompliance}
          stats={routeStats}
          loading={loading}
          className="flex flex-col self-stretch lg:col-span-4"
        />
        <CirculationPieChart
          data={circulation}
          loading={loading}
          className="flex flex-col self-stretch lg:col-span-4"
        />
        <div className="space-y-4 lg:col-span-4">
          <EquipmentSummaryCard />
          <FleetSection fleet={fleet} loading={loading} />
        </div>

        {/* Qué se recibió y quién lo registró */}
        <WasteTypeSection
          buckets={wasteByType.buckets}
          totalKg={wasteByType.totalKg}
          range={wasteRange}
          onRangeChange={setWasteRange}
          loading={loading}
          className="flex flex-col self-stretch lg:col-span-6"
        />
        <OperatorActivitySection
          rows={operatorActivity}
          loading={loading}
          className="lg:col-span-6"
        />

        {/* Pendientes de atención */}
        <StagnantContainersSection rows={stagnant} loading={loading} className="lg:col-span-7" />
        <QualitySection
          indicators={quality}
          windowLabel="últimos 7 días"
          loading={loading}
          className="flex flex-col self-stretch lg:col-span-5"
        />

        {/* Kg del mes en curso por empresa — sin navegador: mirar meses
            anteriores es cosa de Analíticas, que sí carga el histórico. */}
        <MonthlyBarChart
          data={monthlyKg}
          month={currentMonth}
          loading={loading}
          className="lg:col-span-12"
        />
      </div>
    </div>
  )
}
