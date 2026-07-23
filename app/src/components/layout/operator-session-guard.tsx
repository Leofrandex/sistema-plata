'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useStore } from '@hospiwaste/shared/lib/store'
import { useOperatorCountdown } from '@/hooks/use-operator-countdown'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import { clearLoginAt, getLoginAt, formatRemaining, registerActivity } from '@hospiwaste/shared/lib/session-timeout'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { clearCredentialsIfDrained } from '@/lib/native-sync'

/**
 * Cierra la sesión de los operadores 1 h después del login (timeout absoluto) y
 * avisa en los últimos 5 min. Coordinadores no expiran. Es el único dueño de los
 * efectos sobre `login_at` y del signOut. Montado una vez en el layout.
 */
export function OperatorSessionGuard() {
  const router = useRouter()
  const role = useStore((s) => s.currentRole)
  const { active, isWarning, isExpired, remainingMs } = useOperatorCountdown()
  const signingOut = useRef(false)

  const doSignOut = useCallback(async () => {
    if (signingOut.current) return
    signingOut.current = true
    const counts = await (await getLocalStore()).pendingCounts()
    const pending = counts.records + counts.photos
    // Con cola pendiente en el APK: scope local, para que el drain nativo
    // conserve viva la familia de tokens del lado del server (I1).
    const local = Capacitor.isNativePlatform() && pending > 0
    try {
      await createClient().auth.signOut(local ? { scope: 'local' } : undefined)
    } catch {
      // Sin red: igual limpiamos el estado local y seguimos.
    }
    clearLoginAt()
    try {
      await clearCredentialsIfDrained(pending)
    } catch (err) {
      console.error('clearCredentialsIfDrained falló', err)
    }
    router.replace('/login')
  }, [router])

  // Validez del ancla según el rol. NO re-ancla (eso reiniciaría el corte
  // absoluto en cada recarga, porque currentRole arranca en null y se resuelve
  // async). El login real ya setea login_at; aquí solo validamos/limpiamos.
  useEffect(() => {
    if (role === 'operator') {
      if (getLoginAt() === null) doSignOut() // operador sin ancla = sesión inválida
    } else if (role !== null) {
      clearLoginAt() // coordinador resuelto: no expira, sin ancla residual
    }
    // role === null (aún sin resolver): no hacer nada, preservar login_at
  }, [role, doSignOut])

  // Corte firme al expirar.
  useEffect(() => {
    if (active && isExpired) doSignOut()
  }, [active, isExpired, doSignOut])

  // Cada interacción del usuario actualiza el ancla de inactividad del APK
  // (throttleada dentro de registerActivity). No depende del rol: es barato y
  // el chequeo de expiración por inactividad solo se usa en nativo de todos modos.
  useEffect(() => {
    const handler = () => registerActivity()
    window.addEventListener('pointerdown', handler)
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [])

  if (!active || !isWarning) return null

  return (
    <div className="fixed top-2 inset-x-2 z-50 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 shadow-md">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      Tu sesión se cerrará en {formatRemaining(remainingMs)}.
    </div>
  )
}
