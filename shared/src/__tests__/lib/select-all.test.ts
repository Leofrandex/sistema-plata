import { PAGE_SIZE, selectAll } from '@hospiwaste/shared/lib/supabase/queries/_helpers'

type Fila = { id: number }

/**
 * Simula PostgREST: sirve `range(desde, hasta)` pero nunca devuelve mas de
 * `maxRows` filas por respuesta, y lo hace SIN error -- que es justamente lo
 * que hacia invisible el truncamiento.
 */
function tablaFalsa(total: number, maxRows: number) {
  const filas: Fila[] = Array.from({ length: total }, (_, i) => ({ id: i }))
  const rangos: Array<[number, number]> = []

  const build = (desde: number, hasta: number) => {
    rangos.push([desde, hasta])
    const tope = Math.min(hasta, desde + maxRows - 1)
    return Promise.resolve({ data: filas.slice(desde, tope + 1), error: null })
  }

  return { build, rangos }
}

describe('selectAll', () => {
  it('trae la tabla completa cuando pasa el tope por respuesta', async () => {
    const { build } = tablaFalsa(2121, 1000)
    const filas = await selectAll<Fila>(build)
    expect(filas).toHaveLength(2121)
    expect(filas[2120].id).toBe(2120)
  })

  it('avanza por lo que realmente volvio, no por PAGE_SIZE', async () => {
    // max-rows del proyecto < PAGE_SIZE: comparar contra PAGE_SIZE para cortar
    // truncaria en la primera vuelta.
    const { build, rangos } = tablaFalsa(750, 300)
    const filas = await selectAll<Fila>(build)
    expect(filas).toHaveLength(750)
    expect(rangos.map(([desde]) => desde)).toEqual([0, 300, 600, 750])
  })

  it('no repite ni saltea filas entre paginas', async () => {
    const filas = await selectAll<Fila>(tablaFalsa(2500, 1000).build)
    expect(new Set(filas.map((f) => f.id)).size).toBe(2500)
  })

  it('cierra con una vuelta vacia en vez de comparar contra PAGE_SIZE', async () => {
    const { build, rangos } = tablaFalsa(10, 1000)
    await expect(selectAll<Fila>(build)).resolves.toHaveLength(10)
    expect(rangos).toEqual([
      [0, PAGE_SIZE - 1],
      [10, 10 + PAGE_SIZE - 1],
    ])
  })

  it('tabla vacia no entra en bucle', async () => {
    const { build, rangos } = tablaFalsa(0, 1000)
    await expect(selectAll<Fila>(build)).resolves.toEqual([])
    expect(rangos).toHaveLength(1)
  })

  it('propaga el error de la consulta', async () => {
    await expect(
      selectAll<Fila>(() => Promise.resolve({ data: null, error: { message: 'boom' } }))
    ).rejects.toThrow('boom')
  })
})
