import { render, screen } from '@testing-library/react'
import { InterimModeBanner } from '@/components/dashboard/interim-mode-banner'

describe('InterimModeBanner', () => {
  it('avisa que los estados de circulación no son representativos', () => {
    render(<InterimModeBanner />)
    expect(screen.getByText(/modo interino/i)).toBeInTheDocument()
    expect(screen.getByText(/no son representativos/i)).toBeInTheDocument()
  })

  it('nombra las tarjetas del dashboard que van a mostrar 0 permanente', () => {
    render(<InterimModeBanner />)
    expect(screen.getByText(/recorridos hoy/i)).toBeInTheDocument()
    expect(screen.getByText(/pendientes de pesar/i)).toBeInTheDocument()
  })
})
