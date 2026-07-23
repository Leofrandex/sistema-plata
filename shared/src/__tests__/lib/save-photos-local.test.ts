import 'fake-indexeddb/auto'
import { saveEventPhotosLocal } from '@hospiwaste/shared/lib/data/photos'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

it('guarda el blob local y devuelve Photo con id de cliente', async () => {
  const [photo] = await saveEventPhotosLocal('route', 're9', [{ dataUrl: PNG_1PX, label: 'Andén' }], 'op1')
  const store = await getLocalStore()
  expect(await store.getPhotoBlob(photo.id)).not.toBeNull()
  const [meta] = await store.getUnsyncedPhotos()
  expect(meta.event_id).toBe('re9')
  expect(meta.ext).toBe('png')
})
