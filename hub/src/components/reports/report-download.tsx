'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import type { PhotographicReportData } from '@/lib/data/reports'
import { layoutPhotoUrls, type ReportLayout } from '@/lib/data/report-layout'
import { prepareReportImages } from '@/lib/report-images'
import { PhotographicReportDocument } from './photographic-report-document'

export type GenerationState =
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

/** Genera y descarga el PDF de una maqueta. Lo usan `/reports` y el editor. */
export function useReportDownload() {
  const [state, setState] = useState<GenerationState>({ phase: 'idle' })
  const busy = state.phase === 'photos' || state.phase === 'pdf'

  // El PDF se arma recién al hacer clic: primero se descargan y reducen las
  // fotos (con reintentos), después se genera el archivo. Antes @react-pdf
  // bajaba todas las fotos a tamaño original apenas se abría la vista previa.
  async function download(data: PhotographicReportData, layout: ReportLayout, filename: string): Promise<boolean> {
    try {
      const urls = layoutPhotoUrls(layout)
      setState({ phase: 'photos', done: 0, total: urls.length })
      const images = await prepareReportImages(urls, {
        onProgress: (done, total) => setState({ phase: 'photos', done, total }),
      })
      setState({ phase: 'pdf' })
      const { pdf } = await import('@react-pdf/renderer')
      const blob = await pdf(<PhotographicReportDocument data={data} layout={layout} images={images} />).toBlob()
      triggerDownload(blob, filename)
      const missing = [...images.values()].filter((v) => v === null).length
      setState({ phase: 'done', missing })
      return true
    } catch (err) {
      console.error('[reports] generar PDF falló:', err)
      setState({ phase: 'error', message: 'No se pudo generar el PDF. Intenta de nuevo.' })
      return false
    }
  }

  return { state, busy, download }
}

export function DownloadButtonLabel({ state, idleLabel }: { state: GenerationState; idleLabel: string }) {
  if (state.phase === 'photos') {
    return (
      <>
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparando fotos {state.done} de {state.total}…
      </>
    )
  }
  if (state.phase === 'pdf') {
    return (
      <>
        <Loader2 className="h-4 w-4 animate-spin" />
        Generando PDF…
      </>
    )
  }
  return (
    <>
      <Download className="h-4 w-4" />
      {idleLabel}
    </>
  )
}

export function DownloadMessages({ state }: { state: GenerationState }) {
  if (state.phase === 'done' && state.missing > 0) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        {state.missing} foto{state.missing !== 1 ? 's' : ''} no se pudo descargar y sale como
        “Foto no disponible” en el PDF. Vuelve a generarlo para reintentar.
      </p>
    )
  }
  if (state.phase === 'error') {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.message}</p>
    )
  }
  return null
}
