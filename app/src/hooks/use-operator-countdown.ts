'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@hospiwaste/shared/lib/store'
import { getLoginAt, computeSessionState } from '@hospiwaste/shared/lib/session-timeout'

export interface OperatorCountdown {
  active: boolean
  remainingMs: number
  isWarning: boolean
  isExpired: boolean
}

const INACTIVE: OperatorCountdown = {
  active: false,
  remainingMs: 0,
  isWarning: false,
  isExpired: false,
}

/**
 * Cuenta regresiva de la sesión de operador (solo lectura). Devuelve `active:false`
 * para coordinadores o cuando no hay `login_at`. No escribe storage ni cierra
 * sesión — de eso se encarga OperatorSessionGuard.
 */
export function useOperatorCountdown(): OperatorCountdown {
  const role = useStore((s) => s.currentRole)
  const [state, setState] = useState<OperatorCountdown>(INACTIVE)

  useEffect(() => {
    if (role !== 'operator') {
      setState(INACTIVE)
      return
    }
    function tick() {
      const loginAt = getLoginAt()
      if (loginAt === null) {
        setState(INACTIVE)
        return
      }
      const s = computeSessionState(loginAt, Date.now())
      setState({ active: true, ...s })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [role])

  return state
}
