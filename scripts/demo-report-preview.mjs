// Genera un preview PNG del Registro Fotográfico replicando el layout del
// componente @react-pdf (photographic-report-document.tsx), usando las fotos
// REALES del bucket Supabase. Uso puntual para demo; no es parte del build.
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'

const SUPA = 'https://xqqnthyipkdkwyknbtnw.supabase.co/storage/v1/object/public/photos'

// --- datos reales (extraídos de Supabase) -----------------------------------
// event_type, taken_at, storage_path, y para pesaje el tacho + pesos.
const photos = [
  // 2026-05-25 — Recorrido
  { d: '2026-05-25', stage: 'route', t: '02:06 p. m.', p: 'route/ff80a14e-e726-435b-9e9e-4dbe8a425628/1779732390817-h6mgsfxk.jpg' },
  { d: '2026-05-25', stage: 'route', t: '01:48 p. m.', p: 'route/33ae9bec-e459-4ba8-8cdc-f7989ac91c79/1779734918268-eptrthzi.jpg' },
  { d: '2026-05-25', stage: 'route', t: '01:48 p. m.', p: 'route/33ae9bec-e459-4ba8-8cdc-f7989ac91c79/1779734921289-mh1qugka.jpg' },
  { d: '2026-05-25', stage: 'route', t: '01:48 p. m.', p: 'route/33ae9bec-e459-4ba8-8cdc-f7989ac91c79/1779734925942-jxldly7p.jpg' },
  { d: '2026-05-25', stage: 'route', t: '01:53 p. m.', p: 'route/33ae9bec-e459-4ba8-8cdc-f7989ac91c79/1779735221590-nxzl8tux.jpg' },
  { d: '2026-05-25', stage: 'route', t: '01:53 p. m.', p: 'route/33ae9bec-e459-4ba8-8cdc-f7989ac91c79/1779735224938-yux9xun2.jpg' },
  // 2026-05-27 — Recorrido
  { d: '2026-05-27', stage: 'route', t: '09:19 a. m.', p: 'route/b0b9293c-2157-400e-a3b2-d4922474b95e/1779891545324-04lkofix.jpg' },
  { d: '2026-05-27', stage: 'route', t: '09:19 a. m.', p: 'route/b0b9293c-2157-400e-a3b2-d4922474b95e/1779891546655-rnuodut8.jpg' },
  { d: '2026-05-27', stage: 'route', t: '09:20 a. m.', p: 'route/3f4d97a2-cc18-42cc-97ee-199b6318a6df/1779891612348-32azvetf.jpg' },
  { d: '2026-05-27', stage: 'route', t: '09:20 a. m.', p: 'route/3f4d97a2-cc18-42cc-97ee-199b6318a6df/1779891614444-d4a35jte.jpg' },
  // 2026-05-27 — Pesaje (tacho / peso bruto / tara)
  { d: '2026-05-27', stage: 'weigh', t: '09:22 a. m.', tacho: '173', bruto: 25.8, tara: 13.4, p: 'weighing/db52a2c7-3766-4420-b179-5695ab9c5c6f/1779891764713-qyrxim5m.jpg' },
  { d: '2026-05-27', stage: 'weigh', t: '09:22 a. m.', tacho: '173', bruto: 25.8, tara: 13.4, p: 'weighing/db52a2c7-3766-4420-b179-5695ab9c5c6f/1779891766312-qafbnbzo.jpg' },
  { d: '2026-05-27', stage: 'weigh', t: '09:22 a. m.', tacho: '173', bruto: 25.8, tara: 13.4, p: 'weighing/155fc3b8-8be4-4f85-81e9-9e61750b3228/1779891766398-2k13owiw.jpg' },
  { d: '2026-05-27', stage: 'weigh', t: '09:22 a. m.', tacho: '173', bruto: 25.8, tara: 13.4, p: 'weighing/155fc3b8-8be4-4f85-81e9-9e61750b3228/1779891767896-of100crw.jpg' },
  { d: '2026-05-27', stage: 'weigh', t: '09:22 a. m.', tacho: '173', bruto: 25.8, tara: 13.4, p: 'weighing/18cbcc25-caf9-48a2-add3-6da0681c9884/1779891767311-9l1fix5s.jpg' },
  { d: '2026-05-27', stage: 'weigh', t: '09:22 a. m.', tacho: '173', bruto: 25.8, tara: 13.4, p: 'weighing/18cbcc25-caf9-48a2-add3-6da0681c9884/1779891768226-hycg033w.jpg' },
  { d: '2026-05-27', stage: 'weigh', t: '09:28 a. m.', tacho: '052', bruto: 25.8, tara: 14.7, p: 'weighing/8d55922b-31fb-4ac3-a7a3-6f48876a7396/1779892082388-z2i27iyt.jpg' },
  { d: '2026-05-27', stage: 'weigh', t: '09:28 a. m.', tacho: '052', bruto: 25.8, tara: 14.7, p: 'weighing/8d55922b-31fb-4ac3-a7a3-6f48876a7396/1779892083641-nrzwllmt.jpg' },
  { d: '2026-05-27', stage: 'weigh', t: '09:31 a. m.', tacho: '—', bruto: null, tara: null, p: 'weighing/7e402004-3f06-44b1-b7a5-bcc64ffdf0a1/1779892296692-uuxl2ons.jpg' },
  { d: '2026-05-27', stage: 'weigh', t: '09:31 a. m.', tacho: '—', bruto: null, tara: null, p: 'weighing/7e402004-3f06-44b1-b7a5-bcc64ffdf0a1/1779892298795-1qgb9sd5.jpg' },
]

const EMPRESA = 'Centro de la Salud'
const PAGE_W = 1754, PAGE_H = 1240 // A4 landscape @150dpi

async function fetchDataUri(path) {
  const res = await fetch(`${SUPA}/${path}`)
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

function logoDataUri(file, mime) {
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

// Construye cuadros por día (orden recorrido → pesaje), 8 fotos por cuadro.
function buildCuadros(dayPhotos) {
  const route = dayPhotos.filter((x) => x.stage === 'route')
  const weigh = dayPhotos.filter((x) => x.stage === 'weigh')
  const cuadros = []
  if (route.length) chunk(route, 8).forEach((ph, i) => cuadros.push({ label: i ? 'Recorrido — 1.ª ruta (cont.)' : 'Recorrido — 1.ª ruta', ph }))
  if (weigh.length) chunk(weigh, 8).forEach((ph, i) => cuadros.push({ label: i ? 'Pesaje — 1.ª ruta (cont.)' : 'Pesaje — 1.ª ruta', ph }))
  return cuadros
}

function metaCell(x, w, label, value) {
  return `
    <rect x="${x}" y="${0}" width="${w}" height="46" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
    <text x="${x + 12}" y="${30}" font-family="Helvetica" font-weight="bold" font-size="18" fill="#334155">${esc(label)}</text>`
}

function renderCuadro(c, x, y, w, h) {
  const headerH = 34, comentH = 40
  const gridY = y + headerH, gridH = h - headerH - comentH
  const cols = 4, rows = 2, gap = 6, pad = 8
  const cellW = (w - pad * 2 - gap * (cols - 1)) / cols
  const cellH = (gridH - pad * 2 - gap * (rows - 1)) / rows
  let cells = ''
  c.ph.forEach((photo, i) => {
    const cx = x + pad + (i % cols) * (cellW + gap)
    const cy = gridY + pad + Math.floor(i / cols) * (cellH + gap)
    cells += `
      <rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" fill="#f1f5f9"/>
      <image x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" preserveAspectRatio="xMidYMid slice" href="${photo.uri}"/>
      <rect x="${cx}" y="${cy + cellH - 16}" width="${cellW}" height="16" fill="#000" opacity="0.55"/>
      <text x="${cx + 4}" y="${cy + cellH - 4}" font-family="Helvetica" font-size="10" fill="#fff">${esc(photo.t)}${photo.tacho ? ' · Tacho ' + esc(photo.tacho) : ''}</text>`
  })
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#94a3b8" stroke-width="1" rx="3"/>
    <rect x="${x}" y="${y}" width="${w}" height="${headerH}" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
    <text x="${x + w / 2}" y="${y + 23}" text-anchor="middle" font-family="Helvetica" font-weight="bold" font-size="15" fill="#334155">${esc(c.label)}</text>
    ${cells}
    <rect x="${x}" y="${y + h - comentH}" width="${w}" height="${comentH}" fill="#fff" stroke="#94a3b8" stroke-width="1"/>
    <text x="${x + 12}" y="${y + h - comentH + 26}" font-family="Helvetica" font-size="14" fill="#0f172a"><tspan font-weight="bold" fill="#334155">Comentario: </tspan>${esc(c.label)}</text>`
}

function renderPage(date, cuadros, logos) {
  const mx = 50, top = 36
  const headerH = 78
  // Header band
  const titleY = top + 50
  const ribbon = `
    <image x="${mx}" y="${top}" width="240" height="${headerH}" preserveAspectRatio="xMidYMid meet" href="${logos.riga}"/>
    <text x="${PAGE_W / 2}" y="${titleY}" text-anchor="middle" font-family="Helvetica" font-weight="bold" font-size="34" letter-spacing="3" fill="#0f172a">REGISTRO FOTOGRÁFICO</text>
    <image x="${PAGE_W - mx - headerH}" y="${top}" width="${headerH}" height="${headerH}" preserveAspectRatio="xMidYMid meet" href="${logos.cpch}"/>`

  // Meta bar
  const metaY = top + headerH + 6
  const mW = PAGE_W - mx * 2
  const cells = [['Edificio', '—'], ['Ubicación', 'PTDP'], ['Empresa', EMPRESA], ['Fecha', date]]
  const cW = mW / 4
  let meta = ''
  cells.forEach(([lab, val], i) => {
    const x = mx + i * cW
    meta += `
      <rect x="${x}" y="${metaY}" width="${cW * 0.42}" height="46" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
      <text x="${x + 12}" y="${metaY + 30}" font-family="Helvetica" font-weight="bold" font-size="17" fill="#334155">${esc(lab)}</text>
      <rect x="${x + cW * 0.42}" y="${metaY}" width="${cW * 0.58}" height="46" fill="#fff" stroke="#94a3b8" stroke-width="1"/>
      <text x="${x + cW * 0.42 + 12}" y="${metaY + 30}" font-family="Helvetica" font-size="17" fill="#0f172a">${esc(val)}</text>`
  })

  // Cuadros 2×2
  const bodyY = metaY + 46 + 16
  const gap = 18
  const cw = (mW - gap) / 2
  const ch = (PAGE_H - bodyY - 50 - gap) / 2
  let body = ''
  cuadros.forEach((c, i) => {
    const x = mx + (i % 2) * (cw + gap)
    const y = bodyY + Math.floor(i / 2) * (ch + gap)
    body += renderCuadro(c, x, y, cw, ch)
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}">
    <rect width="${PAGE_W}" height="${PAGE_H}" fill="#fff"/>
    ${ribbon}
    ${meta}
    ${body}
    <text x="${PAGE_W - mx}" y="${PAGE_H - 24}" text-anchor="end" font-family="Helvetica" font-size="13" fill="#94a3b8">Página · ${date}</text>
  </svg>`
}

async function main() {
  console.log('Descargando fotos…')
  for (const p of photos) p.uri = await fetchDataUri(p.p)
  const logos = {
    riga: logoDataUri('public/logo-riga.png', 'image/png'),
    cpch: logoDataUri('public/logo-cpch.jpg', 'image/jpeg'),
  }
  const days = [...new Set(photos.map((p) => p.d))].sort()
  let n = 0
  for (const date of days) {
    const cuadros = buildCuadros(photos.filter((p) => p.d === date))
    // 4 cuadros por página
    for (const pageCuadros of chunk(cuadros, 4)) {
      n++
      const svg = renderPage(date, pageCuadros, logos)
      writeFileSync(`demo-report-page${n}.svg`, svg)
      await sharp(Buffer.from(svg)).png().toFile(`demo-report-page${n}.png`)
      console.log(`✓ demo-report-page${n}.png (${date}, ${pageCuadros.length} cuadros)`)
    }
  }
  console.log('Listo:', n, 'páginas')
}
main().catch((e) => { console.error(e); process.exit(1) })
