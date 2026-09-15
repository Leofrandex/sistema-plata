import { formatReport, summarize, hostOf, probe, CRASH_LABEL, HEALTH_URL, CONTROL_URL, type CheckResult } from '@/lib/diagnostics'

const own = hostOf(HEALTH_URL)
const control = hostOf(CONTROL_URL)

it('hostOf extrae el host de una URL y tolera basura', () => {
  expect(hostOf('https://a.b.co/x/y')).toBe('a.b.co')
  expect(hostOf('nada')).toBe('nada')
})

it('resume "hay internet pero nuestro host falla" como problema de DNS/red específica', () => {
  const results: CheckResult[] = [
    { label: own, status: 'fail', detail: 'net::ERR_NAME_NOT_RESOLVED' },
    { label: control, status: 'ok', detail: 'respondió en 120 ms' },
  ]
  expect(summarize(results)).toMatch(/DNS privado/)
})

it('resume "nada responde" como sin internet', () => {
  const results: CheckResult[] = [
    { label: own, status: 'fail', detail: 'x' },
    { label: control, status: 'fail', detail: 'y' },
  ]
  expect(summarize(results)).toMatch(/no tiene salida a internet/)
})

it('el crash nativo tiene prioridad en el resumen', () => {
  const results: CheckResult[] = [
    { label: CRASH_LABEL, status: 'fail', detail: 'java.lang.RuntimeException' },
    { label: own, status: 'ok', detail: 'HTTP 200' },
  ]
  expect(summarize(results)).toMatch(/error nativo/)
})

it('formatReport produce texto plano copiable con un renglón por chequeo', () => {
  const txt = formatReport(['Hospiwaste 1.5'], [{ label: 'a', status: 'ok', detail: 'b' }])
  expect(txt).toContain('Hospiwaste 1.5')
  expect(txt).toContain('[OK ] a: b')
})

it('probe convierte un fetch rechazado en un resultado legible, sin lanzar', async () => {
  const orig = global.fetch
  global.fetch = jest.fn(async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch
  try {
    const r = await probe('https://x.test/h')
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('Failed to fetch')
  } finally {
    global.fetch = orig
  }
})

it('probe trata un 401 como "servidor alcanzable" (aviso), no como fallo de red', async () => {
  const orig = global.fetch
  // jsdom no trae `Response`: alcanza con la forma que usa `probe`.
  global.fetch = jest.fn(async () => ({ ok: false, status: 401, type: 'basic' })) as unknown as typeof fetch
  try {
    const r = await probe('https://x.test/h')
    expect(r.status).toBe('warn')
    expect(r.detail).toMatch(/alcanzable.*401/)
  } finally {
    global.fetch = orig
  }
})
