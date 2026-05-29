import { describe, it, expect } from 'vitest'
import { formatTachoNumber } from '@/lib/data/containers'

describe('formatTachoNumber', () => {
  it('quita el prefijo letra-guion', () => {
    expect(formatTachoNumber('A-001')).toBe('001')
    expect(formatTachoNumber('I-010')).toBe('010')
  })
  it('deja intacto un id sin prefijo', () => {
    expect(formatTachoNumber('001')).toBe('001')
    expect(formatTachoNumber('123')).toBe('123')
  })
  it('tolera vacío', () => {
    expect(formatTachoNumber('')).toBe('')
  })
})
