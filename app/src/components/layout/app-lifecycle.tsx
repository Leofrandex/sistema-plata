'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import { isSessionExpired } from '@hospiwaste/shared/lib/supabase/preferences-storage'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { clearCredentialsIfDrained, handOffCredentials, kickNativeSync } from '@/lib/native-sync'

/**
 * En el APK (Capacitor):
 * - drena el outbox al volver la app a primer plano disparando el evento que
 *   ya escucha `use-offline-sync`.
 * - chequea la expiración por inactividad de 1h (Preferences) al arrancar y
 *   cada vez que vuelve a foreground; si expiró, cierra sesión y manda a
 *   /login. La sesión ya no muere al cerrar la app — persiste en Preferences
 *   bounded solo por esta regla.
 * - re-entrega el refresh token al plugin nativo cuando Supabase lo rota
 *   (TOKEN_REFRESHED) o en un nuevo login fuera de /login (SIGNED_IN): el
 *   motor de sync nativo también rota el refresh token en cada drain, así
 *   que sin este listener el par WebView/nativo divergiría y el próximo
 *   login del lado JS pisaría un token ya viejo (M5).
 * En web es no-op.
 */
export function AppLifecycle() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    let removeListener: (() => void) | undefined
    let removeAuthListener: (() => void) | undefined

    async function checkExpiry() {
      if (await isSessionExpired()) {
        await createClient().auth.signOut()
        const counts = await (await getLocalStore()).pendingCounts()
        await clearCredentialsIfDrained(counts.records + counts.photos)
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
          } else {
            kickNativeSync()
          }
        }).then((h) => {
          if (cancelled) h.remove()
          else removeListener = () => h.remove()
        })

        const { data: sub } = createClient().auth.onAuthStateChange((event, session) => {
          if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && session) {
            handOffCredentials(session.refresh_token)
          }
        })
        if (cancelled) sub.subscription.unsubscribe()
        else removeAuthListener = () => sub.subscription.unsubscribe()
      })
      .catch(() => { /* @capacitor no disponible (web): no-op */ })
    return () => {
      cancelled = true
      removeListener?.()
      removeAuthListener?.()
    }
  }, [router])
  return null
}
