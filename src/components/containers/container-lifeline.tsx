import type { ContainerPhase } from '@/lib/types'

export const PHASES: { key: ContainerPhase; label: string }[] = [
  { key: 'route', label: 'Recorrido' },
  { key: 'weighing', label: 'Pesaje' },
  { key: 'cold_storage', label: 'Cámara fría' },
  { key: 'treatment', label: 'Tratamiento' },
  { key: 'clean', label: 'Limpio' },
]

const TRANSFER_PHASES: { key: ContainerPhase; label: string }[] = [
  { key: 'route', label: 'Recorrido' },
  { key: 'weighing', label: 'Pesaje' },
  { key: 'cold_storage', label: 'Cámara fría' },
  { key: 'transfer', label: 'Traslado' },
  { key: 'clean', label: 'Limpio' },
]

export function getPhaseIndex(phase: ContainerPhase): number {
  const idx = PHASES.findIndex((p) => p.key === phase)
  return idx >= 0 ? idx : PHASES.length - 1
}

interface Props {
  currentPhase: ContainerPhase
  wasteType: string
}

export function ContainerLifeline({ currentPhase, wasteType }: Props) {
  const phases = wasteType === 'infectious' ? PHASES : TRANSFER_PHASES
  const currentIndex = phases.findIndex((p) => p.key === currentPhase)
  const activeIndex = currentIndex >= 0 ? currentIndex : phases.length - 1

  return (
    <div className="w-full">
      <div className="relative h-2 bg-slate-200 rounded-full mb-6">
        <div
          className="absolute h-2 bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${(activeIndex / (phases.length - 1)) * 100}%` }}
        />
        {phases.map((phase, idx) => {
          const isCompleted = idx < activeIndex
          const isCurrent = idx === activeIndex
          return (
            <div
              key={phase.key}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${(idx / (phases.length - 1)) * 100}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 ${
                  isCompleted
                    ? 'bg-blue-500 border-blue-500'
                    : isCurrent
                    ? 'bg-white border-blue-500 ring-2 ring-blue-200'
                    : 'bg-white border-slate-300'
                }`}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between">
        {phases.map((phase, idx) => {
          const isCompleted = idx < activeIndex
          const isCurrent = idx === activeIndex
          return (
            <div
              key={phase.key}
              className={`text-xs text-center flex-1 ${
                isCurrent
                  ? 'font-semibold text-blue-600'
                  : isCompleted
                  ? 'text-slate-500'
                  : 'text-slate-300'
              }`}
            >
              {phase.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
