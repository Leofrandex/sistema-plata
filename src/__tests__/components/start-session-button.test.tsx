import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StartSessionButton } from '@/components/register/start-session-button'

describe('StartSessionButton', () => {
  it('llama onStart cuando la sesión está lista y se hace click', async () => {
    const onStart = jest.fn()
    render(
      <StartSessionButton sessionReady onStart={onStart}>
        Iniciar pesaje
      </StartSessionButton>,
    )
    await userEvent.click(screen.getByRole('button', { name: /iniciar pesaje/i }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('respeta el disabled propio aun con la sesión lista', async () => {
    const onStart = jest.fn()
    render(
      <StartSessionButton sessionReady disabled onStart={onStart}>
        Iniciar recorrido
      </StartSessionButton>,
    )
    const btn = screen.getByRole('button', { name: /iniciar recorrido/i })
    expect(btn).toBeDisabled()
    await userEvent.click(btn)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('cuando la sesión NO está lista no muestra el botón de iniciar ni dispara onStart', () => {
    const onStart = jest.fn()
    render(
      <StartSessionButton sessionReady={false} onStart={onStart}>
        Iniciar pesaje
      </StartSessionButton>,
    )
    // No existe un botón "Iniciar" tappable: en su lugar, estado de carga.
    expect(screen.queryByRole('button', { name: /iniciar pesaje/i })).not.toBeInTheDocument()
    expect(screen.getByText(/cargando tu sesión/i)).toBeInTheDocument()
    expect(onStart).not.toHaveBeenCalled()
  })

  it('cuando la sesión NO está lista, "Reintentar" dispara la re-hidratación', async () => {
    const onStart = jest.fn()
    const handler = jest.fn()
    window.addEventListener('hospiwaste:retry-hydration', handler)
    render(
      <StartSessionButton sessionReady={false} onStart={onStart}>
        Iniciar pesaje
      </StartSessionButton>,
    )
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener('hospiwaste:retry-hydration', handler)
  })
})
