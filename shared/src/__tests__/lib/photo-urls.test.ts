import { getPhotoUrls } from '@hospiwaste/shared/lib/supabase/queries/photos'
import type { PhotoRow } from '@hospiwaste/shared/lib/supabase/queries/photos'

function foto(n: number, extra: Partial<PhotoRow> = {}): PhotoRow {
  return {
    id: `p${n}`,
    storage_path: `weighing/e/${n}.jpg`,
    url: null,
    event_type: 'weighing',
    event_id: 'e',
    taken_at: '2026-09-17T10:00:00Z',
    label: '',
    uploaded_by: null,
    created_at: '2026-09-17T10:00:00Z',
    role: null,
    ...extra,
  } as PhotoRow
}

/**
 * Storage falso que reproduce el tope real: rechaza cualquier lote de mas de
 * 1000 rutas con el mismo mensaje que devuelve Supabase.
 */
function storageFalso() {
  const lotes: number[] = []
  const db = {
    storage: {
      from: () => ({
        createSignedUrls: (paths: string[]) => {
          lotes.push(paths.length)
          if (paths.length > 1000) {
            return Promise.resolve({
              data: null,
              error: { message: 'body/paths must NOT have more than 1000 items' },
            })
          }
          return Promise.resolve({
            data: paths.map((p) => ({ signedUrl: `https://signed/${p}` })),
            error: null,
          })
        },
      }),
    },
  }
  return { db, lotes }
}

describe('getPhotoUrls', () => {
  it('firma mas de 1000 fotos partiendo en lotes', async () => {
    const { db, lotes } = storageFalso()
    const fotos = Array.from({ length: 2121 }, (_, i) => foto(i))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const urls = await getPhotoUrls(db as any, fotos)

    expect(urls.size).toBe(2121)
    expect(lotes).toEqual([1000, 1000, 121])
    expect(urls.get('p2120')).toBe('https://signed/weighing/e/2120.jpg')
  })

  it('asocia cada url a SU foto, no a la posicion global', async () => {
    const { db } = storageFalso()
    const fotos = Array.from({ length: 1500 }, (_, i) => foto(i))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const urls = await getPhotoUrls(db as any, fotos)

    // La foto 1200 cae en el segundo lote, en el indice local 200.
    expect(urls.get('p1200')).toBe('https://signed/weighing/e/1200.jpg')
  })

  it('las fotos con url directa no se mandan a firmar', async () => {
    const { db, lotes } = storageFalso()
    const fotos = [foto(1, { url: 'https://legacy/1.jpg' }), foto(2)]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const urls = await getPhotoUrls(db as any, fotos)

    expect(urls.get('p1')).toBe('https://legacy/1.jpg')
    expect(lotes).toEqual([1])
  })

  it('sin nada que firmar no llama a storage', async () => {
    const { db, lotes } = storageFalso()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(getPhotoUrls(db as any, [])).resolves.toEqual(new Map())
    expect(lotes).toEqual([])
  })
})
