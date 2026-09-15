import type { Tables } from '../database.types'
import { unwrap, type DB } from './_helpers'

export type HistoricalDailyKgRow = Tables<'historical_daily_kg'>

// El corte entre fuentes es una regla del dominio y vive en la capa de datos.
// Se re-exporta desde aca por comodidad de quien ya consume este modulo.
export {
  HISTORICAL_CUTOVER,
  HISTORICAL_CUTOVER_MONTH,
  HISTORICAL_FIRST_MONTH,
} from '@hospiwaste/shared/lib/data/historical-kg'

/**
 * Cuantas filas se piden por vuelta. PostgREST corta las respuestas segun el
 * `max-rows` del proyecto (1000 en Supabase por defecto), asi que este numero
 * es un pedido, no una garantia: el bucle avanza por lo que REALMENTE volvio.
 */
const PAGE_SIZE = 1000

/**
 * Agregado diario de los pesajes historicos (2024-01-15 -> 2026-09-06).
 *
 * Son ~1.9k filas inmutables, y eso pasa el tope de 1000 filas por respuesta
 * que PostgREST aplica por defecto: sin paginar, la consulta devuelve solo
 * hasta mediados de 2025 SIN error, y los graficos mienten en silencio. Por eso
 * se pagina con `range()` hasta agotar la tabla.
 */
export async function listHistoricalDailyKg(db: DB): Promise<HistoricalDailyKgRow[]> {
  const todas: HistoricalDailyKgRow[] = []
  let desde = 0

  for (;;) {
    const pagina = unwrap(
      await db
        .from('historical_daily_kg')
        .select('*')
        .order('weighed_on', { ascending: true })
        .order('company_name', { ascending: true })
        .range(desde, desde + PAGE_SIZE - 1)
    )
    // Se corta con pagina vacia, no comparando contra PAGE_SIZE: si el
    // `max-rows` del proyecto fuera menor que PAGE_SIZE, esa comparacion daria
    // verdadera en la primera vuelta y truncaria la tabla en silencio -- el
    // mismo bug que este paginado vino a arreglar.
    if (pagina.length === 0) return todas
    todas.push(...pagina)
    desde += pagina.length
  }
}
