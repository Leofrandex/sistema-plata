'use client'

import { useEffect } from 'react'

/**
 * Carga eruda (consola embebida) solo cuando se pide explícitamente, para
 * depurar en el teléfono en campo sin cable. Activación:
 *   - URL con `?debug=1`  → persiste la flag y abre la consola
 *   - localStorage['hw-debug'] === '1'
 * Desactivar: `?debug=0` o borrar la clave.
 */
export function ErudaLoader() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const param = params.get('debug')
    if (param === '1') localStorage.setItem('hw-debug', '1')
    if (param === '0') localStorage.removeItem('hw-debug')
    if (localStorage.getItem('hw-debug') !== '1') return
    let cancelled = false
    import('eruda').then((mod) => {
      if (!cancelled) mod.default.init()
    })
    return () => { cancelled = true }
  }, [])
  return null
}
