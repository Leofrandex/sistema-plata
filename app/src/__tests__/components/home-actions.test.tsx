import { render, screen } from '@testing-library/react'
import HomePage from '@/app/page'

jest.mock('@hospiwaste/shared/lib/store', () => ({
  useStore: () => ({ users: [], currentProfileId: 'op-1', routeEvents: [] }),
}))
jest.mock('../../lib/active-session', () => ({
  getActiveSession: jest.fn().mockResolvedValue(null),
  routeAndenSessionKey: (d: string, s: string) => `${d}:${s}`,
  todayLocal: () => '2026-09-01',
}))

describe('HomePage en modo interino', () => {
  it('muestra Recorrido como "En mantenimiento" y sin enlace', () => {
    render(<HomePage />)
    expect(screen.getByText('En mantenimiento')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /recorrido/i })).not.toBeInTheDocument()
  })

  it('mantiene Pesaje, Tratamiento y Traslado navegables', () => {
    render(<HomePage />)
    expect(screen.getByRole('link', { name: /pesaje/i })).toHaveAttribute('href', '/register/weighing')
    expect(screen.getByRole('link', { name: /tratamiento/i })).toHaveAttribute('href', '/register/treatment')
    expect(screen.getByRole('link', { name: /traslado externo/i })).toHaveAttribute('href', '/register/transfer')
  })

  it('oculta la sección de recorridos del día', () => {
    render(<HomePage />)
    expect(screen.queryByText('Recorridos de hoy')).not.toBeInTheDocument()
  })
})
