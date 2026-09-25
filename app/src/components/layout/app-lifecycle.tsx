'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import { isSessionExpired } from '@hospiwaste/shared/lib/supabase/preferences-storage'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { signOut } from '@hospiwaste/shared/lib/auth/sign-out'
import { clearCredentialsIfDrained, getNativeCredentials, handOffCredentials, kickNativeSync } from '@/lib/native-sync'
import { watermarkPhoto } from '@hospiwaste/shared/lib/photo-watermark'
import {
  DRAFT_RESTORED_EVENT,
  applyRestoredPhoto,
  isDraftFresh,
  loadDraft,
  saveDraft,
} from '@/lib/weighing-draft'

const WEIGHING_ROUTE = '/register/weighing'

/**
 * Android mató la app mientras la cámara estaba abierta y la reabrió en el
 * Home. Si hay un pesaje a medio llenar, vuelve a Pesaje: la página restaura
 * el borrador (ver lib/weighing-draft).
 */
async function resumeInterruptedWeighing(goTo: (path: string) => void) {
  const draft = await loadDraft()
  if (!isDraftFresh(draft, Date.now())) return
  const path = window.location.pathname.replace(/\/index\.html$/, '/')
  if (path === '/') goTo(WEIGHING_ROUTE)
}

interface RestoredResult {
  pluginId: string
  methodName: string
  success: boolean
  data?: { dataUrl?: string }
}

/**
 * Android entrega la foto que la cámara sacó mientras la app estaba muerta.
 * Se sella, se coloca en el hueco que se estaba fotografiando y se avisa a Pesaje.
 */
async function recoverCameraPhoto(result: RestoredResult, goTo: (path: string) => void) {
  if (result.pluginId !== 'Camera' || result.methodName !== 'getPhoto') return
  if (!result.success || !result.data?.dataUrl) return
  const draft = await loadDraft()
  if (!draft || !draft.cameraSlot || !isDraftFresh(draft, Date.now())) return
  const stamped = await watermarkPhoto(result.data.dataUrl, new Date())
  await saveDraft(applyRestoredPhoto(draft, stamped, Date.now()))
  window.dispatchEvent(new Event(DRAFT_RESTORED_EVENT))
  goTo(WEIGHING_ROUTE)
}

/**
 * En el APK (Capacitor):
 * - drena el outbox al volver la app a primer plano disparando el evento que
 *   ya escucha `use-offline-sync`.
 * - chequea la expiración por inactividad de 1h (Preferences) al arrancar y
 *   cada vez que vuelve a foreground; si expiró, cierra sesión y manda a
 *   /login. La sesión ya no muere al cerrar la app — persiste en Preferences
 *   bounded solo por esta regla.
 * - al volver a foreground, si el motor nativo rotó el refresh token en
 *   background (rotatedAt > 0), re-adopta esa sesión con refreshSession():
 *   el éxito dispara TOKEN_REFRESHED, que re-entrega el token al plugin y
 *   resetea rotatedAt (C1). Sin esto, el RT que guarda el WebView queda de
 *   una familia vieja y el próximo refresh JS forzaría un logout a mitad de
 *   turno.
 * - si Android mató la app con la cámara abierta, vuelve a Pesaje y recupera
 *   la foto pendiente (`appRestoredResult`); el formulario lo restaura la página.
 * - re-entrega el refresh token al plugin nativo cuando Supabase lo rota
 *   (TOKEN_REFRESHED). El handoff inicial del login lo hace /login (C1: no
 *   escuchar SIGNED_IN acá evita handoffs duplicados que pisen un token ya
 *   rotado por el nativo).
 * En web es no-op.
 */
export function AppLifecycle() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const removers: Array<() => void> = []
    let removeAuthListener: (() => void) | undefined

    async function checkExpiry() {
      if (await isSessionExpired()) {
        const counts = await (await getLocalStore()).pendingCounts()
        const pending = counts.records + counts.photos
        // Con cola pendiente: scope local para no matar la familia de tokens
        // del lado del server — el drain nativo la sigue necesitando (I1).
        await signOut(pending > 0 ? { scope: 'local' } : {})
        try {
          await clearCredentialsIfDrained(pending)
        } catch (err) {
          console.error('clearCredentialsIfDrained falló', err)
        }
        router.replace('/login')
      }
    }

    /**
     * Si el motor nativo rotó el refresh token en background, re-adopta esa
     * sesión en el cliente JS (C1). En fallo solo loguea: el operador podrá
     * necesitar re-login, pero no crasheamos el foreground.
     * Solo re-adopta si ya hay una sesión JS activa: tras un logout con cola
     * pendiente (signOut scope 'local' conserva las credenciales nativas
     * para el drain), no revivir la sesión de quien cerró sesión si otra
     * persona toma el teléfono compartido y la app vuelve a foreground.
     */
    async function adoptNativeRotation() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        if (!session) return
        const creds = await getNativeCredentials()
        if (creds?.hasCredentials && creds.rotatedAt > 0 && creds.refreshToken) {
          await createClient().auth.refreshSession({ refresh_token: creds.refreshToken })
          // Éxito → TOKEN_REFRESHED → handOffCredentials resetea rotatedAt a 0.
        }
      } catch (err) {
        console.error('re-adopción del token nativo falló', err)
      }
    }

    Promise.all([import('@capacitor/core'), import('@capacitor/app')])
      .then(([{ Capacitor }, { App }]) => {
        if (cancelled || !Capacitor.isNativePlatform()) return
        checkExpiry()
        const goTo = (path: string) => { if (!cancelled) router.replace(path) }
        resumeInterruptedWeighing(goTo).catch((err) =>
          console.error('[lifecycle] retomar pesaje falló', err))
        App.addListener('appRestoredResult', (result) => {
          recoverCameraPhoto(result as RestoredResult, goTo).catch((err) =>
            console.error('[lifecycle] recuperar foto falló', err))
        }).then((h) => {
          if (cancelled) h.remove()
          else removers.push(() => h.remove())
        })
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            adoptNativeRotation()
            window.dispatchEvent(new Event('hospiwaste:outbox-changed'))
            checkExpiry()
          } else {
            kickNativeSync()
          }
        }).then((h) => {
          if (cancelled) h.remove()
          else removers.push(() => h.remove())
        })

        const { data: sub } = createClient().auth.onAuthStateChange((event, session) => {
          if (event === 'TOKEN_REFRESHED' && session) {
            handOffCredentials(session.refresh_token).catch((err) =>
              console.error('handOffCredentials falló', err))
          }
        })
        if (cancelled) sub.subscription.unsubscribe()
        else removeAuthListener = () => sub.subscription.unsubscribe()
      })
      .catch(() => { /* @capacitor no disponible (web): no-op */ })
    return () => {
      cancelled = true
      removers.forEach((r) => r())
      removeAuthListener?.()
    }
  }, [router])
  return null
}
