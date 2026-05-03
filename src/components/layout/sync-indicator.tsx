'use client'

import { useOfflineSync } from '@/hooks/use-offline-sync'
import { WifiOff, RefreshCw } from 'lucide-react'

export function SyncIndicator() {
  const { isOnline, pendingCount } = useOfflineSync()

  if (isOnline && pendingCount === 0) return null

  return (
    <div
      className={`fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium shadow-lg z-50 ${
        isOnline ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {isOnline ? (
        <><RefreshCw className="h-4 w-4 animate-spin" />{pendingCount} evento{pendingCount !== 1 ? 's' : ''} sincronizando...</>
      ) : (
        <><WifiOff className="h-4 w-4" />Sin conexión · {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</>
      )}
    </div>
  )
}
