import { AlertTriangle } from 'lucide-react'
import { INTERIM_MODE } from '@hospiwaste/shared/lib/config/interim-mode'

export function InterimModeBanner() {
  if (!INTERIM_MODE) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle aria-hidden className="size-5 shrink-0 text-amber-600 mt-0.5" />
      <p className="text-sm text-amber-900">
        <strong className="font-semibold">Modo interino:</strong> el registro de recorridos está
        deshabilitado mientras se rehace su arquitectura offline. Los estados de circulación, el
        historial de recorridos y las tarjetas <strong>&quot;Recorridos hoy&quot;</strong> y{' '}
        <strong>&quot;Pendientes de pesar&quot;</strong> <strong>no son representativos</strong>{' '}
        (van a mostrar 0); los pesajes sí.
      </p>
    </div>
  )
}
