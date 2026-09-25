'use client'

import { useState } from 'react'
import { Download, Loader2, FileText, Route, Scale } from 'lucide-react'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { Card, CardContent } from '@hospiwaste/shared/components/ui/card'
import { APP_NAME } from '@hospiwaste/shared/lib/constants'
import { reportPhotoUrls, type PhotographicReportData } from '@/lib/data/reports'
import { prepareReportImages } from '@/lib/report-images'
import { PhotographicReportDocument } from './photographic-report-document'

interface Props {
  data: PhotographicReportData
}

type GenerationState =
  | { phase: 'idle' }
  | { phase: 'photos'; done: number; total: number }
  | { phase: 'pdf' }
  | { phase: 'done'; missing: number }
  | { phase: 'error'; message: string }

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function ReportPreview({ data }: Props) {
  const { company, client, rangeStart, rangeEnd, meta } = data
  const [state, setState] = useState<GenerationState>({ phase: 'idle' })

  const safeName = company.name.replace(/[^a-z0-9]/gi, '_')
  const filename = `${APP_NAME}_RegistroFotografico_${safeName}_${rangeStart}_${rangeEnd}.pdf`
  const busy = state.phase === 'photos' || state.phase === 'pdf'

  // El PDF se arma recién al hacer clic: primero se descargan y reducen las
  // fotos (con reintentos), después se genera el archivo. Antes @react-pdf
  // bajaba todas las fotos a tamaño original apenas se abría la vista previa.
  async function handleGenerate() {
    try {
      const urls = reportPhotoUrls(data)
      setState({ phase: 'photos', done: 0, total: urls.length })
      const images = await prepareReportImages(urls, {
        onProgress: (done, total) => setState({ phase: 'photos', done, total }),
      })
      setState({ phase: 'pdf' })
      const { pdf } = await import('@react-pdf/renderer')
      const blob = await pdf(<PhotographicReportDocument data={data} images={images} />).toBlob()
      triggerDownload(blob, filename)
      const missing = [...images.values()].filter((v) => v === null).length
      setState({ phase: 'done', missing })
    } catch (err) {
      console.error('[reports] generar PDF falló:', err)
      setState({ phase: 'error', message: 'No se pudo generar el PDF. Intenta de nuevo.' })
    }
  }

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
          <Button onClick={handleGenerate} disabled={busy} className="gap-2 w-full sm:w-auto" size="lg">
            {state.phase === 'photos' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparando fotos {state.done} de {state.total}…
              </>
            ) : state.phase === 'pdf' ? (
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
          <p className="text-xs text-muted-foreground mt-2">
            El archivo se guardará como <code className="font-mono">{filename}</code>
          </p>
          {state.phase === 'done' && state.missing > 0 && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {state.missing} foto{state.missing !== 1 ? 's' : ''} no se pudo descargar y sale como
              “Foto no disponible” en el PDF. Vuelve a generarlo para reintentar.
            </p>
          )}
          {state.phase === 'error' && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {state.message}
            </p>
          )}
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
