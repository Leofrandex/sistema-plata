/**
 * @jest-environment node
 */
import { mergeById } from '@hospiwaste/shared/lib/data/hydrate-merge'

it('mergeById conserva el local pendiente que aún no está en el server', () => {
  const server = [{ id: 'a', v: 1 }]
  const local = [{ id: 'a', v: 9 }, { id: 'b', v: 2 }]
  const merged = mergeById(server, local, new Set(['b']))
  expect(merged.map((r) => r.id).sort()).toEqual(['a', 'b'])
  // 'a' ya está en server → no se duplica ni se pisa con el local
  expect(merged.find((r) => r.id === 'a')!.v).toBe(1)
})

it('mergeById ignora locales que no están en pendingIds', () => {
  const server = [{ id: 'a', v: 1 }]
  const local = [{ id: 'a', v: 9 }, { id: 'b', v: 2 }]
  const merged = mergeById(server, local, new Set())
  expect(merged.map((r) => r.id)).toEqual(['a'])
})
