/**
 * @jest-environment node
 */
import { mergeById, unionById } from '@hospiwaste/shared/lib/data/hydrate-merge'

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

describe('unionById', () => {
  it('une por id: primary gana en ids repetidos', () => {
    const primary = [{ id: 'a', v: 'local' }]
    const secondary = [{ id: 'a', v: 'store-previo' }]
    const merged = unionById(primary, secondary)
    expect(merged).toEqual([{ id: 'a', v: 'local' }])
  })

  it('nunca descarta filas de secondary ausentes en primary', () => {
    // Regresión: la hidratación local no debe pisar/angostar lo que ya
    // hubiera en el store (p.ej. datos del server de una corrida previa).
    const primary = [{ id: 'a', v: 1 }]
    const secondary = [{ id: 'a', v: 99 }, { id: 'b', v: 2 }, { id: 'c', v: 3 }]
    const merged = unionById(primary, secondary)
    expect(merged.map((r) => r.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('primary vacío devuelve secondary intacto (snapshot local vacío no borra el store)', () => {
    const secondary = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }]
    const merged = unionById([], secondary)
    expect(merged).toEqual(secondary)
  })

  it('secondary vacío devuelve primary intacto', () => {
    const primary = [{ id: 'a', v: 1 }]
    const merged = unionById(primary, [])
    expect(merged).toEqual(primary)
  })
})
