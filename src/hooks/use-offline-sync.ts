'use client'

import { useEffect, useState, useCallback } from 'react'
import { getQueueCount, dequeueAll, clearAll } from '@/lib/offline-queue'

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)

  async function refreshCount() {
    const count = await getQueueCount()
    setPendingCount(count)
  }

  const sync = useCallback(async () => {
    const items = await dequeueAll()
    if (items.length > 0) {
      console.log('[offline-sync] Flushing', items.length, 'queued events (mock mode — no server)')
      await clearAll()
      setPendingCount(0)
    }
  }, [])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshCount()

    function handleOnline() {
      setIsOnline(true)
      sync()
    }

    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [sync])

  return { isOnline, pendingCount, refreshCount }
}
