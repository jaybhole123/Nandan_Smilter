// Cheap in-browser check of whether a photo is good enough to read reliably.
// Blurry / tiny photos make the AI invent plausible-looking digits, so we warn before it happens.

const MAX_SIDE = 1600 // measure at (at most) this size; never upscale, upscaling hides blur

/**
 * @param {HTMLImageElement|ImageBitmap} img
 * @returns {{width:number,height:number,sharpness:number,contrast:number}}
 *   sharpness: 0..1, share of strong edges (high for crisp text, low for blurred photos)
 */
export function measureImage(img) {
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const w = Math.max(8, Math.round(width * scale))
  const h = Math.max(8, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data

  const gray = new Float32Array(w * h)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) gray[j] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]

  // gradient magnitude + contrast range
  const grads = []
  const hist = new Uint32Array(256)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      hist[gray[i] | 0]++
      const g = Math.abs(gray[i + 1] - gray[i - 1]) + Math.abs(gray[i + w] - gray[i - w])
      if (g > 24) grads.push(g)
    }
  }
  const total = (w - 2) * (h - 2)
  const pct = (p) => { let c = 0; for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= total * p) return v } return 255 }
  const contrast = Math.max(1, pct(0.99) - pct(0.01))
  if (grads.length < 50) return { width, height, sharpness: 0, contrast }
  grads.sort((a, b) => a - b)
  const p90 = grads[Math.floor(grads.length * 0.9)]
  // strongest edges relative to the available contrast: ~1 for crisp text, much lower once blurred
  return { width, height, sharpness: Math.min(1, p90 / (2 * contrast)), contrast }
}

// Thresholds calibrated on sharp screenshots vs blurred / low-quality / tilted variants of the same sheets.
// (sharp screenshots/photos measured 0.53-0.74, tilted 0.52-0.70, low-quality JPEG 0.47-0.64, blurred 0.22-0.30)
export const QUALITY = { minSide: 600, minSharpness: 0.35, minContrast: 100 }

/** @returns {{ok:boolean, issues:string[], metrics:object}} */
export function assessImage(img) {
  const m = measureImage(img)
  const issues = []
  if (Math.max(m.width, m.height) < QUALITY.minSide) issues.push('The image is small (low resolution). Small print may be misread.')
  if (m.sharpness < QUALITY.minSharpness) issues.push('The photo looks blurry. Please retake it in focus; digits may be misread.')
  if (m.contrast < QUALITY.minContrast) issues.push('The photo looks dark or washed out. Retake with better light.')
  return { ok: issues.length === 0, issues, metrics: m }
}
