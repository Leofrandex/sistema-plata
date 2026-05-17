import type { RouteSlot } from './types'

export const APP_NAME = 'Hospiwaste'
export const APP_SHORT_NAME = 'Hospiwaste'
export const APP_DESCRIPTION = 'Sistema de trazabilidad de desechos clínicos'
export const APP_TAGLINE = 'Trazabilidad'

// Horario fijo de los 6 recorridos por día.
export interface RouteSlotDefinition {
  id: RouteSlot
  ordinal: string       // '1.ª', '2.ª', ...
  label: string         // '1.ª — 6:30 AM'
  shortLabel: string    // '6:30 AM'
  hour: number
  minute: number
}

export const ROUTE_SLOTS: readonly RouteSlotDefinition[] = [
  { id: '06:30', ordinal: '1.ª', label: '1.ª — 6:30 AM', shortLabel: '6:30 AM', hour: 6, minute: 30 },
  { id: '10:30', ordinal: '2.ª', label: '2.ª — 10:30 AM', shortLabel: '10:30 AM', hour: 10, minute: 30 },
  { id: '13:20', ordinal: '3.ª', label: '3.ª — 1:20 PM', shortLabel: '1:20 PM', hour: 13, minute: 20 },
  { id: '14:30', ordinal: '4.ª', label: '4.ª — 2:30 PM', shortLabel: '2:30 PM', hour: 14, minute: 30 },
  { id: '18:30', ordinal: '5.ª', label: '5.ª — 6:30 PM', shortLabel: '6:30 PM', hour: 18, minute: 30 },
  { id: '21:00', ordinal: '6.ª', label: '6.ª — 9:00 PM', shortLabel: '9:00 PM', hour: 21, minute: 0 },
] as const

export function getRouteSlotDefinition(slot: RouteSlot): RouteSlotDefinition {
  const def = ROUTE_SLOTS.find((s) => s.id === slot)
  if (!def) throw new Error(`Unknown route slot: ${slot}`)
  return def
}
