import { ROUTE_SLOTS, slotToParam, paramToSlot } from '@hospiwaste/shared/lib/constants'
import type { RouteSlot } from '@hospiwaste/shared/lib/types'

describe('slot ↔ URL param (sin ":")', () => {
  it('slotToParam quita el ":" del slot', () => {
    expect(slotToParam('06:30')).toBe('0630')
    expect(slotToParam('21:00')).toBe('2100')
  })

  it('el token de URL nunca contiene ":"', () => {
    for (const s of ROUTE_SLOTS) {
      expect(slotToParam(s.id)).not.toContain(':')
    }
  })

  it('round-trip: paramToSlot(slotToParam(slot)) === slot para todos los slots', () => {
    for (const s of ROUTE_SLOTS) {
      expect(paramToSlot(slotToParam(s.id))).toBe(s.id)
    }
  })

  it('paramToSlot devuelve null para un token inválido', () => {
    expect(paramToSlot('9999')).toBeNull()
    expect(paramToSlot('')).toBeNull()
  })

  it('genera los 6 tokens esperados', () => {
    const tokens = ROUTE_SLOTS.map((s) => slotToParam(s.id))
    expect(tokens).toEqual(['0630', '1030', '1320', '1430', '1830', '2100'])
  })
})

// Evita "unused import" de RouteSlot y documenta el tipo de retorno.
const _typecheck: RouteSlot | null = paramToSlot('0630')
void _typecheck
