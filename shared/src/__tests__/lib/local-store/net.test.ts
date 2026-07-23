/**
 * @jest-environment node
 */
import { isNetworkError, TABLE_FOR_TYPE } from '@hospiwaste/shared/lib/local-store/net'

describe('isNetworkError', () => {
  it('detecta fallos de red por TypeError fetch', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('duplicate key value'))).toBe(false)
  })
  it('NO clasifica como red un rechazo de servidor que contenga la palabra network', () => {
    expect(isNetworkError(new Error('network policy violation'))).toBe(false)
  })
})

describe('TABLE_FOR_TYPE', () => {
  it('mapea los tipos de op de tabla simple a su tabla Supabase', () => {
    expect(TABLE_FOR_TYPE.create_reception).toBe('container_receptions')
    expect(TABLE_FOR_TYPE.create_route_event).toBe('route_events')
    expect(TABLE_FOR_TYPE.upload_photo).toBeUndefined()
  })
})
