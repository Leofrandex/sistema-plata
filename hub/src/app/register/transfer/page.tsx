'use client'

import { Construction } from 'lucide-react'

export default function TransferPage() {
  return (
    <div className="max-w-md mx-auto py-16">
      <div className="flex flex-col items-center text-center space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-8">
        <Construction className="h-12 w-12 text-amber-500" />
        <h1 className="text-xl font-bold text-slate-800">Traslado externo</h1>
        <p className="text-sm text-amber-700">
          Sección en construcción. Esta funcionalidad aún no está disponible.
        </p>
      </div>
    </div>
  )
}
