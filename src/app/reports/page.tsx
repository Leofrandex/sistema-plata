'use client'

import { useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useStore } from '@/lib/store'
import {
  buildPhotographicReportData,
  getMondayOfWeek,
  isoDate,
} from '@/lib/data/reports'
import { ReportPreview } from '@/components/reports/report-preview'

export default function ReportsPage() {
  const {
    clients, companies, containers, routeEvents, weighingSessions, receptions, photos,
  } = useStore()

  const clientNameMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.name])),
    [clients],
  )

  const [companyId, setCompanyId] = useState<string>(companies[0]?.id ?? '')

  const now = useMemo(() => new Date(), [])
  const monday = useMemo(() => getMondayOfWeek(now), [now])
  const weekStartLabel = isoDate(monday)
  const weekEndLabel = isoDate(now)

  const reportData = useMemo(() => {
    if (!companyId) return null
    return buildPhotographicReportData(
      companyId,
      { clients, companies, containers, routeEvents, weighingSessions, receptions, photos },
      now,
    )
  }, [companyId, clients, companies, containers, routeEvents, weighingSessions, receptions, photos, now])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Genera el registro fotográfico semanal por empresa. El rango incluye
          todas las fotos de recorridos y pesajes desde el lunes hasta el momento actual.
          Si querés reportes de varias empresas, descargá uno por cada una.
        </p>
      </header>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Empresa</label>
            <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? '')}>
              <SelectTrigger className="w-full sm:max-w-md">
                <SelectValue placeholder="Seleccionar empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((co) => (
                  <SelectItem key={co.id} value={co.id}>
                    {co.name} <span className="text-muted-foreground">({clientNameMap[co.client_id] ?? '—'})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Rango automático: <strong className="text-foreground">{weekStartLabel}</strong>{' '}
              al <strong className="text-foreground">{weekEndLabel}</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {reportData ? (
        <ReportPreview data={reportData} />
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Selecciona una empresa para ver el reporte de esta semana.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
