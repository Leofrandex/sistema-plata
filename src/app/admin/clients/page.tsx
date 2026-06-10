'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClientForm } from '@/components/admin/client-form'
import { useStore } from '@/lib/store'
import type { Client } from '@/lib/types'

export default function AdminClientsPage() {
  const { clients, companies, addClient } = useStore()
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
          const clientCompanies = companies.filter((c) => c.client_id === client.id)

          return (
            <div key={client.id} className="p-4 bg-white rounded-lg border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{client.name}</p>
                  <p className="text-sm text-slate-500">
                    {clientCompanies.length} empresa{clientCompanies.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {clientCompanies.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {clientCompanies.map((co) => (
                    <Badge key={co.id} variant="outline" className="gap-1.5">
                      <span className="font-semibold">{co.name}</span>
                      <span className="font-mono text-xs text-slate-500">({co.code_letter})</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
