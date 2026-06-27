'use client'

import { useEffect } from 'react'

/**
 * En el APK (Capacitor), drena el outbox al volver la app a primer plano
 * disparando el evento que ya escucha `use-offline-sync`. En web es no-op.
 */
export function AppLifecycle() {
  useEffect(() => {
    let cancelled = false
    let removeListener: (() => void) | undefined
    Promise.all([import('@capacitor/core'), import('@capacitor/app')])
      .then(([{ Capacitor }, { App }]) => {
        if (cancelled || !Capacitor.isNativePlatform()) return
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) window.dispatchEvent(new Event('hospiwaste:outbox-changed'))
        }).then((h) => {
          if (cancelled) h.remove()
          else removeListener = () => h.remove()
        })
      })
      .catch(() => { /* @capacitor no disponible (web): no-op */ })
    return () => {
      cancelled = true
      removeListener?.()
    }
  }, [])
  return null
}
