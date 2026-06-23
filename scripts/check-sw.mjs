import { readFileSync } from 'node:fs'

const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const checks = [
  ['NetworkFirst handler', /NetworkFirst/],
  ['StaleWhileRevalidate handler', /StaleWhileRevalidate/],
  ['offline fallback precache', /offline/],
]
let ok = true
for (const [name, re] of checks) {
  const present = re.test(sw)
  console.log(`${present ? 'PASS' : 'FAIL'}  ${name}`)
  if (!present) ok = false
}
process.exit(ok ? 0 : 1)
