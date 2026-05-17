'use client'

import { ROUTE_SLOTS } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/card'
import { Clock } from 'lucide-react'

export default function RegisterRoutePage() {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Recorridos</h1>
        <p className="text-sm text-slate-500 mt-1">
          6 recorridos diarios con horario fijo. Selecciona un slot para iniciar el registro.
        </p>
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-4 text-sm text-amber-800">
          La pantalla completa con cronómetro persistente, bloqueo del formulario y
          finalización confirmada se entrega en la Fase 2 del rediseño.
        </CardContent>
      </Card>

      <div className="space-y-2">
        {ROUTE_SLOTS.map((slot) => (
          <div
            key={slot.id}
            className="flex items-center gap-3 p-4 rounded-lg border bg-white opacity-60"
          >
            <Clock className="h-5 w-5 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-800">{slot.ordinal} ruta</p>
              <p className="text-sm text-slate-500">{slot.shortLabel}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
