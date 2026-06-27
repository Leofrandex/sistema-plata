'use client'

import { useEffect } from 'react'

/**
 * En el APK (Capacitor), drena el outbox al volver la app a primer plano
 * disparando el evento que ya escucha `use-offline-sync`. En web es no-op.
 */
export function AppLifecycle() {
  useEffect(() => {
    let cleanup: (() => void) | undefined
    Promise.all([import('@capacitor/core'), import('@capacitor/app')])
      .then(([{ Capacitor }, { App }]) => {
        if (!Capacitor.isNativePlatform()) return
        const handle = App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) window.dispatchEvent(new Event('hospiwaste:outbox-changed'))
        })
        cleanup = () => { handle.then((h) => h.remove()) }
      })
      .catch(() => { /* @capacitor no disponible (web): no-op */ })
    return () => cleanup?.()
  }, [])
  return null
}
