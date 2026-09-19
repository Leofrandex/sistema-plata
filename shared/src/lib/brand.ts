/**
 * Tokens de marca en hexadecimal, para lo que no puede leer CSS.
 *
 * La fuente de verdad de la interfaz es `shared/src/styles/tokens.css`, pero
 * está en `oklch()` y dentro de custom properties: un PDF de `@react-pdf/renderer`,
 * un canvas o un correo no pueden resolver ninguna de las dos cosas. Acá viven
 * los mismos colores escritos en hex, tomados de [[Branding]].
 *
 * Si cambia un token en `tokens.css`, cambia también acá: son el mismo color
 * dicho en dos idiomas, y no hay nada que los mantenga sincronizados solos.
 */
export const BRAND = {
  /** Navy de identidad. Es `--primary` y también el color del cuerpo de texto. */
  primary: '#0B1A48',
  /** Azul medio, para elementos secundarios. */
  secondary: '#4656A4',
  /** Azul/violeta vibrante. Solo para lo accionable y lo destacado. */
  accent: '#2A27E9',
  /** Fondo general de la app. En papel se usa blanco; esto es para pantallas. */
  background: '#F7F7F7',
  /** Superficie de tarjeta. */
  card: '#FFFFFF',
  /** Borde de 1px de bajo contraste — la separación por defecto. */
  border: '#E7E7E7',
  /** Texto secundario. */
  mutedForeground: '#686868',
  /** Relleno suave: fondo de botón secundario y de encabezado de tabla. */
  muted: '#E4F0F8',
  /** Signo de variación. Son los `green-700` / `red-700` que usa la web. */
  positive: '#15803D',
  negative: '#B91C1C',
} as const

/** Radio de componente (botón, input, tarjeta chica), en px. */
export const BRAND_RADIUS = 8

/**
 * Paleta por año del comparativo interanual: el más viejo más apagado, el año
 * en curso en el acento de marca. Ordenada de viejo a nuevo; si algún día hay
 * más años que colores, se repite el ciclo.
 *
 * Vive acá y no en el componente porque la usan dos renderers distintos —el
 * gráfico de la web y el del PDF— y tienen que dibujar el mismo año del mismo
 * color o el reporte impreso contradice a la pantalla.
 */
export const YEAR_COLORS = ['#CBD5E1', '#94A3B8', '#2A27E9', '#7C3AED', '#0EA5E9']
