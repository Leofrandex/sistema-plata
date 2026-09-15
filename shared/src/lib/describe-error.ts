/**
 * Convierte un error cualquiera en una línea corta y legible para mostrar en
 * pantalla (banner, diagnóstico). Mantiene el texto técnico original porque
 * es lo único que permite diagnosticar desde una captura de pantalla enviada
 * desde planta: "Sin conexión con el servidor" a secas no distingue un DNS
 * roto, un certificado rechazado, un plugin nativo caído o un rechazo del
 * servidor.
 */
export const MAX_ERROR_LEN = 160

export function describeError(err: unknown): string {
  if (err == null) return 'error desconocido'
  const raw =
    err instanceof Error ? `${err.name}: ${err.message}`
    : typeof err === 'string' ? err
    : typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
    : String(err)
  const msg = raw.replace(/\s+/g, ' ').trim()
  const friendly = translate(msg)
  const out = friendly ? `${friendly} (${msg})` : msg
  return out.length > MAX_ERROR_LEN ? out.slice(0, MAX_ERROR_LEN - 1) + '…' : out
}

/** Explicación en español de los fallos más comunes; null si no hay traducción. */
function translate(msg: string): string | null {
  if (/name_not_resolved|nxdomain|getaddrinfo|dns/i.test(msg)) return 'No se pudo resolver el nombre del servidor (DNS)'
  if (/cert|ssl|tls/i.test(msg)) return 'Certificado o conexión segura rechazada (¿fecha y hora del teléfono?)'
  if (/timeout|timed out/i.test(msg)) return 'El servidor no respondió a tiempo'
  if (/failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(msg))
    return 'No se pudo contactar al servidor'
  if (/not implemented on android|plugin/i.test(msg)) return 'Falló un componente nativo del teléfono'
  if (/jwt|refresh token|session/i.test(msg)) return 'Sesión inválida o vencida'
  return null
}
