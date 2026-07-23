'use client'

import { useEffect, useState, useCallback } from 'react'
import { getLocalStore, type PendingCounts } from '@hospiwaste/shared/lib/local-store'
import { flush } from '@hospiwaste/shared/lib/local-store/sync-engine'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'

const ZERO: PendingCounts = { records: 0, photos: 0, rejected: 0 }

export function useOfflineSync() {
  const [counts, setCounts] = useState<PendingCounts>(ZERO)
  const [isOnline, setIsOnline] = useState(true)

  const refreshCounts = useCallback(async () => {
    setCounts(await (await getLocalStore()).pendingCounts())
  }, [])

  const sync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    try {
      await flush(createClient(), await getLocalStore())
    } catch (err) {
      console.error('[offline-sync] flush falló:', err)
    }
    await refreshCounts()
  }, [refreshCounts])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshCounts()
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
  }, [sync, refreshCounts])

  return { isOnline, counts, refreshCounts }
}
