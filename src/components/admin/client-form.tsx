'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Client } from '@/lib/types'

interface Props {
  onSubmit: (data: Omit<Client, 'id' | 'locations'>) => void
  onCancel: () => void
}

export function ClientForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState('')
  const [codeLetter, setCodeLetter] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !codeLetter.trim()) return
    onSubmit({ name: name.trim(), code_letter: codeLetter.trim().toUpperCase() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Nombre del cliente</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Hospital Nacional" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Letra de prefijo</label>
        <Input
          value={codeLetter}
          onChange={(e) => setCodeLetter(e.target.value.slice(0, 1))}
          placeholder="Ej: D"
          maxLength={1}
          className="uppercase w-20"
          required
        />
        <p className="text-xs text-slate-500">
          Un solo carácter. Los envases se identificarán como {codeLetter.toUpperCase() || 'X'}-001, etc.
        </p>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" disabled={!name.trim() || !codeLetter.trim()} className="flex-1">Agregar cliente</Button>
      </div>
    </form>
  )
}
