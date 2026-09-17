import type { Tables } from '../database.types'
import { selectAll, type DB } from './_helpers'

export type HistoricalDailyKgRow = Tables<'historical_daily_kg'>

// El corte entre fuentes es una regla del dominio y vive en la capa de datos.
// Se re-exporta desde aca por comodidad de quien ya consume este modulo.
export {
  HISTORICAL_CUTOVER,
  HISTORICAL_CUTOVER_MONTH,
  HISTORICAL_FIRST_MONTH,
} from '@hospiwaste/shared/lib/data/historical-kg'

/**
 * Agregado diario de los pesajes historicos (2024-01-15 -> 2026-09-06).
 *
 * Son ~1.9k filas inmutables, y eso pasa el tope de 1000 filas por respuesta
 * que PostgREST aplica por defecto: sin paginar, la consulta devuelve solo
 * hasta mediados de 2025 SIN error, y los graficos mienten en silencio. Por eso
 * se pagina con `selectAll` hasta agotar la tabla.
 */
export async function listHistoricalDailyKg(db: DB): Promise<HistoricalDailyKgRow[]> {
  return selectAll<HistoricalDailyKgRow>((desde, hasta) =>
    db
      .from('historical_daily_kg')
      .select('*')
      .order('weighed_on', { ascending: true })
      .order('company_name', { ascending: true })
      .order('id')
      .range(desde, hasta)
  )
}
