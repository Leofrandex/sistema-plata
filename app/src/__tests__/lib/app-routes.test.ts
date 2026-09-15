/**
 * Toda ruta a la que el APK navega tiene que existir en `app/src/app`.
 *
 * Tras la separación hub/app quedaron enlaces a rutas que hoy viven solo en
 * `hub` (`/dashboard` en la pantalla de Pesaje). En el export estático eso no
 * es un 404 amable: el router no encuentra la página, el WebView hace una carga
 * dura contra el server local de Capacitor y la app se reinicia — se pierde la
 * hidratación y aparece "Sin conexión con el servidor". Este test es la red
 * para que no vuelva a colarse una ruta del hub.
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, sep } from 'path'

const APP_SRC = join(__dirname, '..', '..')
const APP_DIR = join(APP_SRC, 'app')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/** Rutas exportadas: cada `page.tsx` bajo `app/`, con `[slot]` → comodín. */
function knownRoutes(): RegExp[] {
  return walk(APP_DIR)
    .filter((f) => f.endsWith(`${sep}page.tsx`))
    .map((f) => {
      const route = '/' + relative(APP_DIR, f).split(sep).slice(0, -1).join('/')
      const pattern = route
        .replace(/\[[^\]]+\]/g, '§')          // segmento dinámico
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/§/g, '[^/]+')
      return new RegExp(`^${pattern === '/' ? '/' : pattern}$`)
    })
}

/** Destinos literales de navegación: `router.push/replace('/x')` y `href="/x"`. */
function linkedRoutes(): Array<{ file: string; route: string }> {
  const found: Array<{ file: string; route: string }> = []
  for (const file of walk(APP_SRC)) {
    if (!/\.tsx?$/.test(file) || file.includes(`${sep}__tests__${sep}`)) continue
    const src = readFileSync(file, 'utf8')
    const patterns = [
      /router\.(?:push|replace)\(\s*'(\/[^']*)'/g,
      /href=\{?\s*'(\/[^']*)'/g,
      /href="(\/[^"]*)"/g,
    ]
    for (const re of patterns) {
      for (const m of src.matchAll(re)) {
        found.push({ file: relative(APP_SRC, file), route: m[1].split('?')[0].split('#')[0] })
      }
    }
  }
  return found
}

it('no hay enlaces a rutas que no existen en el APK', () => {
  const routes = knownRoutes()
  const roto = linkedRoutes().filter(({ route }) => !routes.some((r) => r.test(route)))
  expect(roto).toEqual([])
})

it('el home del operador existe', () => {
  expect(knownRoutes().some((r) => r.test('/'))).toBe(true)
})

it('/dashboard no existe en el APK (vive en hub)', () => {
  expect(knownRoutes().some((r) => r.test('/dashboard'))).toBe(false)
})
