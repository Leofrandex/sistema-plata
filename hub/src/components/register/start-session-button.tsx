'use client'

import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@hospiwaste/shared/components/ui/button'

/**
 * Pide al SupabaseHydrator que reintente cargar la sesión/datos. El hydrator
 * escucha este evento (ver `supabase-hydrator.tsx`).
 */
export function requestHydrationRetry() {
  window.dispatchEvent(new Event('hospiwaste:retry-hydration'))
}

interface Props {
  /** ¿Ya se cargó el profile del operador (currentProfileId)? */
  sessionReady: boolean
  onStart: () => void
  /** Otras condiciones del formulario que deshabilitan el inicio. */
  disabled?: boolean
  children: ReactNode
  icon?: ReactNode
}

/**
 * Botón para iniciar una sesión (recorrido / pesaje). Mientras la sesión del
 * operador no se haya hidratado (`currentProfileId === null`), NO renderiza un
 * botón "Iniciar" tappable —que antes lanzaba un alert sin salida— sino un
 * estado de carga con opción de reintentar la hidratación. Así se cierra la
 * carrera en la que el operador tocaba "Iniciar" antes de que cargara su sesión.
 */
export function StartSessionButton({ sessionReady, onStart, disabled, children, icon }: Props) {
  if (!sessionReady) {
    return (
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <Button disabled className="gap-2" aria-live="polite">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Cargando tu sesión…
        </Button>
        <button
          type="button"
          onClick={requestHydrationRetry}
          className="text-xs underline text-muted-foreground hover:text-foreground"
        >
          ¿Tarda demasiado? Reintentar
        </button>
      </div>
    )
  }

  return (
    <Button onClick={onStart} disabled={disabled} className="gap-2 shrink-0">
      {icon}
      {children}
    </Button>
  )
}
