'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Client, Company } from '@/lib/types'

interface Props {
  clients: Client[]
  onSubmit: (data: Omit<Company, 'id'>) => void
  onCancel: () => void
}

export function CompanyForm({ clients, onSubmit, onCancel }: Props) {
  const [clientId, setClientId] = useState('')
  const [name, setName] = useState('')
  const [codeLetter, setCodeLetter] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !name.trim() || !codeLetter.trim()) return
    onSubmit({
      client_id: clientId,
      name: name.trim(),
      code_letter: codeLetter.trim().toUpperCase(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Cliente padre</label>
        <Select value={clientId} onValueChange={(v) => setClientId(v ?? '')}>
          <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Nombre de la empresa</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: ION, Airkem"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Letra de prefijo</label>
        <Input
          value={codeLetter}
          onChange={(e) => setCodeLetter(e.target.value.slice(0, 1))}
          placeholder="Ej: I"
          maxLength={1}
          className="uppercase w-20"
          required
        />
        <p className="text-xs text-slate-500">
          Un solo carácter. Los envases se identificarán como{' '}
          <span className="font-mono font-semibold">{codeLetter.toUpperCase() || 'X'}-001</span>, etc.
        </p>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button
          type="submit"
          disabled={!clientId || !name.trim() || !codeLetter.trim()}
          className="flex-1"
        >
          Agregar empresa
        </Button>
      </div>
    </form>
  )
}
