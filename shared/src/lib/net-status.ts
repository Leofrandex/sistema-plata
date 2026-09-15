'use client'

/**
 * Estado de conectividad para el indicador de sync.
 *
 * En el APK **no** se usa `navigator.onLine`: en un WebView de Android reporta
 * el estado de la interfaz, no si hay internet, y da falsos negativos en las
 * transiciones de red — de ahí el "Sin conexión" con WiFi funcionando. La
 * fuente de verdad en nativo es `@capacitor/network`, que era justamente para
 * lo que se instaló (ver `docs/superpowers/specs/2026-06-23-apk-capacitor-design.md`).
 * En web se mantiene `navigator.onLine`, que ahí sí es la señal correcta.
 *
 * Ojo con el patrón de import: los objetos de plugin de Capacitor son proxies
 * que responden a cualquier propiedad, `then` incluida, así que **nunca** se
 * devuelven pelados desde una función `async` — se envuelven. Ver el bug del
 * 2026-08-24 en `shared/src/lib/supabase/preferences-storage.ts`.
 */

async function networkPlugin() {
  const { Network } = await import('@capacitor/network')
  return { p: Network }
}

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

function browserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

/** ¿Hay conectividad ahora? Plugin nativo en el APK, `navigator.onLine` en web. */
export async function getConnected(): Promise<boolean> {
  if (await isNative()) {
    try {
      const { p } = await networkPlugin()
      return (await p.getStatus()).connected
    } catch {
      // Plugin no disponible: mejor el dato imperfecto que ninguno.
    }
  }
  return browserOnline()
}

/**
 * Suscribe a los cambios de conectividad. Devuelve la función para desuscribir.
 * El callback recibe el estado nuevo, no el evento.
 */
export async function onConnectivityChange(
  cb: (connected: boolean) => void,
): Promise<() => void> {
  if (await isNative()) {
    try {
      const { p } = await networkPlugin()
      const handle = await p.addListener('networkStatusChange', (s: { connected: boolean }) =>
        cb(s.connected))
      return () => { void handle.remove() }
    } catch {
      // cae al fallback web
    }
  }
  const on = () => cb(true)
  const off = () => cb(false)
  window.addEventListener('online', on)
  window.addEventListener('offline', off)
  return () => {
    window.removeEventListener('online', on)
    window.removeEventListener('offline', off)
  }
}

/**
 * Avisa **solo** cuando la red vuelve (transición desconectado → conectado).
 *
 * `onConnectivityChange` en Android reemite `connected: true` en cada
 * `onCapabilitiesChanged` del sistema (cambios de ancho de banda estimado,
 * de "medida"/"no medida", etc.), que en celular pasan seguido. Quien
 * reaccione a cada uno con una re-hidratación completa (once consultas y
 * firmado de URLs) monta una tormenta que se pisa a sí misma y, con señal
 * débil, nunca termina. Acá se guarda el último estado y se filtra.
 */
export async function onConnectivityRestored(cb: () => void): Promise<() => void> {
  let last: boolean | null = null
  return onConnectivityChange((connected) => {
    const wasDown = last === false
    last = connected
    if (connected && wasDown) cb()
  })
}
