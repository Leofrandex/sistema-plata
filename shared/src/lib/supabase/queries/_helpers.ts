import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

/**
 * Cliente Supabase tipado contra el schema de Hospiwaste.
 * Acéptalo como parámetro en todas las queries para que funcionen igual
 * desde browser (`createClient()` de client.ts) y desde server
 * (`createClient()` de server.ts).
 */
export type DB = SupabaseClient<Database>

/**
 * Lanza si la respuesta de Supabase trae error. Devuelve `data!` ya tipado.
 * Patrón estándar: las queries devuelven los datos directamente, no `{data,error}`.
 */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  if (res.data === null) throw new Error('Query returned null data')
  return res.data
}

/** Variante que admite `null` como resultado legítimo (single row optional). */
export function unwrapOrNull<T>(res: { data: T | null; error: { message: string } | null }): T | null {
  if (res.error && res.error.message !== 'JSON object requested, multiple (or no) rows returned') {
    throw new Error(res.error.message)
  }
  return res.data
}

/**
 * Cuantas filas se piden por vuelta en `selectAll`. PostgREST corta las
 * respuestas segun el `max-rows` del proyecto (1000 en Supabase por defecto),
 * asi que este numero es un pedido, no una garantia: el bucle avanza por lo
 * que REALMENTE volvio.
 */
export const PAGE_SIZE = 1000

/**
 * Trae una tabla completa paginando con `range()`.
 *
 * Sin esto, cualquier `select('*')` sobre una tabla que crece deja de traer
 * las filas nuevas en cuanto pasa el `max-rows` del proyecto, y lo hace SIN
 * error: la consulta "funciona" y devuelve las primeras 1000 filas del orden
 * pedido. Eso fue exactamente lo que escondio las fotos de pesaje posteriores
 * al 2026-09-11 (`photos` cruzo las 1000 filas y el hub dejo de verlas).
 *
 * `build` recibe el rango y debe construir la consulta DE CERO en cada vuelta:
 * los builders de supabase-js no se pueden reutilizar una vez esperados.
 *
 * El orden que use `build` debe ser TOTAL (agregar `id` como desempate cuando
 * la columna principal admite empates), o una fila puede repetirse en una
 * pagina y faltar en la siguiente.
 */
export async function selectAll<T>(
  build: (
    desde: number,
    hasta: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const todas: T[] = []
  let desde = 0

  for (;;) {
    // Se corta con pagina vacia, no comparando contra PAGE_SIZE: si el
    // `max-rows` del proyecto fuera menor que PAGE_SIZE, esa comparacion daria
    // verdadera en la primera vuelta y truncaria la tabla en silencio -- el
    // mismo bug que este paginado vino a arreglar.
    const pagina = unwrap(await build(desde, desde + PAGE_SIZE - 1))
    if (pagina.length === 0) return todas
    todas.push(...pagina)
    desde += pagina.length
  }
}
