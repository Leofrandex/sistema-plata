'use client'

import dynamic from 'next/dynamic'
import { Download, Loader2, FileText, Route, Scale } from 'lucide-react'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { Card, CardContent } from '@hospiwaste/shared/components/ui/card'
import { APP_NAME } from '@hospiwaste/shared/lib/constants'
import type { PhotographicReportData } from '@/lib/data/reports'
import { PhotographicReportDocument } from './photographic-report-document'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false },
)

interface Props {
  data: PhotographicReportData
}

export function ReportPreview({ data }: Props) {
  const { company, client, rangeStart, rangeEnd, meta } = data

  const safeName = company.name.replace(/[^a-z0-9]/gi, '_')
  const filename = `${APP_NAME}_RegistroFotografico_${safeName}_${rangeStart}_${rangeEnd}.pdf`

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <header className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Registro fotográfico — {company.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {client.name} · {rangeStart} al {rangeEnd}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3">
          <MetricBox
            icon={<Route className="h-4 w-4" />}
            label="Recorridos"
            value={meta.routeEventCount}
            secondary={`${meta.routePhotoCount} foto${meta.routePhotoCount !== 1 ? 's' : ''}`}
          />
          <MetricBox
            icon={<Scale className="h-4 w-4" />}
            label="Pesajes"
            value={meta.weighingReceptionCount}
            secondary={`${meta.weighingPhotoCount} foto${meta.weighingPhotoCount !== 1 ? 's' : ''}`}
          />
          <MetricBox
            icon={<FileText className="h-4 w-4" />}
            label="Total de fotos"
            value={meta.totalPhotos}
          />
        </div>

        {meta.totalPhotos === 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            No hay registros fotográficos para {company.name} en este rango.
            El PDF se genera con una nota informativa.
          </div>
        )}

        <div className="pt-2 border-t">
          <PDFDownloadLink
            document={<PhotographicReportDocument data={data} />}
            fileName={filename}
          >
            {({ loading }) => (
              <Button disabled={loading} className="gap-2 w-full sm:w-auto" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generando PDF…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Descargar reporte PDF
                  </>
                )}
              </Button>
            )}
          </PDFDownloadLink>
          <p className="text-xs text-muted-foreground mt-2">
            El archivo se guardará como <code className="font-mono">{filename}</code>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

interface MetricBoxProps {
  icon: React.ReactNode
  label: string
  value: number
  secondary?: string
}

function MetricBox({ icon, label, value, secondary }: MetricBoxProps) {
  return (
    <div className="rounded-lg ring-1 ring-foreground/10 bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-foreground mt-2">{value}</p>
      {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
    </div>
  )
}
