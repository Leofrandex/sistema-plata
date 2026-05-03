import { render, screen } from '@testing-library/react'
import { Button } from './button'

describe('Button', () => {
  it('renders with text content', () => {
    render(<Button>Guardar</Button>)
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('renders default variant with bg-primary class', () => {
    render(<Button variant="default">Guardar</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toMatch(/bg-primary/)
  })

  it('renders secondary variant with bg-secondary class', () => {
    render(<Button variant="secondary">Cancelar</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toMatch(/bg-secondary/)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Guardar</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Guardar</Button>)
    screen.getByRole('button').click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders outline variant', () => {
    render(<Button variant="outline">Ver detalle</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toMatch(/border-border/)
  })
})
