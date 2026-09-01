import { render, screen } from '@testing-library/react'
import { InterimModeBanner } from '@/components/dashboard/interim-mode-banner'

describe('InterimModeBanner', () => {
  it('avisa que los estados de circulación no son representativos', () => {
    render(<InterimModeBanner />)
    expect(screen.getByText(/modo interino/i)).toBeInTheDocument()
    expect(screen.getByText(/no son representativos/i)).toBeInTheDocument()
  })
})
