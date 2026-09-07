import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('WeighingForm — buscador de tacho', () => {
  const muchos: Container[] = [
    { id: '001', size_liters: 240, tare_weight_kg: 14, status: 'active', registered_at: '2026-01-01T00:00:00Z' },
    { id: '002', size_liters: 240, tare_weight_kg: 14, status: 'active', registered_at: '2026-01-01T00:00:00Z' },
    { id: '145', size_liters: 240, tare_weight_kg: 14, status: 'active', registered_at: '2026-01-01T00:00:00Z' },
  ]

  function renderConCatalogo(onChange = () => {}) {
    return render(
      <WeighingForm
        state={EMPTY_WEIGHING_FORM}
        onChange={onChange}
        availableContainers={muchos}
          metallicContainers={[]}
        allContainers={muchos}
        companies={companies}
        locked={false}
        mode="create"
        onSubmit={() => {}}
      />,
    )
  }

  it('filtra los tachos por número al escribir', async () => {
    const user = userEvent.setup()
    renderConCatalogo()
    await user.type(screen.getByPlaceholderText(/número de tacho/i), '145')
    expect(screen.getByRole('button', { name: /145/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^001/ })).not.toBeInTheDocument()
  })

  it('al elegir un resultado emite container_id', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    renderConCatalogo(onChange)
    await user.type(screen.getByPlaceholderText(/número de tacho/i), '002')
    await user.click(screen.getByRole('button', { name: /002/ }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ container_id: '002' }))
  })

  it('limpia el texto de búsqueda al cruzar hacia o desde tipo metálico', async () => {
    const user = userEvent.setup()
    renderConCatalogo()
    await user.type(screen.getByPlaceholderText(/número de tacho/i), '145')
    const wasteTypeGroup = screen.getByText('Tipo de desecho').closest('div')!
    await user.click(within(wasteTypeGroup).getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: /metálicos no reutilizables/i }))
    expect(screen.getByPlaceholderText(/número de tacho/i)).toHaveValue('')
  })
})

describe('WeighingForm — tacho metálico', () => {
  const metallicContainers: Container[] = [
    { id: 'M1', size_liters: 100, tare_weight_kg: 8, status: 'active', registered_at: '2026-01-01T00:00:00Z', is_metallic_dedicated: true },
    { id: 'M2', size_liters: 100, tare_weight_kg: 8, status: 'active', registered_at: '2026-01-01T00:00:00Z', is_metallic_dedicated: true },
  ]

  it('muestra el catálogo completo de metálicos sin necesidad de escribir', async () => {
    const user = userEvent.setup()
    render(
      <WeighingForm
        state={{ ...EMPTY_WEIGHING_FORM, waste_type: 'metallic' }}
        onChange={() => {}}
        availableContainers={containers}
          metallicContainers={metallicContainers}
        allContainers={metallicContainers}
        companies={companies}
        locked={false}
        mode="create"
        onSubmit={() => {}}
      />,
    )
    // No hay buscador para metálicos: el Select se abre y muestra el catálogo
    // completo sin escribir nada.
    expect(screen.queryByPlaceholderText(/número de tacho/i)).not.toBeInTheDocument()
    const tachoGroup = screen.getByText('Tacho metálico').closest('div')!
    await user.click(within(tachoGroup).getByRole('combobox'))
    expect(await screen.findByRole('option', { name: /M1/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /M2/ })).toBeInTheDocument()
  })
})

describe('WeighingForm — aviso de duplicado', () => {
  it('muestra el aviso cuando se pasa duplicateWarning', () => {
    render(
      <WeighingForm
        state={{ ...EMPTY_WEIGHING_FORM, container_id: '001', company_id: 'company-ion' }}
        onChange={() => {}}
        availableContainers={containers}
          metallicContainers={[]}
        allContainers={containers}
        companies={companies}
        duplicateWarning="Este tacho ya se pesó hoy a las 09:15."
        locked={false}
        mode="create"
        onSubmit={() => {}}
      />,
    )
    expect(screen.getByText(/ya se pesó hoy a las 09:15/i)).toBeInTheDocument()
  })

  it('no bloquea el guardado cuando hay aviso', () => {
    render(
      <WeighingForm
        state={{
          ...EMPTY_WEIGHING_FORM,
          container_id: '001', company_id: 'company-ion',
          photo_container: 'data:image/png;base64,x',
          photo_scale: 'data:image/png;base64,y',
          gross_weight: '40',
        }}
        onChange={() => {}}
        availableContainers={containers}
          metallicContainers={[]}
        allContainers={containers}
        companies={companies}
        duplicateWarning="Este tacho ya se pesó hoy a las 09:15."
        locked={false}
        mode="create"
        onSubmit={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /guardar y agregar otro/i })).toBeEnabled()
  })
})
