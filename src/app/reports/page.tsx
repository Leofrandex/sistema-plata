'use client'

import { useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  const defaultStart = useMemo(() => isoDate(getMondayOfWeek(now)), [now])
  const defaultEnd = useMemo(() => isoDate(now), [now])

  const [startStr, setStartStr] = useState<string>(defaultStart)
  const [endStr, setEndStr] = useState<string>(defaultEnd)

  const invalidRange = startStr > endStr

  const reportData = useMemo(() => {
    if (!companyId || invalidRange) return null
    // input date (YYYY-MM-DD) → rango local [00:00, 23:59:59]
    const start = new Date(`${startStr}T00:00:00`)
    const end = new Date(`${endStr}T23:59:59`)
    return buildPhotographicReportData(
      companyId,
      { clients, companies, containers, routeEvents, weighingSessions, receptions, photos },
      { start, end },
    )
  }, [companyId, startStr, endStr, invalidRange, clients, companies, containers, routeEvents, weighingSessions, receptions, photos])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Genera el registro fotográfico por empresa. Por defecto cubre la semana actual,
          pero podés elegir cualquier rango de fechas. Las fotos se ordenan por día,
          ruta y etapa (recorrido y luego pesaje). Un PDF por empresa.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Desde</label>
              <Input type="date" value={startStr} max={endStr} onChange={(e) => setStartStr(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Hasta</label>
              <Input type="date" value={endStr} min={startStr} onChange={(e) => setEndStr(e.target.value)} />
            </div>
          </div>

          {invalidRange ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              La fecha &quot;Desde&quot; no puede ser posterior a &quot;Hasta&quot;.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Rango: <strong className="text-foreground">{startStr}</strong> al{' '}
                <strong className="text-foreground">{endStr}</strong>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {reportData ? (
        <ReportPreview data={reportData} />
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {invalidRange ? 'Corregí el rango de fechas para ver el reporte.' : 'Selecciona una empresa para ver el reporte.'}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
