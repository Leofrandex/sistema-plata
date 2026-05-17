'use client'

import { useEffect } from 'react'

/**
 * En desarrollo, desregistra cualquier service worker residual (de una sesión
 * anterior de producción o de una versión previa) y limpia las caches.
 *
 * next-pwa ya está configurado con `disable: process.env.NODE_ENV === 'development'`
 * para no registrar SW nuevos en dev, pero un SW que se registró antes en el
 * mismo origen sigue corriendo hasta que se desregistra explícitamente. Esto
 * causaba que la app sirviera JS viejo y las páginas quedaran cargando hasta
 * forzar refresh con cache limpio.
 */
export function SWCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (typeof navigator === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) {
        // eslint-disable-next-line no-console
        console.info('[dev] Desregistrando service worker residual:', r.scope)
        r.unregister()
      }
    }).catch(() => {
      /* noop */
    })

    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const k of keys) caches.delete(k)
      }).catch(() => {
        /* noop */
      })
    }
  }, [])

  return null
}
