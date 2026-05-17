'use client'

import dynamic from 'next/dynamic'
import { Download, Loader2, FileText, Route, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { APP_NAME } from '@/lib/constants'
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
  const { client, weekStart, weekEnd, meta, byStage } = data

  const safeClientName = client.name.replace(/[^a-z0-9]/gi, '_')
  const filename = `${APP_NAME}_RegistroFotografico_${safeClientName}_${weekStart}_${weekEnd}.pdf`

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Registro fotográfico — {client.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Semana del {weekStart} al {weekEnd}
              </p>
            </div>
          </div>
        </header>

        {/* Métricas del reporte */}
        <div className="grid grid-cols-3 gap-3">
          <MetricBox
            icon={<Route className="h-4 w-4" />}
            label="Recorridos"
            value={meta.routeEventCount}
            empresas={byStage.route.length}
          />
          <MetricBox
            icon={<Scale className="h-4 w-4" />}
            label="Pesajes"
            value={meta.weighingReceptionCount}
            empresas={byStage.weighing.length}
          />
          <MetricBox
            icon={<FileText className="h-4 w-4" />}
            label="Total de fotos"
            value={meta.totalPhotos}
          />
        </div>

        {/* Desglose por empresa */}
        {(byStage.route.length > 0 || byStage.weighing.length > 0) && (
          <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Desglose por empresa
            </p>
            {byStage.route.map((g) => (
              <p key={`route-${g.company.id}`}>
                Recorridos · <strong>{g.company.name}</strong>: {g.photos.length} foto{g.photos.length !== 1 ? 's' : ''}
              </p>
            ))}
            {byStage.weighing.map((g) => (
              <p key={`weighing-${g.company.id}`}>
                Pesajes · <strong>{g.company.name}</strong>: {g.photos.length} foto{g.photos.length !== 1 ? 's' : ''}
              </p>
            ))}
          </div>
        )}

        {meta.totalPhotos === 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            No hay registros fotográficos para {client.name} en este rango. El PDF se genera de todas formas con una nota.
          </div>
        )}

        {/* CTA de descarga */}
        <div className="pt-2 border-t">
          <PDFDownloadLink
            document={<PhotographicReportDocument data={data} />}
            fileName={filename}
          >
            {/* PDFDownloadLink children pueden ser fn o ReactNode. Usamos fn para el spinner. */}
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
  empresas?: number
}

function MetricBox({ icon, label, value, empresas }: MetricBoxProps) {
  return (
    <div className="rounded-lg ring-1 ring-foreground/10 bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-foreground mt-2">{value}</p>
      {empresas !== undefined && (
        <p className="text-xs text-muted-foreground">
          {empresas} empresa{empresas !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
