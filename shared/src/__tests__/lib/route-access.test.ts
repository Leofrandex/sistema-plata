import { isPublicPath, isOperatorAllowed } from '@hospiwaste/shared/lib/auth/route-access'

describe('isPublicPath', () => {
  it('marca /login y /auth como públicas', () => {
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/auth/callback')).toBe(true)
  })
  it('marca el resto como privadas', () => {
    expect(isPublicPath('/dashboard')).toBe(false)
  })
})

describe('isOperatorAllowed', () => {
  it('permite rutas de operador y sus hijas', () => {
    expect(isOperatorAllowed('/dashboard')).toBe(true)
    expect(isOperatorAllowed('/register/route/anden/06:30')).toBe(true)
  })
  it('bloquea rutas de coordinador', () => {
    expect(isOperatorAllowed('/reports')).toBe(false)
    expect(isOperatorAllowed('/admin/containers')).toBe(false)
  })
})
