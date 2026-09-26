'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, X } from 'lucide-react'

/**
 * Cámara dentro del APK (getUserMedia), a pantalla completa.
 *
 * Por qué existe: la cámara del sistema (@capacitor/camera) abre otra app y el
 * APK queda en segundo plano; en los teléfonos de planta Android lo cierra por
 * memoria y el operador vuelve al Home (2026-09-25, siguió pasando con v1.9).
 * Con la cámara dentro de la app, el APK nunca sale de primer plano.
 *
 * Si getUserMedia no existe o falla (permiso negado, cámara ocupada),
 * `onUnavailable` avisa y el llamador cae a la cámara del sistema.
 */

/** Lado mayor de la foto: el mismo tope que photo-watermark (1280 px). */
const MAX_SIDE = 1280

export function captureSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

interface Props {
  /** JPEG como data URL, sin sello: el llamador lo sella con watermarkPhoto. */
  onCapture: (dataUrl: string) => void
  onCancel: () => void
  onUnavailable: (err: unknown) => void
}

export function InAppCamera({ onCapture, onCancel, onUnavailable }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    let cancelled = false
    async function open() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia no disponible')
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
        }
        if (!cancelled) setReady(true)
      } catch (err) {
        if (!cancelled) onUnavailable(err)
      }
    }
    void open()
    return () => {
      cancelled = true
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCapture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const { width, height } = captureSize(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    stop()
    onCapture(dataUrl)
  }

  function handleCancel() {
    stop()
    onCancel()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-contain" playsInline muted />
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Abriendo cámara…</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleCancel}
          className="flex h-12 items-center gap-2 rounded-full px-4 text-white/90"
        >
          <X className="h-5 w-5" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleCapture}
          disabled={!ready}
          aria-label="Capturar"
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white disabled:opacity-40"
        >
          <Camera className="h-7 w-7" />
        </button>
        <span className="w-[88px]" aria-hidden />
      </div>
    </div>
  )
}
