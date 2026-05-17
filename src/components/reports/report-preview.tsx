'use client'

import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import type { Batch, Client, Container, ContainerReception, Photo } from '@/lib/types'
import { APP_NAME } from '@/lib/constants'
import { BatchReportDocument } from './batch-report-document'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => <Button disabled><Loader2 className="h-4 w-4 animate-spin mr-2" />Preparando...</Button> }
)

interface ContainerReportData {
  container: Container
  reception: ContainerReception | null
  exchangePhotos: Photo[]
  weighingPhotos: Photo[]
  storagePhotos: Photo[]
}

interface Props {
  batch: Batch
  client: Client
  containerData: ContainerReportData[]
}

export function ReportPreview({ batch, client, containerData }: Props) {
  const filename = `${APP_NAME}_${client.name.replace(/\s+/g, '_')}_${batch.date}.pdf`

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-slate-50 p-4 space-y-2">
        <p className="text-sm font-medium text-slate-700">Resumen del reporte</p>
        <p className="text-sm text-slate-500">Cliente: <strong>{client.name}</strong></p>
        <p className="text-sm text-slate-500">Fecha: <strong>{batch.date}</strong></p>
        <p className="text-sm text-slate-500">Envases: <strong>{containerData.length}</strong></p>
        <p className="text-sm text-slate-500">Páginas estimadas: <strong>{containerData.length + 2}</strong> (portada + {containerData.length} envases + resumen)</p>
      </div>
      <PDFDownloadLink
        document={
          <BatchReportDocument batch={batch} client={client} containerData={containerData} />
        }
        fileName={filename}
      >
        {({ loading }) => (
          <Button className="w-full gap-2" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Generando PDF...</>
            ) : (
              <><Download className="h-4 w-4" />Descargar reporte</>
            )}
          </Button>
        )}
      </PDFDownloadLink>
    </div>
  )
}
