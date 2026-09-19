import { Font } from '@react-pdf/renderer'
import { BRAND, BRAND_RADIUS } from '@hospiwaste/shared/lib/brand'

export const PDF_FONT = 'Plus Jakarta Sans'

/**
 * Registra la tipografía de marca para los PDF.
 *
 * Los `.ttf` viven en `hub/public/fonts/` y no se traen de `next/font`: Next
 * sirve la fuente como `woff2`, que `fontkit` —el motor de `@react-pdf/renderer`—
 * no sabe leer. Son estáticos y no la variable por la misma razón: de un TTF
 * variable react-pdf saca una sola instancia y las negritas salen iguales que
 * el texto normal.
 *
 * La ruta es relativa a propósito: el PDF se arma en el navegador (vía
 * `PDFDownloadLink`), así que resuelve contra el origen del hub.
 *
 * Idempotente: se llama al importar cada documento y registrar dos veces la
 * misma familia no rompe nada, pero el guard evita el trabajo repetido.
 */
let registered = false

export function registerPdfFonts(): void {
  if (registered) return
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: '/fonts/PlusJakartaSans-Regular.ttf', fontWeight: 400 },
      { src: '/fonts/PlusJakartaSans-SemiBold.ttf', fontWeight: 600 },
      { src: '/fonts/PlusJakartaSans-Bold.ttf', fontWeight: 700 },
    ],
  })
  // Sin esto, una palabra más larga que la celda se sale de la tabla en vez de
  // partirse. El reporte tiene nombres de empresa largos.
  Font.registerHyphenationCallback((word) => [word])
  registered = true
}

/** Alto de la barra de identidad del encabezado, en puntos. */
export const HEADER_BAR_HEIGHT = 3

export const PDF_RADIUS = BRAND_RADIUS

export { BRAND }
