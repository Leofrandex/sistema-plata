import type { ContainerPhase } from '@/lib/types'

const PHASE_ORDER: ContainerPhase[] = [
  'exchange',
  'weighing',
  'cold_storage',
  'treatment',
  'transfer',
  'clean',
]

// Returns the earliest incomplete phase across all containers in a batch.
// "Incomplete" means anything before 'clean'.
export function computeNextPendingStep(phases: ContainerPhase[]): ContainerPhase {
  for (const phase of PHASE_ORDER) {
    if (phase === 'clean') continue
    if (phases.some((p) => p === phase)) return phase
  }
  return 'exchange' // all containers are clean → new cycle starting
}
