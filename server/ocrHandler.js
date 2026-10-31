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

const EXTRACT_SYSTEM = `You are an ultra-precise, verbatim OCR engine reading documents, registers, and plant paperwork.
Strict Extraction Rules:
- ZERO HALLUCINATION & ZERO INVENTED WORDS: Do NOT add, extrapolate, infer, assume, or modify any words, letters, digits, or characters. Extract ONLY and EXACTLY what is physically written/printed on the image.
- EXACT VERBATIM COPY: Copy every word, name, item description, and note character-by-character, letter-by-letter. Maintain exact spelling, capitalization, and punctuation as visible.
- NUMERICAL VALUES: Copy digits exactly as printed. Never calculate, estimate, round, or "fix" numbers or totals.
  - If a cell contains digits, extract only the exact digits with its optional decimal point (remove commas, currency symbols like Rs/@/-, units like MT/FC).
  - Keep a trailing '%' only if it is explicitly a percentage cell.
- BLANK OR ILLEGIBLE CELLS: If a cell is blank, empty, unreadable, cut off, or missing in the image, return "" (empty string). NEVER make up or guess any digits or text.
- ROW INTEGRITY & ORDER: Maintain the exact sequential row order of the physical sheet. Skip header rows and TOTAL/SUB-TOTAL/GRAND TOTAL summary rows.
- DATES: Convert visible printed dates to YYYY-MM-DD format (dd.mm.yy means day.month.year). If not present, return "".`

const VERIFY_SYSTEM = `You are a strict, forensic quality-control checker for OCR data against an original document image.
Verification Rules:
- Compare every single value against the image character-by-character and digit-by-digit.
- Watch for dropped, misread, or hallucinated characters/words/digits.
- Change a value ONLY if you are 100% CERTAIN the image shows something different (a wrong character, wrong digit, mismatched column, or missed row).
- NEVER add words, descriptions, or commentary that do not exist in the source image.
- If unsure or if a field is blank/illegible, leave it as is or as "".
- Return the exact verified data in "data" and list any genuine fixes in "corrections".`

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
