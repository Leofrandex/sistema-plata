import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { WeighingHistory } from '@/components/history/weighing-history'

export default function WeighingHistoryPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <Link
          href="/register/weighing"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Historial de pesajes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sesiones de pesaje registradas. El coordinador puede editar campos o anular.
        </p>
      </div>
      <WeighingHistory />
    </div>
  )
}
