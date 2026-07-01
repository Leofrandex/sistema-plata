'use client'

import { useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { useStore } from '@/lib/store'

/**
 * Banner de aviso cuando la app no logró traer datos de Supabase. En ese caso
 * la UI puede estar mostrando datos de ejemplo (mock) y las acciones que
 * requieren sesión (iniciar recorrido/pesaje) no funcionarán. Ofrece reintentar.
 */
export function ConnectionBanner() {
  const connectionStatus = useStore((s) => s.connectionStatus)
  const [retrying, setRetrying] = useState(false)

  if (connectionStatus !== 'error') return null

  function handleRetry() {
    setRetrying(true)
    window.dispatchEvent(new Event('hospiwaste:retry-hydration'))
    // El estado vuelve a 'online'/'error' cuando termina la hidratación;
    // soltamos el spinner tras un momento para no dejarlo girando infinito.
    setTimeout(() => setRetrying(false), 3000)
  }

  return (
    <div className="sticky top-0 z-40 bg-amber-500 text-amber-950">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-1.5 text-xs">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <p className="flex-1 truncate font-medium">Sin conexión con el servidor</p>
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="flex shrink-0 items-center gap-1 rounded-md bg-amber-950/10 px-2 py-1 font-semibold hover:bg-amber-950/20 disabled:opacity-60"
        >
          <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
          Reintentar
        </button>
      </div>
    </div>
  )
}
