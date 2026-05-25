/**
 * Inserta un watermark con fecha + hora en la esquina inferior izquierda de
 * una foto y devuelve un dataURL JPEG con el sello quemado en el pixel.
 *
 * Se ejecuta solo en el cliente. Si por alguna razón falla (canvas bloqueado,
 * imagen corrupta), devuelve el dataURL original.
 */

const MAX_DIMENSION = 1920 // redimensionamos también para limitar peso

export async function watermarkPhoto(
  fileOrDataUrl: File | string,
  capturedAt: Date = new Date(),
): Promise<string> {
  try {
    const sourceUrl = typeof fileOrDataUrl === 'string'
      ? fileOrDataUrl
      : await fileToDataUrl(fileOrDataUrl)

    const img = await loadImage(sourceUrl)

    // Escalar para que el lado mayor no supere MAX_DIMENSION (mantiene aspect).
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.round(img.naturalWidth * scale)
    const height = Math.round(img.naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return sourceUrl

    ctx.drawImage(img, 0, 0, width, height)
    drawTimestamp(ctx, width, height, capturedAt)

    return canvas.toDataURL('image/jpeg', 0.9)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[watermark] falló, usando foto sin sello:', err)
    return typeof fileOrDataUrl === 'string'
      ? fileOrDataUrl
      : await fileToDataUrl(fileOrDataUrl)
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}

function drawTimestamp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  date: Date,
) {
  const text = formatTimestamp(date)

  // Tamaño relativo: ~4.5% del lado mayor, mínimo 22px, máximo 56px.
  // Más grande que antes para que sea claramente legible en pantalla y en el PDF.
  const referenceSide = Math.max(width, height)
  const fontSize = Math.max(22, Math.min(56, Math.round(referenceSide * 0.045)))
  const paddingX = Math.round(fontSize * 0.7)
  const paddingY = Math.round(fontSize * 0.45)
  const margin = Math.round(fontSize * 0.6)

  ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`
  ctx.textBaseline = 'alphabetic'

  const metrics = ctx.measureText(text)
  const textWidth = metrics.width
  const boxWidth = textWidth + paddingX * 2
  const boxHeight = fontSize + paddingY * 2

  // Esquina inferior derecha. Caja negra ~75% opaca para contraste fuerte.
  const boxX = width - margin - boxWidth
  const boxY = height - margin - boxHeight
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
  roundRect(ctx, boxX, boxY, boxWidth, boxHeight, Math.round(fontSize * 0.25))
  ctx.fill()

  // Texto blanco con sombra negra para legibilidad sobre fotos muy claras.
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 1
  ctx.fillText(text, boxX + paddingX, boxY + boxHeight - paddingY)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function formatTimestamp(d: Date): string {
  // Ej: "25/05/2026 14:37:21"
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}
