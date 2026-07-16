import {
  computeMaintenanceStatus,
  latestMaintenanceDate,
  compareByUrgency,
  formatDaysRemaining,
} from '@/lib/data/equipment-status'

describe('computeMaintenanceStatus', () => {
  it('sin frecuencia → unconfigured', () => {
    const s = computeMaintenanceStatus({ frequencyDays: null, lastPerformedAt: '2026-07-01', today: '2026-07-16' })
    expect(s.state).toBe('unconfigured')
    expect(s.nextDueAt).toBeNull()
    expect(s.daysRemaining).toBeNull()
  })

  it('sin mantenimiento registrado → unconfigured', () => {
    const s = computeMaintenanceStatus({ frequencyDays: 90, lastPerformedAt: null, today: '2026-07-16' })
    expect(s.state).toBe('unconfigured')
  })

  it('faltan más de 15 días → ok', () => {
    // último 2026-07-01 + 90 días = 2026-09-29; hoy 2026-07-16 → faltan 75
    const s = computeMaintenanceStatus({ frequencyDays: 90, lastPerformedAt: '2026-07-01', today: '2026-07-16' })
    expect(s.state).toBe('ok')
    expect(s.nextDueAt).toBe('2026-09-29')
    expect(s.daysRemaining).toBe(75)
  })

  it('faltan exactamente 15 días → due_soon (borde)', () => {
    const s = computeMaintenanceStatus({ frequencyDays: 30, lastPerformedAt: '2026-07-01', today: '2026-07-16' })
    expect(s.state).toBe('due_soon')
    expect(s.daysRemaining).toBe(15)
  })

  it('faltan 16 días → ok (borde)', () => {
    const s = computeMaintenanceStatus({ frequencyDays: 31, lastPerformedAt: '2026-07-01', today: '2026-07-16' })
    expect(s.state).toBe('ok')
    expect(s.daysRemaining).toBe(16)
  })

  it('vence hoy → due_soon con 0 días', () => {
    const s = computeMaintenanceStatus({ frequencyDays: 15, lastPerformedAt: '2026-07-01', today: '2026-07-16' })
    expect(s.state).toBe('due_soon')
    expect(s.daysRemaining).toBe(0)
  })

  it('fecha pasada → overdue con días negativos', () => {
    const s = computeMaintenanceStatus({ frequencyDays: 10, lastPerformedAt: '2026-07-01', today: '2026-07-16' })
    expect(s.state).toBe('overdue')
    expect(s.daysRemaining).toBe(-5)
    expect(s.nextDueAt).toBe('2026-07-11')
  })
})

describe('latestMaintenanceDate', () => {
  it('devuelve la fecha más reciente ignorando anulados', () => {
    expect(latestMaintenanceDate([
      { performed_at: '2026-06-01', voided_at: null },
      { performed_at: '2026-07-10', voided_at: '2026-07-11T00:00:00Z' },
      { performed_at: '2026-07-05', voided_at: null },
    ])).toBe('2026-07-05')
  })

  it('sin mantenimientos válidos → null', () => {
    expect(latestMaintenanceDate([])).toBeNull()
    expect(latestMaintenanceDate([{ performed_at: '2026-06-01', voided_at: '2026-06-02T00:00:00Z' }])).toBeNull()
  })
})

describe('compareByUrgency', () => {
  const at = (state: 'unconfigured' | 'ok' | 'due_soon' | 'overdue', days: number | null) => ({
    state, daysRemaining: days, lastPerformedAt: null, nextDueAt: null,
  })

  it('vencidos primero, luego por días ascendente, grises al final', () => {
    const items = [at('ok', 75), at('unconfigured', null), at('overdue', -5), at('due_soon', 3)]
    const sorted = [...items].sort(compareByUrgency)
    expect(sorted.map((s) => s.state)).toEqual(['overdue', 'due_soon', 'ok', 'unconfigured'])
  })

  it('entre vencidos, el más vencido primero', () => {
    const sorted = [at('overdue', -2), at('overdue', -30)].sort(compareByUrgency)
    expect(sorted[0].daysRemaining).toBe(-30)
  })
})

describe('formatDaysRemaining', () => {
  const at = (state: 'unconfigured' | 'ok' | 'due_soon' | 'overdue', days: number | null) => ({
    state, daysRemaining: days, lastPerformedAt: null, nextDueAt: null,
  })

  it('formatea cada estado', () => {
    expect(formatDaysRemaining(at('unconfigured', null))).toBe('—')
    expect(formatDaysRemaining(at('ok', 75))).toBe('75 días')
    expect(formatDaysRemaining(at('due_soon', 1))).toBe('1 día')
    expect(formatDaysRemaining(at('due_soon', 0))).toBe('Vence hoy')
    expect(formatDaysRemaining(at('overdue', -1))).toBe('Vencido hace 1 día')
    expect(formatDaysRemaining(at('overdue', -8))).toBe('Vencido hace 8 días')
  })
})
