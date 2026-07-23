'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import { isSessionExpired } from '@hospiwaste/shared/lib/supabase/preferences-storage'

/**
 * En el APK (Capacitor):
 * - drena el outbox al volver la app a primer plano disparando el evento que
 *   ya escucha `use-offline-sync`.
 * - chequea la expiración por inactividad de 1h (Preferences) al arrancar y
 *   cada vez que vuelve a foreground; si expiró, cierra sesión y manda a
 *   /login. La sesión ya no muere al cerrar la app — persiste en Preferences
 *   bounded solo por esta regla.
 * En web es no-op.
 */
export function AppLifecycle() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    let removeListener: (() => void) | undefined

    async function checkExpiry() {
      if (await isSessionExpired()) {
        await createClient().auth.signOut()
        router.replace('/login')
      }
    }

    Promise.all([import('@capacitor/core'), import('@capacitor/app')])
      .then(([{ Capacitor }, { App }]) => {
        if (cancelled || !Capacitor.isNativePlatform()) return
        checkExpiry()
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            window.dispatchEvent(new Event('hospiwaste:outbox-changed'))
            checkExpiry()
          }
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
  }, [router])
  return null
}
