/** Namespace fijo del proyecto para ids deterministas (UUID v5).
 *  NO CAMBIAR: cambiarlo re-emite todos los ids y rompe la deduplicación de
 *  tratamientos ya registrados. */
const NAMESPACE_HOSPIWASTE = '6f9b1f4e-2d3a-4c58-9a1b-7e0c5d8f2a41'

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '')
  const out = new Uint8Array(16)
  for (let i = 0; i < 16; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToUuid(b: Uint8Array): string {
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/** UUID v5 (SHA-1) según RFC 4122. Async porque usa WebCrypto. */
export async function uuidV5(namespace: string, name: string): Promise<string> {
  const ns = uuidToBytes(namespace)
  const nameBytes = new TextEncoder().encode(name)
  const input = new Uint8Array(ns.length + nameBytes.length)
  input.set(ns, 0)
  input.set(nameBytes, ns.length)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', input))
  const out = digest.slice(0, 16)
  out[6] = (out[6] & 0x0f) | 0x50 // versión 5
  out[8] = (out[8] & 0x3f) | 0x80 // variante RFC 4122
  return bytesToUuid(out)
}

/** Un tratamiento por recepción. Cuando el tacho vuelve sucio hay recepción
 *  nueva y por lo tanto id nuevo: los ciclos no colisionan entre sí. */
export function treatmentRunId(containerId: string, receptionId: string): Promise<string> {
  return uuidV5(NAMESPACE_HOSPIWASTE, `treatment:${containerId}:${receptionId}`)
}

/** Ubicación derivada del mismo tratamiento. Prefijo distinto para no colisionar. */
export function treatmentLocationId(containerId: string, receptionId: string): Promise<string> {
  return uuidV5(NAMESPACE_HOSPIWASTE, `treatment-location:${containerId}:${receptionId}`)
}
