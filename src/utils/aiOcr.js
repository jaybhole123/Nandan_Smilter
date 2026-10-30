// Client side of the AI image reader. The OpenAI key never reaches the browser:
// we only POST the image to our own /api/ocr endpoint (see server/ocrHandler.js).
import { assessImage } from './imageQuality'

const MAX_SIDE = 3600

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read the image file'))
    }
    img.src = url
  })

// Keep the request under serverless body limits (Vercel ~4.5MB; base64 adds ~33%).
const MAX_DATAURL_CHARS = 4_000_000

// Downscale big phone photos so the upload stays small; keeps text readable.
// Starts at high quality and only steps quality/size down if the payload would be too big.
const toDataUrl = (img) => {
  let scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
  for (let attempt = 0; attempt < 8; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const q of [0.96, 0.9, 0.84]) {
      const url = canvas.toDataURL('image/jpeg', q)
      if (url.length <= MAX_DATAURL_CHARS) return url
    }
    scale *= 0.85
  }
  throw new Error('The image is too large to upload. Please use a smaller photo.')
}

/**
 * @param {File} file
 * @param {'stock_raw'|'stock_coal'|'transfer'|'production'|'sauda_sale'|'sauda_purchase'} page
 * @returns {Promise<{data: object, quality: {ok: boolean, issues: string[]}, verification: {status: string, corrections: object[], unreadable: string[], warnings: string[], message?: string}}>}
 */
export async function extractFromImage(file, page) {
  const { img, url } = await loadImage(file)
  let image, quality
  try {
    quality = assessImage(img)
    image = toDataUrl(img)
  } finally {
    URL.revokeObjectURL(url)
  }
  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page, image }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Image reading failed (${res.status}). Is the /api/ocr server running?`)
  return { ...json, quality: { ok: quality.ok, issues: quality.issues } }
}

export const clean = (v) => String(v ?? '').trim()

// Accepts "2026-10-21" or "21.10.2026"-style and returns YYYY-MM-DD (or today if unparseable)
export const toIsoDate = (s) => {
  const v = clean(s)
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const m = v.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/)
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return new Date().toISOString().split('T')[0]
}
