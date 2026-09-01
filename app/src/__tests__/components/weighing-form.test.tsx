import { render, screen } from '@testing-library/react'
import { WeighingForm, EMPTY_WEIGHING_FORM } from '@/components/register/weighing-form'
import type { Container, Company } from '@hospiwaste/shared/lib/types'

const containers: Container[] = [
  { id: '001', size_liters: 240, tare_weight_kg: 14, status: 'active', registered_at: '2026-01-01T00:00:00Z' },
]
const companies: Company[] = [
  { id: 'company-ion', client_id: 'cli', name: 'ION', code_letter: 'I' },
  { id: 'company-airkem', client_id: 'cli', name: 'Airkem', code_letter: 'A' },
]

function renderForm(state = EMPTY_WEIGHING_FORM) {
  return render(
    <WeighingForm
      state={state}
      onChange={() => {}}
      availableContainers={containers}
      yarisContainers={[]}
      metallicContainers={[]}
      allContainers={containers}
      companies={companies}
      locked={false}
      mode="create"
      onSubmit={() => {}}
    />,
  )
}

describe('WeighingForm — empresa', () => {
  it('muestra el selector de empresa', () => {
    renderForm()
    expect(screen.getByText('Empresa')).toBeInTheDocument()
  })

  it('no permite guardar sin empresa aunque el resto esté completo', () => {
    renderForm({
      ...EMPTY_WEIGHING_FORM,
      container_id: '001',
      company_id: '',
      photo_container: 'data:image/png;base64,x',
      photo_scale: 'data:image/png;base64,y',
      gross_weight: '40',
    })
    expect(screen.getByRole('button', { name: /guardar y agregar otro/i })).toBeDisabled()
  })

  it('permite guardar cuando la empresa está elegida', () => {
    renderForm({
      ...EMPTY_WEIGHING_FORM,
      container_id: '001',
      company_id: 'company-ion',
      photo_container: 'data:image/png;base64,x',
      photo_scale: 'data:image/png;base64,y',
      gross_weight: '40',
    })
    expect(screen.getByRole('button', { name: /guardar y agregar otro/i })).toBeEnabled()
  })
})
