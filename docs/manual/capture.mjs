import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, 'screenshots')
const ASSETS = path.join(__dirname, '_assets')
const BASE = 'http://localhost:3000'
const EMAIL = 'demo@hospiwaste.com'
const PASSWORD = 'hospiwastetest123'

const log = (...a) => console.log('[capture]', ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let page
async function shot(name, full = true) {
  const file = path.join(OUT, name)
  // Ocultar el overlay de DevTools de Next.js antes de capturar
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {})
  await sleep(150)
  await page.screenshot({ path: file, fullPage: full })
  log('shot ->', name)
}

// Click a base-ui Select trigger by its visible text, then pick the first option (or by text).
async function pickSelect(triggerText, optionText) {
  const trigger = page.getByText(triggerText, { exact: false }).first()
  await trigger.click()
  await sleep(400)
  const opt = optionText
    ? page.getByRole('option', { name: optionText }).first()
    : page.getByRole('option').first()
  await opt.click()
  await sleep(400)
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    locale: 'es-PA',
  })
  // Ocultar el overlay de dev de Next.js en cada navegación
  await ctx.addInitScript(() => {
    const css = 'nextjs-portal{display:none!important}'
    const inject = () => {
      if (!document.getElementById('__hide_dev')) {
        const s = document.createElement('style')
        s.id = '__hide_dev'
        s.textContent = css
        document.documentElement.appendChild(s)
      }
    }
    inject()
    new MutationObserver(inject).observe(document.documentElement, { childList: true, subtree: true })
  })
  page = await ctx.newPage()
  page.setDefaultTimeout(15000)

  // ── 0. LOGIN ──────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('#email', EMAIL)
  await page.fill('#password', PASSWORD)
  await shot('00-login.png', false)
  await page.click('button[type=submit]')
  await page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {})
  await sleep(4000) // hidratación Supabase + animación de charts
  log('logged in')

  // ── 1. DASHBOARD ────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await sleep(3500)
  await shot('01-dashboard.png', true)

  // ── 2. RECORRIDO ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/register/route`, { waitUntil: 'networkidle' })
  await sleep(1200)
  await shot('10-recorrido-tipos.png', true)

  await page.goto(`${BASE}/register/route/anden`, { waitUntil: 'networkidle' })
  await sleep(1200)
  await shot('11-recorrido-horarios.png', true)

  // Buscar un horario disponible: navegar slots y quedarnos en el que muestre el selector de empresa.
  const slots = ['06:30', '10:30', '13:20', '14:30', '18:30', '21:00']
  let openedSlot = null
  for (const s of slots) {
    await page.goto(`${BASE}/register/route/anden/${encodeURIComponent(s)}`, { waitUntil: 'networkidle' })
    await sleep(1000)
    const hasEmpresa = await page.getByText('Empresa del recorrido').count()
    if (hasEmpresa > 0) { openedSlot = s; break }
  }
  log('slot disponible:', openedSlot)
  if (openedSlot) {
    await shot('12-recorrido-empresa.png', true)
    // Seleccionar empresa e iniciar
    try { await pickSelect('Seleccionar empresa') } catch (e) { log('empresa select fail', e.message) }
    await sleep(400)
    await page.getByRole('button', { name: /Iniciar recorrido/i }).click().catch((e) => log('iniciar fail', e.message))
    await sleep(1500)
    await shot('13-recorrido-en-curso.png', true)

    // Abrir picker de tachos sucios
    try {
      await page.getByRole('button', { name: /Agregar tachos sucios/i }).click()
      await sleep(900)
      await shot('14-recorrido-picker.png', false)
      // seleccionar los primeros 2 tachos
      const items = page.locator('[role=dialog] ul li button')
      const n = await items.count()
      for (let i = 0; i < Math.min(2, n); i++) await items.nth(i).click()
      await sleep(300)
      await page.getByRole('button', { name: /^Listo/i }).click()
      await sleep(800)
    } catch (e) { log('picker fail', e.message) }

    // Ubicación
    try {
      await page.getByPlaceholder('Ej: 2').fill('2')
      await page.getByPlaceholder('Ej: Pediatría').fill('Pediatría')
      await page.getByPlaceholder('Ej: Andén Norte').fill('Andén Norte')
    } catch (e) { log('ubicacion fail', e.message) }

    // Foto del recorrido
    try {
      const fileInput = page.locator('input[type=file]').first()
      await fileInput.setInputFiles(path.join(ASSETS, 'recorrido.jpg'))
      await sleep(1500)
    } catch (e) { log('foto recorrido fail', e.message) }

    await shot('15-recorrido-form-lleno.png', true)

    // Mostrar diálogo de finalizar (sin confirmar) — solo si hay andén guardado.
    // Como NO guardamos andén (para no escribir en BD), capturamos el form lleno como paso final.

    // Limpiar: cancelar la sesión (solo IndexedDB, no escribe en BD).
    try {
      await page.getByRole('button', { name: /Cancelar/i }).first().click()
      await sleep(500)
      await page.getByRole('button', { name: /Sí, cancelar/i }).click()
      await sleep(1500)
    } catch (e) { log('cancel recorrido fail', e.message) }
  }

  // ── 3. PESAJE ───────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/register/weighing`, { waitUntil: 'networkidle' })
  await sleep(1500)
  await shot('20-pesaje-inicio.png', true)

  let weighingStarted = false
  try {
    await page.getByRole('button', { name: /Iniciar pesaje/i }).click()
    await sleep(2500)
    weighingStarted = true
    await shot('21-pesaje-en-curso.png', true)
  } catch (e) { log('iniciar pesaje fail', e.message) }

  if (weighingStarted) {
    // Seleccionar tacho (primer select del form)
    try {
      const triggers = page.getByRole('combobox')
      const tcount = await triggers.count()
      log('comboboxes en pesaje:', tcount)
      // Intentar abrir el primer select y elegir opción
      await triggers.first().click()
      await sleep(400)
      const opt = page.getByRole('option').first()
      if (await opt.count()) { await opt.click(); await sleep(400) }
      else { await page.keyboard.press('Escape') }
    } catch (e) { log('tacho select fail', e.message) }

    // Peso bruto
    try {
      await page.getByPlaceholder('Ej: 43.7').fill('45.0')
      await sleep(500)
    } catch (e) { log('peso fail', e.message) }

    // Fotos: balanza (primer input) y tacho (segundo input)
    try {
      const inputs = page.locator('input[type=file]')
      await inputs.nth(0).setInputFiles(path.join(ASSETS, 'balanza.jpg'))
      await sleep(1200)
      await inputs.nth(1).setInputFiles(path.join(ASSETS, 'tacho.jpg'))
      await sleep(1500)
    } catch (e) { log('fotos pesaje fail', e.message) }

    await shot('22-pesaje-form-lleno.png', true)

    // Limpiar: cancelar la sesión (borra la weighing_session en Supabase → BD queda limpia)
    try {
      await page.getByRole('button', { name: /^Cancelar/i }).first().click()
      await sleep(500)
      await page.getByRole('button', { name: /Sí, cancelar/i }).click()
      await sleep(2000)
    } catch (e) { log('cancel pesaje fail', e.message) }
  }

  // ── 4. TRATAMIENTO ────────────────────────────────────────────────────────
  await page.goto(`${BASE}/register/treatment`, { waitUntil: 'networkidle' })
  await sleep(1800)
  await shot('30-tratamiento.png', true)
  // Seleccionar un par de candidatos (solo estado local, NO enviamos)
  try {
    const cards = page.locator('button', { hasText: /·|L$/ })
    // candidatos son botones con número de tacho + badge L
    const candidateBtns = page.locator('main button').filter({ has: page.locator('span.font-mono') })
    const cc = await candidateBtns.count()
    for (let i = 0; i < Math.min(2, cc); i++) await candidateBtns.nth(i).click()
    await sleep(500)
    await shot('31-tratamiento-seleccion.png', true)
  } catch (e) { log('tratamiento seleccion fail', e.message) }

  await browser.close()
  log('DONE')
}

main().catch((e) => { console.error(e); process.exit(1) })
