import { describeError, MAX_ERROR_LEN } from '@hospiwaste/shared/lib/describe-error'

it('conserva el texto técnico y agrega la explicación cuando la conoce', () => {
  const out = describeError(new TypeError('Failed to fetch'))
  expect(out).toContain('Failed to fetch')
  expect(out).toMatch(/No se pudo contactar/)
})

it('reconoce un fallo de DNS', () => {
  expect(describeError(new Error('net::ERR_NAME_NOT_RESOLVED'))).toMatch(/DNS/)
})

it('reconoce un plugin nativo caído', () => {
  expect(describeError(new Error('"Preferences.then()" is not implemented on android'))).toMatch(/nativo/)
})

it('acepta objetos con message, strings y null', () => {
  expect(describeError({ message: 'x' })).toBe('x')
  expect(describeError('y')).toBe('y')
  expect(describeError(null)).toBe('error desconocido')
})

it('recorta mensajes larguísimos', () => {
  expect(describeError(new Error('a'.repeat(500))).length).toBeLessThanOrEqual(MAX_ERROR_LEN)
})
