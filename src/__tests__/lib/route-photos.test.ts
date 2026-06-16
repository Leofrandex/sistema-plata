import { groupRoutePhotosByRole } from '@/components/supabase-hydrator'
import type { PhotoRow } from '@/lib/supabase/queries'

function photo(over: Partial<PhotoRow>): PhotoRow {
  return {
    id: 'p', storage_path: 'route/e1/p.jpg', url: null, event_type: 'route',
    event_id: 'e1', taken_at: '2026-06-10T10:00:00Z', label: '', uploaded_by: null,
    created_at: '2026-06-10T10:00:00Z', role: null, ...over,
  }
}

describe('groupRoutePhotosByRole', () => {
  it('separa dirty y clean por evento', () => {
    const rows: PhotoRow[] = [
      photo({ id: 'd1', event_id: 'e1', role: 'dirty' }),
      photo({ id: 'd2', event_id: 'e1', role: 'dirty' }),
      photo({ id: 'c1', event_id: 'e1', role: 'clean' }),
      photo({ id: 'd3', event_id: 'e2', role: 'dirty' }),
    ]
    const { dirtyByEvent, cleanByEvent } = groupRoutePhotosByRole(rows)
    expect(dirtyByEvent.get('e1')).toEqual(['d1', 'd2'])
    expect(cleanByEvent.get('e1')).toEqual(['c1'])
    expect(dirtyByEvent.get('e2')).toEqual(['d3'])
    expect(cleanByEvent.get('e2')).toBeUndefined()
  })

  it('fotos legacy sin role no entran en ningún grupo', () => {
    const rows: PhotoRow[] = [photo({ id: 'x', event_id: 'e1', role: null })]
    const { dirtyByEvent, cleanByEvent } = groupRoutePhotosByRole(rows)
    expect(dirtyByEvent.get('e1')).toBeUndefined()
    expect(cleanByEvent.get('e1')).toBeUndefined()
  })

  it('agrupa la firma por evento (última gana)', () => {
    const rows: PhotoRow[] = [
      photo({ id: 's1', event_id: 'e1', role: 'signature' }),
      photo({ id: 'd1', event_id: 'e1', role: 'dirty' }),
      photo({ id: 's2', event_id: 'e2', role: 'signature' }),
      photo({ id: 's3', event_id: 'e2', role: 'signature' }),
    ]
    const { signatureByEvent } = groupRoutePhotosByRole(rows)
    expect(signatureByEvent.get('e1')).toBe('s1')
    expect(signatureByEvent.get('e2')).toBe('s3')
  })
})
