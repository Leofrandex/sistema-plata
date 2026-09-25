/**
 * Prepara las fotos del registro fotográfico antes de armar el PDF.
 *
 * Por qué existe: @react-pdf descargaba las ~800 fotos de una semana todas a la
 * vez desde Supabase. Algunas descargas fallaban y el recuadro quedaba en blanco
 * sin aviso, y cada foto entraba al PDF a tamaño original (1920 px, ~340 KB)
 * aunque se imprime en un recuadro de ~3 cm: un mes llegaba a 500 MB.
 *
 * Acá cada foto se descarga con concurrencia limitada y reintentos, y se reduce
 * a REPORT_IMAGE_MAX_SIDE px en JPEG. El resultado es un data URL por url; null
 * si la foto no se pudo obtener, para que el PDF muestre "Foto no disponible".
 */

/** Lado mayor de la foto en el PDF. El recuadro mide ~100 pt: 480 px ≈ 340 dpi, sobra para leer el visor de la balanza. */
export const REPORT_IMAGE_MAX_SIDE = 480
const REPORT_IMAGE_QUALITY = 0.7

export type ImageLoader = (url: string) => Promise<string>

export interface PrepareOptions {
  loader?: ImageLoader
  concurrency?: number
  /** Reintentos después del primer intento fallido. */
  retries?: number
  retryDelayMs?: number
  onProgress?: (done: number, total: number) => void
}

export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Descarga la foto y la devuelve reducida como data URL JPEG. Solo en el navegador. */
export const downscaleImage: ImageLoader = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const bitmap = await createImageBitmap(await res.blob())
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, REPORT_IMAGE_MAX_SIDE)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d no disponible')
    ctx.drawImage(bitmap, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', REPORT_IMAGE_QUALITY)
  } finally {
    bitmap.close()
  }
}

async function loadWithRetry(url: string, loader: ImageLoader, retries: number, delayMs: number): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await loader(url)
    } catch {
      if (attempt < retries && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
      }
    }
  }
  return null
}

export async function prepareReportImages(
  urls: string[],
  {
    loader = downscaleImage,
    // Medido 2026-09-25: con 6 o con 12 en paralelo da ~1,8 fotos/s (~0,6 MB/s);
    // manda el ancho de banda, no la concurrencia. Lo que acelera es que las
    // fotos originales pesen menos (ver MAX_DIMENSION en photo-watermark).
    concurrency = 6,
    retries = 3,
    retryDelayMs = 500,
    onProgress,
  }: PrepareOptions = {},
): Promise<Map<string, string | null>> {
  const unique = [...new Set(urls)]
  const result = new Map<string, string | null>()
  let next = 0
  let done = 0

  async function worker() {
    while (next < unique.length) {
      const url = unique[next++]
      result.set(url, await loadWithRetry(url, loader, retries, retryDelayMs))
      done += 1
      onProgress?.(done, unique.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker))
  return result
}
