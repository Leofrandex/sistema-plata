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
})
