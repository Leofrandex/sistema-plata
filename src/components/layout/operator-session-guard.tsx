'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useOperatorCountdown } from '@/hooks/use-operator-countdown'
import { createClient } from '@/lib/supabase/client'
import {
  setLoginAt,
  clearLoginAt,
  getLoginAt,
  formatRemaining,
} from '@/lib/session-timeout'

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

  // Ancla/limpia el login_at según el rol.
  useEffect(() => {
    if (role === 'operator') {
      if (getLoginAt() === null) setLoginAt() // edge: localStorage borrado a mitad de sesión
    } else {
      clearLoginAt() // coordinador o sin sesión → no expira
    }
  }, [role])

  // Corte firme al expirar.
  useEffect(() => {
    if (!active || !isExpired || signingOut.current) return
    signingOut.current = true
    ;(async () => {
      await createClient().auth.signOut()
      clearLoginAt()
      router.replace('/login')
      router.refresh()
    })()
  }, [active, isExpired, router])

  if (!active || !isWarning) return null

  return (
    <div className="fixed top-2 inset-x-2 z-50 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 shadow-md">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      Tu sesión se cerrará en {formatRemaining(remainingMs)}.
    </div>
  )
}
