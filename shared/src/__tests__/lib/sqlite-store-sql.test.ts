import { SCHEMA_SQL, photoFileName } from '@hospiwaste/shared/lib/local-store/sqlite-store'

describe('sqlite-store (capa pura)', () => {
  it('el esquema crea local_rows, local_photos y meta con WAL', () => {
    const all = SCHEMA_SQL.join('\n')
    expect(all).toContain('CREATE TABLE IF NOT EXISTS local_rows')
    expect(all).toContain('PRIMARY KEY (tbl, id)')
    expect(all).toContain('CREATE TABLE IF NOT EXISTS local_photos')
    expect(all).toContain('CREATE TABLE IF NOT EXISTS meta')
    expect(all).toContain('CREATE INDEX IF NOT EXISTS idx_local_rows_unsynced')
  })

  it('photoFileName es determinístico: photos/{photo_id}.{ext}', () => {
    expect(photoFileName({
      photo_id: 'p1', ext: 'jpg',
    })).toBe('photos/p1.jpg')
  })
})
