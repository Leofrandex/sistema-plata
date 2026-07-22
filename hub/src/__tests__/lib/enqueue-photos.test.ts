/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto'
import { enqueueEventPhotos } from '@/lib/data/photos'
import { listOps, getPhotoBlob } from '@hospiwaste/shared/lib/offline-queue'

// jsdom no está; stub mínimo de URL.createObjectURL para entorno node.
beforeAll(() => {
  // @ts-expect-error: stub de test
  global.URL.createObjectURL = () => 'blob:local/mock'
})

const DATA_URL = 'data:image/jpeg;base64,' + Buffer.from('x').toString('base64')

it('encola una op upload_photo por foto, con blob y dep al padre', async () => {
  const photos = await enqueueEventPhotos({
    dataUrls: [DATA_URL, null, DATA_URL],
    eventType: 'weighing', eventId: 'r1', label: 'L',
    uploadedBy: 'u1', takenAt: 't', role: null, parentOpId: 'rec:r1',
  })
  expect(photos).toHaveLength(2)
  expect(photos[0].url).toBe('blob:local/mock')

  const ops = (await listOps()).filter((o) => o.type === 'upload_photo')
  expect(ops).toHaveLength(2)
  expect(ops[0].deps).toEqual(['rec:r1'])
  expect(ops[0].op_id.startsWith('photo:')).toBe(true)
  const pid = (ops[0].payload as { photo_id: string }).photo_id
  expect(await getPhotoBlob(pid)).toBeTruthy()
  expect((ops[0].payload as { event_type: string }).event_type).toBe('weighing')
})
