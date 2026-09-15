'use client'

import { useEffect, useState, useCallback } from 'react'
import { getLocalStore, type PendingCounts } from '@hospiwaste/shared/lib/local-store'
import { flush } from '@hospiwaste/shared/lib/local-store/sync-engine'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import { getConnected, onConnectivityChange } from '@hospiwaste/shared/lib/net-status'

const ZERO: PendingCounts = { records: 0, photos: 0, rejected: 0 }

export function useOfflineSync() {
  const [counts, setCounts] = useState<PendingCounts>(ZERO)
  const [isOnline, setIsOnline] = useState(true)

  const refreshCounts = useCallback(async () => {
    setCounts(await (await getLocalStore()).pendingCounts())
  }, [])

  const sync = useCallback(async () => {
    // Sin compuerta de conectividad: en Android el plugin solo reporta
    // "conectado" si el sistema VALIDÓ la red (chequeo contra servidores de
    // Google), y una red con DNS defectuoso o portal cautivo queda "sin
    // validar" aunque nuestro servidor responda. Gatear acá dejaba la cola
    // sin subir nunca en esas redes. El motor ya trata el fallo de red como
    // "abortar y reintentar en el próximo disparo", así que intentar es barato.
    try {
      await flush(createClient(), await getLocalStore())
    } catch (err) {
      console.error('[offline-sync] flush falló:', err)
    }
    await refreshCounts()
  }, [refreshCounts])

  useEffect(() => {
    let cancelled = false
    let offConnectivity: (() => void) | undefined

    // Estado inicial y suscripción: en el APK vía @capacitor/network, en web vía
    // eventos online/offline. Ambos caminos detrás del mismo contrato.
    // La señal del plugin alimenta el indicador; el intento de subida va
    // aparte y siempre (ver comentario en `sync`).
    getConnected().then((c) => { if (!cancelled) setIsOnline(c) })
    sync()
    onConnectivityChange((connected) => {
      if (cancelled) return
      setIsOnline(connected)
      if (connected) sync()
    }).then((off) => {
      if (cancelled) off()
      else offConnectivity = off
    })

    refreshCounts()

    function onVisible() { if (document.visibilityState === 'visible') sync() }
    function onChanged() { sync() }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('hospiwaste:outbox-changed', onChanged)
    const interval = setInterval(sync, 30_000)

    return () => {
      cancelled = true
      offConnectivity?.()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('hospiwaste:outbox-changed', onChanged)
      clearInterval(interval)
    }
  }, [sync, refreshCounts])

  return { isOnline, counts, refreshCounts }
}
