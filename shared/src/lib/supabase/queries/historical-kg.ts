import type { Tables } from '../database.types'
import { unwrap, type DB } from './_helpers'

export type HistoricalDailyKgRow = Tables<'historical_daily_kg'>

/**
 * Primer dia que el sistema en vivo registra con pesajes reales. Todo lo
 * anterior vive en `historical_daily_kg`; nada se solapa. Ver el ADR
 * `2026-09-14-historico-kilos-2024-2026`.
 */
export const HISTORICAL_CUTOVER = '2026-09-07'

/** Mes (YYYY-MM) mas viejo con historico cargado. */
export const HISTORICAL_FIRST_MONTH = '2024-01'

/** Tope de filas por respuesta de PostgREST en Supabase. */
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

  for (let desde = 0; ; desde += PAGE_SIZE) {
    const pagina = unwrap(
      await db
        .from('historical_daily_kg')
        .select('*')
        .order('weighed_on', { ascending: true })
        .order('company_name', { ascending: true })
        .range(desde, desde + PAGE_SIZE - 1)
    )
    todas.push(...pagina)
    if (pagina.length < PAGE_SIZE) return todas
  }
}
