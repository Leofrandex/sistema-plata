'use client'

import { useEffect } from 'react'

/**
 * Desregistra cualquier service worker residual (de una sesión anterior de
 * producción o de una versión previa) y limpia las caches en todos los entornos.
 *
 * Cuando next-pwa se desactiva, los clientes que ya tienen un SW registrado en
 * el mismo origen siguen sirviendo JS cacheado viejo hasta que se desregistra
 * explícitamente. Esto ocurre tanto en dev como en producción. Ejecutar
 * unconditionally aquí es seguro: unregister() en un SW inexistente es un no-op.
 */
export function SWCleanup() {
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) {
        // eslint-disable-next-line no-console
        console.info('Desregistrando service worker residual:', r.scope)
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
