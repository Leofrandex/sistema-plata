import { useStore } from '@hospiwaste/shared/lib/store'
import type { StorageEvent } from '@hospiwaste/shared/lib/types'

const evento: StorageEvent = {
  id: 's-test-1', container_id: '001', entry_at: '2026-09-18T09:00:00Z',
  exit_at: null, operator_id: 'op-1', photo_ids: [],
}

describe('updateStorageEvent', () => {
  beforeEach(() => {
    useStore.setState({ storageEvents: [evento] })
  })

  it('cierra el exit_at del evento indicado', () => {
    useStore.getState().updateStorageEvent('s-test-1', { exit_at: '2026-09-18T15:00:00Z' })
    expect(useStore.getState().storageEvents[0].exit_at).toBe('2026-09-18T15:00:00Z')
  })

  it('no toca los demás eventos', () => {
    const otro: StorageEvent = { ...evento, id: 's-test-2', container_id: '002' }
    useStore.setState({ storageEvents: [evento, otro] })
    useStore.getState().updateStorageEvent('s-test-1', { exit_at: '2026-09-18T15:00:00Z' })
    expect(useStore.getState().storageEvents[1].exit_at).toBeNull()
  })
})
