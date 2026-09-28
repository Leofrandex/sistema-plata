import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useStore } from '@hospiwaste/shared/lib/store'
import { WeighingHistory } from '@hospiwaste/shared/components/history/weighing-history'

describe('WeighingHistory', () => {
  it('muestra "Contenedor 5501" y el neto igual al bruto para un pesaje descartable', async () => {
    useStore.setState({
      weighingSessions: [{ id: 's1', client_id: 'c', date: '2026-09-28', started_at: '2026-09-28T10:00:00Z', ended_at: null, operator_id: 'op', status: 'completed', reception_ids: ['r1'] }],
      receptions: [{ id: 'r1', container_id: null, container_ref: '5501', weighing_session_id: 's1', arrived_at: '2026-09-28T10:00:00Z', gross_weight_kg: 7.5, operator_id: 'op', photo_ids: [], observations: '', waste_type: 'morgue' }],
      containers: [], currentRole: 'coordinator', currentProfileId: 'op',
    } as never)
    render(<WeighingHistory />)
    await userEvent.click(screen.getByText(/2026-09-28/))
    expect(screen.getByText('Contenedor 5501')).toBeInTheDocument()
    expect(screen.getByText(/7\.5 kg bruto · 7\.5 kg neto/)).toBeInTheDocument()
  })

  it('deshabilita "Guardar cambios" al pasar una recepción descartable a un tipo con tacho, hasta elegir uno', async () => {
    useStore.setState({
      weighingSessions: [{ id: 's1', client_id: 'c', date: '2026-09-28', started_at: '2026-09-28T10:00:00Z', ended_at: null, operator_id: 'op', status: 'completed', reception_ids: ['r1'] }],
      receptions: [{ id: 'r1', container_id: null, container_ref: '5501', weighing_session_id: 's1', arrived_at: '2026-09-28T10:00:00Z', gross_weight_kg: 7.5, operator_id: 'op', photo_ids: [], observations: '', waste_type: 'morgue' }],
      containers: [{ id: '075', status: 'active', tare_weight_kg: 5, size_liters: 120, is_yaris_container: false, is_metallic_dedicated: false }],
      currentRole: 'coordinator', currentProfileId: 'op',
    } as never)
    render(<WeighingHistory />)
    await userEvent.click(screen.getByText(/2026-09-28/))
    await userEvent.click(screen.getByLabelText('Editar pesaje'))

    await userEvent.selectOptions(screen.getByLabelText('Tipo de desecho'), 'infectious')

    const guardar = screen.getByRole('button', { name: 'Guardar cambios' })
    expect(guardar).toBeDisabled()
    expect(screen.getByText('Falta el tacho')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Tacho'), '075')
    expect(guardar).not.toBeDisabled()
  })
})
