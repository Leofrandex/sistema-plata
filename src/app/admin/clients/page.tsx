'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClientForm } from '@/components/admin/client-form'
import { useStore } from '@/lib/store'
import type { Client } from '@/lib/types'

export default function AdminClientsPage() {
  const { clients, containers, addClient } = useStore()
  const [showForm, setShowForm] = useState(false)

  function handleAdd(data: Omit<Client, 'id' | 'locations'>) {
    addClient({ id: `client-${Date.now()}`, ...data, locations: [] })
    setShowForm(false)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Administrar Clientes</h1>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />Nuevo cliente
        </Button>
      </div>
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Agregar nuevo cliente</CardTitle></CardHeader>
          <CardContent>
            <ClientForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
          </CardContent>
        </Card>
      )}
      <div className="space-y-3">
        {clients.map((client) => {
          const containerCount = containers.filter((c) => c.client_id === client.id).length
          return (
            <div key={client.id} className="flex items-center justify-between p-4 bg-white rounded-lg border">
              <div>
                <p className="font-semibold text-slate-800">{client.name}</p>
                <p className="text-sm text-slate-500">
                  Prefijo: <span className="font-mono font-semibold">{client.code_letter}</span>
                  {' · '}
                  {containerCount} envase{containerCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
