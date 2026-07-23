'use client'

import { useOfflineSync } from '@/hooks/use-offline-sync'
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'

export function SyncIndicator() {
  const { isOnline, counts } = useOfflineSync()
  const { records, photos, rejected } = counts
  const pending = records + photos

  // El estado de error nunca se oculta: elementos rechazados requieren revisión manual.
  if (rejected === 0 && isOnline && pending === 0) return null

  if (rejected > 0) {
    return (
      <div className="fixed bottom-20 right-4 md:bottom-6 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium shadow-lg z-50 bg-destructive/10 text-destructive">
        <AlertTriangle className="h-4 w-4" />
        {rejected} elemento{rejected !== 1 ? 's' : ''} rechazado{rejected !== 1 ? 's' : ''} — revisar
      </div>
    )
  }

  const label =
    pending === 0
      ? 'Todo sincronizado'
      : `${records} registro${records !== 1 ? 's' : ''} y ${photos} foto${photos !== 1 ? 's' : ''} por sincronizar`

  return (
    <div
      className={`fixed bottom-20 right-4 md:bottom-6 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium shadow-lg z-50 ${
        isOnline ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {isOnline ? (
        <><RefreshCw className="h-4 w-4 animate-spin" />{label}</>
      ) : (
        <><WifiOff className="h-4 w-4" />Sin conexión · {label}</>
      )}
    </div>
  )
}
