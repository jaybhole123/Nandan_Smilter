// Standalone API server for deployments:  node server/index.js
// (In dev, `npm run dev` serves /api/ocr through the Vite plugin instead.)
import http from 'node:http'
import fs from 'node:fs'
import { handleOcr } from './ocrHandler.js'

if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const port = process.env.PORT || 8787
http
  .createServer((req, res) => {
    if (req.url === '/api/ocr') return handleOcr(req, res, process.env)
    res.statusCode = 404
    res.end('Not found')
  })
  .listen(port, () => console.log(`OCR API on http://localhost:${port}/api/ocr`))
