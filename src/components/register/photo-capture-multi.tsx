'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Camera, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  label: string
  required?: boolean
  disabled?: boolean
  photos: string[]
  onAdd: (dataUrl: string) => void
  onRemove: (index: number) => void
}

/**
 * Captura de N fotos en una grid. El operador puede agregar fotos ilimitadas;
 * cada una tiene su botón de eliminar.
 */
export function PhotoCaptureMulti({ label, required, disabled, photos, onAdd, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => onAdd(reader.result as string)
      reader.readAsDataURL(file)
    })
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {photos.length > 0 && (
          <span className="text-xs text-slate-500">
            {photos.length} foto{photos.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((url, idx) => (
          <div key={idx} className="relative">
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden border bg-slate-100">
              <Image
                src={url}
                alt={`Foto ${idx + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 33vw"
              />
            </div>
            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => onRemove(idx)}
                aria-label={`Eliminar foto ${idx + 1}`}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-[4/3] rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-500 transition-colors"
          >
            {photos.length === 0 ? (
              <>
                <Camera className="h-7 w-7" />
                <span className="text-xs">Tomar foto</span>
              </>
            ) : (
              <>
                <Plus className="h-6 w-6" />
                <span className="text-xs">Agregar</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
