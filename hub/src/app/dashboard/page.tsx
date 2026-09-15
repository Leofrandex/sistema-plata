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
  computeYearAccumulated,
} from '@hospiwaste/shared/lib/data/dashboard-analytics'
import {
  HISTORICAL_CUTOVER_MONTH,
  HISTORICAL_FIRST_MONTH,
  historicalMonthlyKgByCompany,
  mergeMonthlyByCompany,
  unifiedDailyKg,
  yearlyMonthlySeries,
} from '@hospiwaste/shared/lib/data/historical-kg'
import { useStore } from '@hospiwaste/shared/lib/store'
import { useHistoricalKg } from '@/hooks/use-historical-kg'
import { YearComparisonSection } from '@/components/dashboard/year-comparison-section'

export default function DashboardPage() {
  const {
    clients, companies, containers, routeEvents, receptions, weighingSessions,
    storageEvents, treatmentRuns, externalTransfers, locations,
    users, currentProfileId,
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
  const currentYear = today.slice(0, 4)
  const [month, setMonth] = useState<string>(currentMonth)
  const [wasteRange, setWasteRange] = useState<WasteRange>('30d')

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

  // ── Histórico de planta (2024-01-15 → 2026-09-06, tabla aparte) ─────────────
  // Se trae aparte del store porque no es data operativa: son kilos agregados
  // por día sin trazabilidad de tacho. Ver el ADR 2026-09-14-historico-kilos.
  const {
    rows: historicalRows,
    loading: historicalLoading,
    error: historicalError,
  } = useHistoricalKg()

  // De dónde sale el mes que se está mirando. El mes del corte tiene días de
  // las dos fuentes (sep-2026: histórico del 1 al 6, sistema del 7 en adelante)
  // y hay que sumarlas: elegir una sola dejaba afuera la mitad del mes.
  const monthSource: 'historico' | 'mixto' | 'sistema' =
    month < HISTORICAL_CUTOVER_MONTH
      ? 'historico'
      : month === HISTORICAL_CUTOVER_MONTH
        ? 'mixto'
        : 'sistema'

  const monthlyKg = useMemo(() => {
    if (monthSource === 'historico') return historicalMonthlyKgByCompany(historicalRows, month)

    const live = computeMonthlyKgByCompany(
      { clients, companies, containers, receptions, treatmentRuns },
      month,
    )
    if (monthSource === 'sistema') return live

    return mergeMonthlyByCompany(historicalMonthlyKgByCompany(historicalRows, month), live)
  }, [monthSource, historicalRows, clients, companies, containers, receptions, treatmentRuns, month])

  // Comparativo anual: una sola serie que une histórico + sistema, para que el
  // corte del 7-sep no se note como un escalón en los kilos de septiembre.
  const yearSeries = useMemo(
    () =>
      yearlyMonthlySeries(
        unifiedDailyKg(historicalRows, { companies, containers, receptions }),
      ),
    [historicalRows, companies, containers, receptions],
  )

  // ── Métricas nuevas ─────────────────────────────────────────────────────────

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

  const yearAccumulated = useMemo(
    () => computeYearAccumulated({ containers, receptions }, currentYear),
    [containers, receptions, currentYear],
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
    <div className="space-y-6 pb-8">
      <DashboardHero name={firstName} />
      <InterimModeBanner />
      <MetricsCards metrics={metrics} />

      {/* Hoy: circulación + kg del día */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CirculationPieChart data={circulation} />
        <DailyKgDonut data={dailyKg} />
      </div>

      {/* Operación: cumplimiento de recorridos + tachos estancados */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RoutesComplianceSection compliance={slotCompliance} stats={routeStats} />
        <StagnantContainersSection rows={stagnant} />
      </div>

      {/* Tendencias de kg (30 días + mes + año) */}
      <KgTrendsSection
        series={kgSeries}
        monthComparison={monthComparison}
        yearAccumulated={yearAccumulated}
        avgWeightPerContainer={avgWeight}
      />

      {/* Tipos de desecho + actividad por operador */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WasteTypeSection
          buckets={wasteByType.buckets}
          totalKg={wasteByType.totalKg}
          range={wasteRange}
          onRangeChange={setWasteRange}
        />
        <OperatorActivitySection rows={operatorActivity} />
      </div>

      {/* Kg por empresa (mes seleccionable) */}
      <MonthlyBarChart
        data={monthlyKg}
        month={month}
        onMonthChange={setMonth}
        maxMonth={currentMonth}
        minMonth={HISTORICAL_FIRST_MONTH}
        // Los procesados solo se muestran cuando TODO el mes viene del sistema.
        // En un mes con días del histórico, el procesado cubriría menos días que
        // el recibido y se leería como una merma inexistente.
        showProcessed={monthSource === 'sistema'}
        note={
          monthSource === 'sistema'
            ? undefined
            : historicalError
              ? 'No se pudo cargar el histórico, así que a este mes le faltan días. No significa que no haya habido actividad: recargá la página.'
              : monthSource === 'mixto'
                ? 'Mes del corte: los primeros días vienen de las planillas de planta y el resto de los pesajes registrados en el sistema. No incluye procesados, porque solo existen para la segunda parte del mes.'
                : 'Mes histórico, tomado de las planillas de kilos diarios de planta. No incluye procesados: la fecha de tratado era opcional en ese formulario.'
        }
      />

      {/* Comparativo año contra año (histórico + sistema) */}
      <YearComparisonSection
        series={yearSeries}
        currentMonth={currentMonth}
        loading={historicalLoading}
        error={historicalError}
      />

      {/* Calidad del registro + flota/planta */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QualitySection indicators={quality} windowLabel="últimos 7 días" />
        <FleetSection fleet={fleet} />
      </div>

      {/* Equipos (async, fuera del store) */}
      <EquipmentSummaryCard />
    </div>
  )
}
