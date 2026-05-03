'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Camera, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  label: string
  required?: boolean
  onCapture: (dataUrl: string) => void
  onRemove: () => void
  preview: string | null
}

export function PhotoCapture({ label, required, onCapture, onRemove, preview }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onCapture(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {preview ? (
        <div className="relative">
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden border bg-slate-100">
            <Image src={preview} alt="Foto capturada" fill className="object-cover" sizes="100vw" />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={() => {
              onRemove()
              if (inputRef.current) inputRef.current.value = ''
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full aspect-[4/3] rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-500 transition-colors"
        >
          <Camera className="h-8 w-8" />
          <span className="text-sm">Tomar foto</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
