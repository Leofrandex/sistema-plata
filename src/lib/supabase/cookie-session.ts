/**
 * Hace que las cookies de auth de Supabase sean **cookies de sesión**: el
 * navegador/PWA las descarta al cerrarse, de modo que al reabrir la app se pide
 * login de nuevo (en vez de mantener la sesión 400 días, que es el default de
 * @supabase/ssr).
 *
 * `@supabase/ssr` fuerza `maxAge` al persistir el token (ver
 * node_modules/@supabase/ssr/dist/main/cookies.js), así que la única forma
 * confiable de evitarlo es quitar `maxAge`/`expires` en nuestros propios
 * `setAll`. Se eliminan **solo cuando se guarda un valor real**: en los borrados
 * (logout) el valor viene vacío con `maxAge: 0` y hay que respetarlo para que la
 * cookie efectivamente se elimine.
 */
type WithPersistence = {
  maxAge?: number
  expires?: Date | number | string
  [key: string]: unknown
}

export function sessionCookieOptions<T extends WithPersistence | undefined>(
  value: string,
  options: T
): T {
  if (!value || !options) return options
  const next = { ...options }
  delete next.maxAge
  delete next.expires
  return next as T
}

/** Lee todas las cookies del documento (browser). */
export function readDocumentCookies(): { name: string; value: string }[] {
  if (typeof document === 'undefined') return []
  return document.cookie
    .split('; ')
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=')
      const name = pair.slice(0, eq)
      const value = pair.slice(eq + 1)
      return { name, value: decodeURIComponent(value) }
    })
}

/**
 * Escribe una cookie en el documento (browser) replicando el formato de
 * `cookie.serialize` que usa internamente @supabase/ssr, pero respetando que
 * `maxAge`/`expires` ya fueron filtradas por `sessionCookieOptions`.
 */
export function writeDocumentCookie(
  name: string,
  value: string,
  options: WithPersistence = {}
): void {
  if (typeof document === 'undefined') return
  let str = `${name}=${encodeURIComponent(value)}`
  if (typeof options.maxAge === 'number')
    str += `; Max-Age=${Math.floor(options.maxAge)}`
  if (options.expires) {
    const exp =
      options.expires instanceof Date
        ? options.expires.toUTCString()
        : String(options.expires)
    str += `; Expires=${exp}`
  }
  if (options.domain) str += `; Domain=${options.domain}`
  str += `; Path=${(options.path as string) ?? '/'}`
  if (options.sameSite) str += `; SameSite=${options.sameSite}`
  if (options.secure) str += '; Secure'
  document.cookie = str
}
