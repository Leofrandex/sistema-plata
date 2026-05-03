'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContainerForm } from '@/components/admin/container-form'
import { useStore } from '@/lib/store'
import type { Container } from '@/lib/types'

const WASTE_LABELS: Record<string, string> = {
  infectious: 'Infeccioso',
  anatomopathological: 'Anatomopat.',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

export default function AdminContainersPage() {
  const { containers, clients, addContainer, updateContainer } = useStore()
  const [showForm, setShowForm] = useState(false)

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  function handleAdd(data: Omit<Container, 'registered_at' | 'status'>) {
    addContainer({ ...data, status: 'active', registered_at: new Date().toISOString() })
    setShowForm(false)
  }

  function handleDecommission(id: string) {
    updateContainer(id, { status: 'decommissioned' })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Administrar Envases</h1>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />Nuevo envase
        </Button>
      </div>
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Agregar nuevo envase</CardTitle></CardHeader>
          <CardContent>
            <ContainerForm clients={clients} onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
          </CardContent>
        </Card>
      )}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">Envase</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Tamaño</th>
              <th className="px-4 py-3 font-medium">Tara</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {containers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-semibold">{c.id}</td>
                <td className="px-4 py-3 text-slate-600">{clientMap[c.client_id] ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{WASTE_LABELS[c.waste_type]}</td>
                <td className="px-4 py-3 text-slate-600">{c.size_liters} L</td>
                <td className="px-4 py-3 text-slate-600">{c.tare_weight_kg} kg</td>
                <td className="px-4 py-3">
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                    {c.status === 'active' ? 'Activo' : 'Dado de baja'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {c.status === 'active' && (
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDecommission(c.id)}>
                      Dar de baja
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
