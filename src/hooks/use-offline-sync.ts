'use client'

import { useEffect, useState, useCallback } from 'react'
import { countPendingOps } from '@/lib/offline-queue'
import { drainOutbox } from '@/lib/outbox-sync'
import { createClient } from '@/lib/supabase/client'

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)

  const refreshCount = useCallback(async () => {
    setPendingCount(await countPendingOps())
  }, [])

  const sync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    try {
      await drainOutbox(createClient())
    } catch (err) {
      // El drenado individual ya maneja sus errores; esto cubre fallos al abrir
      // el cliente. No es fatal: se reintenta en el próximo disparo.
      console.error('[offline-sync] drain falló:', err)
    }
    await refreshCount()
  }, [refreshCount])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshCount()
    if (navigator.onLine) sync()

    function handleOnline() { setIsOnline(true); sync() }
    function handleOffline() { setIsOnline(false) }
    function onVisible() { if (document.visibilityState === 'visible') sync() }
    function onChanged() { sync() }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('hospiwaste:outbox-changed', onChanged)
    const interval = setInterval(sync, 30_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('hospiwaste:outbox-changed', onChanged)
      clearInterval(interval)
    }
  }, [sync, refreshCount])

  return { isOnline, pendingCount, refreshCount }
}
