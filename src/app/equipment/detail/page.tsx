'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import { useStore } from '@/lib/store'
import { EquipmentForm, type EquipmentFormValues } from '@/components/equipment/equipment-form'

function EquipmentDetailInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')
  const currentProfileId = useStore((s) => s.currentProfileId)

  const [equipment, setEquipment] = useState<q.EquipmentRow | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState<string | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id) return
    const db = createClient()
    q.getEquipment(db, id)
      .then((row) => {
        if (!row) setError('Equipo no encontrado.')
        setEquipment(row)
      })
      .catch((err) => {
        console.error('[equipment] cargar equipo falló:', err)
        setError('No se pudo cargar el equipo.')
      })
      .finally(() => setLoading(false))
  }, [id, reloadKey])

  async function handleCreate(values: EquipmentFormValues) {
    const db = createClient()
    const row = await q.createEquipment(db, { ...values, created_by: currentProfileId })
    router.replace(`/equipment/detail?id=${row.id}`)
  }

  async function handleUpdate(values: EquipmentFormValues) {
    if (!equipment) return
    const db = createClient()
    const row = await q.updateEquipment(db, equipment.id, values)
    setEquipment(row)
  }

  async function handleDeactivate() {
    if (!equipment) return
    try {
      const db = createClient()
      await q.updateEquipment(db, equipment.id, { active: false })
      router.replace('/equipment')
    } catch (err) {
      console.error('[equipment] desactivar equipo falló:', err)
      setError('No se pudo desactivar el equipo.')
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-slate-500 py-8"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/equipment">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />Equipos
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">
          {id ? (equipment ? equipment.name : 'Equipo') : 'Nuevo equipo'}
          {equipment?.identification && <span className="text-slate-400 font-normal"> · {equipment.identification}</span>}
        </h1>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!id && (
        <Card>
          <CardHeader><CardTitle className="text-base">Datos del equipo</CardTitle></CardHeader>
          <CardContent>
            <EquipmentForm submitLabel="Crear equipo" onSubmit={handleCreate} onCancel={() => router.push('/equipment')} />
          </CardContent>
        </Card>
      )}

      {equipment && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Datos del equipo</CardTitle></CardHeader>
            <CardContent>
              <EquipmentForm
                initial={{
                  name: equipment.name,
                  brand: equipment.brand,
                  model: equipment.model,
                  serial: equipment.serial,
                  identification: equipment.identification,
                  owner: equipment.owner,
                  provider: equipment.provider,
                  maintenance_frequency_days: equipment.maintenance_frequency_days,
                }}
                submitLabel="Guardar cambios"
                onSubmit={handleUpdate}
              />
            </CardContent>
          </Card>

          {/* TASK-8: historial de mantenimientos */}

          <div className="pt-2 border-t">
            {confirmDeactivate ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">¿Desactivar este equipo? Deja de aparecer en la tabla.</span>
                <Button variant="outline" size="sm" onClick={() => setConfirmDeactivate(false)}>Cancelar</Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeactivate}>Desactivar</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDeactivate(true)}>
                Desactivar equipo
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function EquipmentDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 text-slate-500 py-8"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>}>
      <EquipmentDetailInner />
    </Suspense>
  )
}
