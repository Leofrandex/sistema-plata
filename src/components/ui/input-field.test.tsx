import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputField } from './input-field'

describe('InputField', () => {
  it('renders input element', () => {
    render(<InputField label="Nombre" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders label linked to input via htmlFor/id', () => {
    render(<InputField label="Nombre del cliente" />)
    expect(screen.getByLabelText('Nombre del cliente')).toBeInTheDocument()
  })

  it('passes placeholder to input', () => {
    render(<InputField label="Nombre" placeholder="Ingrese el nombre" />)
    expect(screen.getByPlaceholderText('Ingrese el nombre')).toBeInTheDocument()
  })

  it('calls onChange when user types', async () => {
    const handleChange = vi.fn()
    render(<InputField label="Nombre" onChange={handleChange} />)
    await userEvent.type(screen.getByRole('textbox'), 'ABC')
    expect(handleChange).toHaveBeenCalled()
  })

  it('renders error message when error prop is provided', () => {
    render(<InputField label="Nombre" error="Campo requerido" />)
    expect(screen.getByText('Campo requerido')).toBeInTheDocument()
  })

  it('adds aria-invalid to input when error is provided', () => {
    render(<InputField label="Nombre" error="Campo requerido" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })
})
