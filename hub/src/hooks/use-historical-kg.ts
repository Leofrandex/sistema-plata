'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import * as q from '@hospiwaste/shared/lib/supabase/queries'
import type { HistoricalDailyKgRow } from '@hospiwaste/shared/lib/supabase/queries/historical-kg'

/**
 * El historico es inmutable (2024-01-15 -> 2026-09-06) y pesa ~1.9k filas, asi
 * que se trae una sola vez por sesion de browser y se comparte entre pantallas.
 * La promesa se cachea a nivel de modulo; si falla, se limpia para que el
 * proximo montaje reintente.
 */
let cache: Promise<HistoricalDailyKgRow[]> | null = null

/**
 * Techo para la consulta. Sin esto la pantalla se queda en "Cargando…" para
 * siempre cuando la petición no resuelve — que no es hipotético: pasa cuando la
 * pestaña no tiene sesión de Supabase, y pasa en planta cuando el DNS de la
 * operadora no resuelve el host del proyecto (ver
 * `2026-08-25-fix-sesion-apk-preferences-sqlite`). Mejor un mensaje de error
 * accionable que un spinner eterno.
 */
const TIMEOUT_MS = 20_000

function load(): Promise<HistoricalDailyKgRow[]> {
  if (!cache) {
    cache = Promise.race([
      q.listHistoricalDailyKg(createClient()),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout al cargar el histórico')), TIMEOUT_MS),
      ),
    ]).catch((err) => {
      // Se limpia el cache para que el próximo montaje reintente.
      cache = null
      throw err
    })
  }
  return cache
}

export interface HistoricalKgState {
  rows: HistoricalDailyKgRow[]
  loading: boolean
  error: boolean
}

export function useHistoricalKg(): HistoricalKgState {
  const [rows, setRows] = useState<HistoricalDailyKgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    load()
      .then((data) => {
        if (cancelled) return
        setRows(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { rows, loading, error }
}
