'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { PenLine, X, Eraser, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  /** Data URL de la firma nueva (aún no subida). */
  value: string | null
  /** Firma ya subida (modo edición). */
  existing?: { id: string; url: string } | null
  /** Se llama al confirmar una firma nueva (dataUrl) o al borrarla (null). */
  onChange: (dataUrl: string | null) => void
  /** Quita la firma ya subida para permitir re-firmar. */
  onRemoveExisting?: () => void
  disabled?: boolean
}

export function SignaturePad({ value, existing, onChange, onRemoveExisting, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const preview = value ?? existing?.url ?? null
  const hasSignature = !!preview

  return (
    <section className="space-y-2">
      <header>
        <h2 className="text-sm font-semibold text-foreground">
          Firma del recorrido <span className="text-red-500">*</span>
        </h2>
        <p className="text-xs text-muted-foreground">Tocá el recuadro para firmar. Cada registro lleva su propia firma.</p>
      </header>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label="Abrir panel de firma"
        className={cn(
          'w-full rounded-lg border-2 border-dashed transition-colors',
          'flex items-center justify-center text-muted-foreground',
          hasSignature ? 'border-accent/40 bg-card p-2' : 'h-28 border-border bg-muted/30 hover:bg-muted/50',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {preview ? (
          <div className="relative h-24 w-full">
            <Image src={preview} alt="Firma" fill className="object-contain" sizes="100vw" unoptimized />
          </div>
        ) : (
          <span className="flex items-center gap-2 text-sm">
            <PenLine className="h-4 w-4" /> Tocá para firmar
          </span>
        )}
      </button>

      {hasSignature && !disabled && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => {
              if (value) onChange(null)
              else onRemoveExisting?.()
            }}
          >
            Borrar firma
          </Button>
        </div>
      )}

      {open && (
        <SignatureOverlay
          onCancel={() => setOpen(false)}
          onConfirm={(dataUrl) => {
            onChange(dataUrl)
            if (existing) onRemoveExisting?.()
            setOpen(false)
          }}
        />
      )}
    </section>
  )
}

function SignatureOverlay({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: (dataUrl: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  // Ajusta el tamaño físico del canvas al de su contenedor (nitidez en DPR alto).
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
  }, [])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    dirty.current = true
    if (!hasInk) setHasInk(true)
  }

  function end() {
    drawing.current = false
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    // ctx ya está escalado por DPR, así que limpiamos en coordenadas CSS.
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    dirty.current = false
    setHasInk(false)
  }

  function confirm() {
    const canvas = canvasRef.current
    if (!canvas || !dirty.current) return
    onConfirm(canvas.toDataURL('image/png'))
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-slate-900 p-4">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-white">
          <h2 className="text-base font-semibold">Firmá en el recuadro</h2>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cerrar" className="text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          className="w-full flex-1 touch-none rounded-xl bg-white"
        />
        <div className="flex gap-3">
          <Button variant="outline" onClick={clear} className="flex-1 gap-2">
            <Eraser className="h-4 w-4" /> Borrar
          </Button>
          <Button onClick={confirm} disabled={!hasInk} className="flex-1 gap-2">
            <Check className="h-4 w-4" /> Listo
          </Button>
        </div>
      </div>
    </div>
  )
}
