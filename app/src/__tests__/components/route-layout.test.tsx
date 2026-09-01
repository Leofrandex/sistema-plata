import { render, screen } from '@testing-library/react'
import RouteLayout from '@/app/register/route/layout'

describe('Layout de recorridos en modo interino', () => {
  it('no renderiza el contenido y explica por qué', () => {
    render(<RouteLayout><p>formulario de recorrido</p></RouteLayout>)
    expect(screen.queryByText('formulario de recorrido')).not.toBeInTheDocument()
    expect(screen.getByText(/en mantenimiento/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /volver al inicio/i })).toHaveAttribute('href', '/')
  })
})
