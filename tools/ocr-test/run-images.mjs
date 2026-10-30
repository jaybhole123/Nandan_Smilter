// Runs every image in Testing_Images through the real /api/ocr handler and prints what was read.
//   node tools/ocr-test/run-images.mjs [imagesDir]
// Needs OPENAI_API_KEY (shell env, .env.local or .env). Results are also written to tools/ocr-test/out/.
import fs from 'node:fs'
import path from 'node:path'
import { handleOcr } from '../../server/ocrHandler.js'

for (const file of ['.env', '.env.local']) {
  if (!fs.existsSync(file)) continue
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set (put it in .env.local).')
  process.exit(1)
}

// file name pattern -> the page schema(s) to read it with
const PAGES_BY_FILE = [
  [/sauda purchase/i, ['sauda_purchase']],
  [/sauda sale/i, ['sauda_sale']],
  [/raw material|coal/i, ['stock_raw', 'stock_coal']],
  [/production/i, ['production']],
  [/comming|incoming|outgoing|transfer/i, ['transfer']],
]

const dir = process.argv[2] || 'Testing_Images'
const outDir = path.join('tools', 'ocr-test', 'out')
fs.mkdirSync(outDir, { recursive: true })

const call = (page, image) =>
  new Promise((resolve) => {
    const res = { statusCode: 200, setHeader() {}, end: (body) => resolve({ status: res.statusCode, json: JSON.parse(body) }) }
    handleOcr({ method: 'POST', body: { page, image } }, res, process.env)
  })

const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
for (const f of files) {
  const entry = PAGES_BY_FILE.find(([re]) => re.test(f))
  if (!entry) { console.log(`\n== ${f}: no page mapping, skipped`); continue }
  const mime = /\.jpe?g$/i.test(f) ? 'jpeg' : /\.webp$/i.test(f) ? 'webp' : 'png'
  const image = `data:image/${mime};base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}`
  for (const page of entry[1]) {
    const t0 = Date.now()
    const { status, json } = await call(page, image)
    console.log(`\n== ${f}  [${page}]  ${status}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    if (status !== 200) { console.log('ERROR:', json.error); continue }
    const { data, verification } = json
    const head = Object.entries(data).filter(([k]) => k !== 'rows').map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('  ')
    if (head) console.log(head)
    console.log(`${data.rows.length} rows`)
    data.rows.forEach((r, i) => console.log(String(i + 1).padStart(2), Object.values(r).map((v) => (v === '' ? '·' : v)).join(' | ')))
    if (verification.warnings.length) console.log('WARNINGS:\n  ' + verification.warnings.join('\n  '))
    fs.writeFileSync(path.join(outDir, `${path.parse(f).name}.${page}.json`), JSON.stringify(json, null, 2))
  }
}
