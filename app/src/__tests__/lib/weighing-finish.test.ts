import { receptionsNeedingStorage } from '@/lib/weighing-finish'
import type { ContainerReception } from '@hospiwaste/shared/lib/types'

const base = { weighing_session_id: 's', arrived_at: '2026-09-28T10:00:00Z', gross_weight_kg: 10, operator_id: 'op', photo_ids: [], observations: '' }

it('los pesajes sin tacho no generan cámara fría ni ubicación', () => {
  const recs = [
    { ...base, id: 'a', container_id: '001', waste_type: 'infectious' },
    { ...base, id: 'b', container_id: null, container_ref: '5501', waste_type: 'morgue' },
  ] as ContainerReception[]
  expect(receptionsNeedingStorage(recs).map((r) => r.id)).toEqual(['a'])
})
