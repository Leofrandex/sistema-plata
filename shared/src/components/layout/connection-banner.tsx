'use client'

import { useState } from 'react'
import Link from 'next/link'
import { WifiOff, RefreshCw } from 'lucide-react'
import { useStore } from '@hospiwaste/shared/lib/store'

interface ConnectionBannerProps {
  /** Ruta de la pantalla de diagnóstico (solo la app de campo la tiene). Si se
   *  pasa, el banner enlaza a ella para que el operador pueda mandar una
   *  captura con la causa real en vez de "sin conexión" a secas. */
  detailHref?: string
}

/**
 * Banner de aviso cuando la app no logró traer datos de Supabase. En ese caso
 * la UI puede estar mostrando datos de ejemplo (mock) y las acciones que
 * requieren sesión (iniciar recorrido/pesaje) no funcionarán. Ofrece reintentar.
 *
 * Muestra además la causa técnica (`connectionError`): un DNS que no resuelve,
 * un certificado rechazado o un plugin nativo caído se ven igual desde afuera
 * y se arreglan de formas completamente distintas.
 */
export function ConnectionBanner({ detailHref }: ConnectionBannerProps) {
  const connectionStatus = useStore((s) => s.connectionStatus)
  const connectionError = useStore((s) => s.connectionError)
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
    <div className="bg-amber-500 text-amber-950">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-1.5 text-xs">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">Sin conexión con el servidor</p>
          {connectionError && (
            <p className="truncate text-[11px] opacity-80" title={connectionError}>{connectionError}</p>
          )}
        </div>
        {/* Link (navegación en cliente), nunca <a href>: en el export estático
            del APK un enlace duro recarga el WebView entero y reinicia la app. */}
        {detailHref && (
          <Link href={detailHref} className="shrink-0 rounded-md bg-amber-950/10 px-2 py-1 font-semibold hover:bg-amber-950/20">
            Diagnóstico
          </Link>
        )}
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
