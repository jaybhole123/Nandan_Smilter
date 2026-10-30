import { PAGES, sanitize, crossChecks } from './schemas.js'

const API_URL = 'https://api.openai.com/v1/chat/completions'
const MAX_BODY = 20 * 1024 * 1024
const TIMEOUT_MS = 120 * 1000

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) { reject(new Error('Image too large')); req.destroy() }
      else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

const send = (res, status, body) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function callModel({ key, model, name, schema, system, userText, image, effort }) {
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: image, detail: 'high' } },
        ],
      },
    ],
    response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
  }
  if (effort) body.reasoning_effort = effort
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(json?.error?.message || `OpenAI error ${r.status}`)
  const msg = json.choices?.[0]?.message
  if (msg?.refusal) throw new Error(`Model refused: ${msg.refusal}`)
  return JSON.parse(msg?.content || '{}')
}

const EXTRACT_SYSTEM = `You read photos/scans of plant paperwork and return the data as JSON.
Rules:
- Copy values exactly as printed. Never calculate, estimate or "fix" numbers. Copy names letter by letter, keep original spelling.
- If a cell is blank, illegible or you are not sure, return "" for it. Do not guess digits.
- Keep the original row order. Skip TOTAL / SUB TOTAL rows and column headers.
- Numeric cells contain ONLY digits and one optional decimal point: remove thousands commas, units (Mt, FC), currency and symbols (@, /-, *). Keep a trailing % only for percentage cells.
- Dates: YYYY-MM-DD (dd.mm.yy means day.month.year).`

const VERIFY_SYSTEM = `You are a careful checker. You get an image and data another reader extracted from it.
Compare every value against the image, digit by digit: watch for dropped or extra digits in long numbers. Change a value ONLY if you are CERTAIN the image shows something different (a wrong digit, wrong row/column, missed or extra row). Do NOT reformat, normalise, re-space or "improve" text or numbers; the cleaning rules (numbers only, no units/symbols, dates YYYY-MM-DD) must be preserved.
If unsure, leave the value as is. Return the full data in "data" and one "corrections" entry per value you changed.`

const verifySchema = (dataSchema) => ({
  type: 'object',
  properties: {
    data: dataSchema,
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          row: { type: 'integer' },
          field: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['row', 'field', 'from', 'to', 'reason'],
        additionalProperties: false,
      },
    },
    unreadable: { type: 'array', items: { type: 'string' } },
  },
  required: ['data', 'corrections', 'unreadable'],
  additionalProperties: false,
})

export async function handleOcr(req, res, env) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
  const key = env.OPENAI_API_KEY
  if (!key) return send(res, 500, { error: 'OPENAI_API_KEY is not set on the server (.env)' })

  let payload
  try {
    if (req.body && typeof req.body === 'object') {
      payload = req.body
    } else if (typeof req.body === 'string') {
      payload = JSON.parse(req.body)
    } else {
      payload = JSON.parse(await readBody(req))
    }
  } catch (e) { return send(res, 400, { error: e.message }) }
  const { page, image } = payload || {}
  const cfg = PAGES[page]
  if (!cfg) return send(res, 400, { error: `Unknown page "${page}"` })
  if (typeof image !== 'string' || !image.startsWith('data:image/')) return send(res, 400, { error: 'image must be a data:image URL' })

  const extractModel = env.OCR_MODEL || 'gpt-5.6-sol'
  const verifyModel = env.OCR_VERIFY_MODEL || 'gpt-5.6-terra'
  const effort = env.OCR_EFFORT || undefined
  // A second AI pass added little accuracy in testing (and doubled time), so it is opt-in: OCR_VERIFY=on
  const doVerify = String(env.OCR_VERIFY || '').toLowerCase() === 'on'

  try {
    const extracted = await callModel({
      key, model: extractModel, name: `${page}_extract`, schema: cfg.schema,
      system: EXTRACT_SYSTEM, userText: cfg.hint, image, effort,
    })

    let data = extracted
    let verification = { status: 'read', corrections: [], unreadable: [], warnings: [] }
    if (doVerify) {
      try {
        const v = await callModel({
          key, model: verifyModel, name: `${page}_verify`, schema: verifySchema(cfg.schema),
          system: VERIFY_SYSTEM,
          userText: `${cfg.hint}\n\nExtracted data to check:\n${JSON.stringify(extracted)}`,
          image, effort,
        })
        data = v.data
        verification.corrections = v.corrections
        verification.unreadable = v.unreadable
        verification.status = v.corrections.length || v.unreadable.length ? 'corrected' : 'verified'
      } catch (e) {
        verification = { status: 'unverified', corrections: [], unreadable: [], warnings: [], message: e.message }
      }
    }

    data = sanitize(page, data)
    verification.warnings = crossChecks(page, data)
    return send(res, 200, { data, verification, models: { extractModel, verifyModel: doVerify ? verifyModel : null } })
  } catch (e) {
    console.error('[ocr]', e.message)
    return send(res, 502, { error: e.name === 'TimeoutError' ? 'The AI took too long. Please try again.' : e.message })
  }
}
