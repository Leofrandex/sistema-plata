import { useEffect, useState } from 'react'

/**
 * Devuelve el tiempo transcurrido (en segundos) desde `startedAt` hasta ahora,
 * actualizándose cada segundo. Si `startedAt` es null/undefined, devuelve 0.
 *
 * Útil para mostrar cronómetros que persisten entre cierres de la app: solo se
 * guarda `started_at` en IndexedDB; al volver, este hook lo lee y reanuda
 * visualmente como si nunca se hubiera cerrado.
 */
export function useElapsed(startedAt: string | null | undefined): number {
  const [seconds, setSeconds] = useState(() => computeElapsed(startedAt))

  useEffect(() => {
    if (!startedAt) {
      setSeconds(0)
      return
    }
    setSeconds(computeElapsed(startedAt))
    const interval = setInterval(() => {
      setSeconds(computeElapsed(startedAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return seconds
}

function computeElapsed(startedAt: string | null | undefined): number {
  if (!startedAt) return 0
  const start = new Date(startedAt).getTime()
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / 1000))
}

/**
 * Formato HH:MM:SS para mostrar cronómetros largos. Si la duración es menor a
 * 1 hora, omite las horas (MM:SS).
 */
export function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) {
    const hh = String(hours).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }
  return `${mm}:${ss}`
}
