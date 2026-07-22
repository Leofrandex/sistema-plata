import { pathMatchesAny } from '@hospiwaste/shared/lib/auth/route-access'

describe('pathMatchesAny', () => {
  const PUBLIC = ['/login', '/auth']

  it('matchea la ruta exacta', () => {
    expect(pathMatchesAny('/login', PUBLIC)).toBe(true)
  })

  it('matchea rutas hijas por prefijo con separador', () => {
    expect(pathMatchesAny('/auth/callback', PUBLIC)).toBe(true)
    expect(pathMatchesAny('/register/route/anden/06:30', ['/register/route'])).toBe(true)
  })

  it('no matchea prefijos parciales sin separador', () => {
    expect(pathMatchesAny('/loginx', PUBLIC)).toBe(false)
  })

  it('no matchea rutas fuera de la lista', () => {
    expect(pathMatchesAny('/dashboard', PUBLIC)).toBe(false)
    expect(pathMatchesAny('/admin/containers', ['/reports'])).toBe(false)
  })
})
