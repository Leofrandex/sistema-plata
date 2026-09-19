import { G, Line, Rect, Svg, Text } from '@react-pdf/renderer'
import { MONTH_LABELS, type YearMonthlySeries } from '@hospiwaste/shared/lib/data/historical-kg'
import { BRAND, YEAR_COLORS } from '@hospiwaste/shared/lib/brand'
import { PDF_FONT } from './pdf-theme'

const NUM = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 0 })

/** Geometría del panel, en puntos PDF. El ancho es el de la caja de texto de
 *  una A4 con los márgenes de este reporte (595 − 34 × 2). */
const W = 527
const H = 190
const PAD_LEFT = 42
const PAD_RIGHT = 4
const PAD_TOP = 8
const PAD_BOTTOM = 18

const PLOT_W = W - PAD_LEFT - PAD_RIGHT
const PLOT_H = H - PAD_TOP - PAD_BOTTOM
const BASELINE = PAD_TOP + PLOT_H

/** Redondea el techo del eje al siguiente escalón "redondo" para que las
 *  etiquetas no digan 43.712 sino 50.000. */
function niceCeiling(max: number): number {
  if (max <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(max))
  return Math.ceil(max / (magnitude / 2)) * (magnitude / 2)
}

/** Etiqueta del eje: en toneladas, que es como se lee un total de planta. */
function axisLabel(kg: number): string {
  return kg === 0 ? '0' : `${NUM.format(Math.round(kg / 1000))}t`
}

interface Props {
  series: YearMonthlySeries[]
}

/**
 * Comparativo año contra año para el PDF.
 *
 * Es el gemelo del gráfico de `/analytics`, redibujado con las primitivas SVG
 * de `@react-pdf/renderer`: recharts renderiza al DOM y no existe dentro de un
 * documento PDF. Comparte con él la paleta (`YEAR_COLORS`) y la regla de que un
 * mes sin datos no se dibuja — `null` es "todavía no ocurrió", y una barra en
 * cero diría que ese mes no entró nada, que es otra cosa.
 */
export function YearComparisonChartPdf({ series }: Props) {
  if (series.length === 0) return null

  const values = series.flatMap((s) => s.months.filter((m): m is number => m !== null))
  const top = niceCeiling(Math.max(...values, 0))

  const groupW = PLOT_W / 12
  // Un respiro a cada lado del grupo para que las barras de meses vecinos no
  // se toquen y se lean como una sola.
  const innerW = groupW * 0.72
  const barW = Math.max(innerW / series.length - 1, 1.5)

  const y = (kg: number) => BASELINE - (kg / top) * PLOT_H

  return (
    <Svg width={W} height={H}>
      {/* Grilla horizontal + eje en toneladas */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const kg = top * f
        const yy = y(kg)
        return (
          <G key={f}>
            <Line
              x1={PAD_LEFT}
              y1={yy}
              x2={PAD_LEFT + PLOT_W}
              y2={yy}
              strokeWidth={0.5}
              stroke={f === 0 ? BRAND.mutedForeground : BRAND.border}
            />
            <Text
              x={PAD_LEFT - 5}
              y={yy + 2.5}
              style={{ fontSize: 6.5, fontFamily: PDF_FONT }}
              fill={BRAND.mutedForeground}
              textAnchor="end"
            >
              {axisLabel(kg)}
            </Text>
          </G>
        )
      })}

      {/* Barras agrupadas por mes */}
      {MONTH_LABELS.map((label, monthIndex) => {
        const groupX = PAD_LEFT + monthIndex * groupW
        const firstBarX = groupX + (groupW - innerW) / 2
        return (
          <G key={label}>
            {series.map((s, i) => {
              const kg = s.months[monthIndex]
              if (kg === null || kg <= 0) return null
              const barH = Math.max(BASELINE - y(kg), 0.6)
              return (
                <Rect
                  key={s.year}
                  x={firstBarX + i * (barW + 1)}
                  y={BASELINE - barH}
                  width={barW}
                  height={barH}
                  fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                />
              )
            })}
            <Text
              x={groupX + groupW / 2}
              y={BASELINE + 9}
              style={{ fontSize: 6.5, fontFamily: PDF_FONT }}
              fill={BRAND.mutedForeground}
              textAnchor="middle"
            >
              {label}
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}
