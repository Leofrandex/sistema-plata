'use client'

import { useState } from 'react'
import { Plus, Car, Wrench, Truck } from 'lucide-react'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { Badge } from '@hospiwaste/shared/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@hospiwaste/shared/components/ui/card'
import { ContainerForm } from '@/components/admin/container-form'
import { useStore } from '@hospiwaste/shared/lib/store'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import * as q from '@hospiwaste/shared/lib/supabase/queries'
import type { Container } from '@hospiwaste/shared/lib/types'
import { formatTachoNumber } from '@hospiwaste/shared/lib/data/containers'

export default function AdminContainersPage() {
  const { containers, addContainer, updateContainer, currentProfileId, users } = useStore()
  const [showForm, setShowForm] = useState(false)

  async function handleAdd(data: Omit<Container, 'registered_at' | 'status'>) {
    const now = new Date().toISOString()
    try {
      const supabase = createClient()
      await q.createContainer(supabase, {
        id: data.id,
        size_liters: String(data.size_liters) as '120' | '240' | '750' | '1100',
        tare_weight_kg: data.tare_weight_kg,
        status: 'active',
        is_yaris_dedicated: data.is_yaris_dedicated ?? false,
        is_metallic_dedicated: data.is_metallic_dedicated ?? false,
        is_yaris_container: data.is_yaris_container ?? false,
        created_by: currentProfileId,
      })
    } catch (err) {
      console.error('[admin/containers] crear tacho falló:', err)
      return
    }
    addContainer({ ...data, status: 'active', registered_at: now, created_by: currentProfileId })
    setShowForm(false)
  }

  async function handleDecommission(id: string) {
    try {
      const supabase = createClient()
      await q.updateContainer(supabase, id, { status: 'decommissioned' })
    } catch (err) {
      console.error('[admin/containers] dar de baja falló:', err)
      return
    }
    updateContainer(id, { status: 'decommissioned' })
  }

  async function toggleYaris(c: Container) {
    const next = !c.is_yaris_dedicated
    try {
      const supabase = createClient()
      await q.updateContainer(supabase, c.id, { is_yaris_dedicated: next })
    } catch (err) {
      console.error('[admin/containers] toggle Yaris falló:', err)
      return
    }
    updateContainer(c.id, { is_yaris_dedicated: next })
  }

  async function toggleMetallic(c: Container) {
    const next = !c.is_metallic_dedicated
    try {
      const supabase = createClient()
      await q.updateContainer(supabase, c.id, { is_metallic_dedicated: next })
    } catch (err) {
      console.error('[admin/containers] toggle Metálico falló:', err)
      return
    }
    updateContainer(c.id, { is_metallic_dedicated: next })
  }

  async function toggleYarisContainer(c: Container) {
    const next = !c.is_yaris_container
    try {
      const supabase = createClient()
      await q.updateContainer(supabase, c.id, { is_yaris_container: next })
    } catch (err) {
      console.error('[admin/containers] toggle Yaris recorrido falló:', err)
      return
    }
    updateContainer(c.id, { is_yaris_container: next })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Administrar Tachos</h1>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />Nuevo tacho
        </Button>
      </div>
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Agregar nuevo tacho</CardTitle></CardHeader>
          <CardContent>
            <ContainerForm
              onSubmit={handleAdd}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">Tacho</th>
              <th className="px-4 py-3 font-medium">Tamaño</th>
              <th className="px-4 py-3 font-medium">Tara</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Yaris</th>
              <th className="px-4 py-3 font-medium">Metálico</th>
              <th className="px-4 py-3 font-medium">Contenedor Yaris</th>
              <th className="px-4 py-3 font-medium">Registrado por</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {containers.map((c) => {
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold">{formatTachoNumber(c.id)}</td>
                  <td className="px-4 py-3 text-slate-600">{c.size_liters} L</td>
                  <td className="px-4 py-3 text-slate-600">{c.tare_weight_kg} kg</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                      {c.status === 'active' ? 'Activo' : 'Dado de baja'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleYaris(c)}
                      disabled={c.status !== 'active'}
                      className={c.is_yaris_dedicated
                        ? 'gap-1 bg-amber-50 text-amber-900 hover:bg-amber-100'
                        : 'gap-1 text-muted-foreground hover:text-foreground'}
                    >
                      <Car className="h-3.5 w-3.5" />
                      {c.is_yaris_dedicated ? 'Sí' : 'No'}
                    </Button>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMetallic(c)}
                      disabled={c.status !== 'active'}
                      className={c.is_metallic_dedicated
                        ? 'gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'gap-1 text-muted-foreground hover:text-foreground'}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      {c.is_metallic_dedicated ? 'Sí' : 'No'}
                    </Button>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleYarisContainer(c)}
                      disabled={c.status !== 'active'}
                      className={c.is_yaris_container
                        ? 'gap-1 bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
                        : 'gap-1 text-muted-foreground hover:text-foreground'}
                    >
                      <Truck className="h-3.5 w-3.5" />
                      {c.is_yaris_container ? 'Sí' : 'No'}
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.created_by ? (users.find((u) => u.id === c.created_by)?.name ?? '—') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.status === 'active' && (
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDecommission(c.id)}>
                        Dar de baja
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
