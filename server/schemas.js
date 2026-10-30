// Page-wise extraction schemas, prompt hints, output cleaning and arithmetic cross-checks
// for the AI image reader. All leaf values are strings; cleaning turns them into app-ready values.

const str = { type: 'string' }

const obj = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

const table = (rowProps, extra = {}) =>
  obj({ ...extra, rows: { type: 'array', items: obj(rowProps) } })

// numeric: digits + optional decimal point (and a trailing % where the cell is a percentage)
// pct:     numeric cells that may legitimately carry a trailing %
// date:    normalised to YYYY-MM-DD
const FIELDS = {
  stock_raw: {
    numeric: ['openingStock', 'inward', 'consumption', 'fines3Qty', 'production', 'dispatch', 'closingStock'],
    pct: ['crushing', 'fines3'],
    date: ['reportDate'],
  },
  stock_coal: {
    numeric: ['openingStock', 'inward', 'consumption', 'fc', 'landedCost', 'dispatch', 'closingStock'],
    pct: ['moistLossPct'],
    date: ['reportDate'],
  },
  transfer: { numeric: ['qty', 'rate'], pct: [], date: [] },
  production: { numeric: ['k1Value', 'k2Value', 'totalValue'], pct: ['percentValue'], date: ['date'] },
  sauda_sale: {
    numeric: ['saudaQuantity', 'rateAmt', 'qtyDispatch', 'balPending'],
    pct: [],
    date: ['date'],
  },
  sauda_purchase: {
    numeric: ['orderQuantity', 'rateMt', 'qtyReceived', 'balPending'],
    pct: [],
    date: ['date'],
  },
}

export const PAGES = {
  stock_raw: {
    schema: table(
      {
        category: str, material: str, openingStock: str, inward: str, consumption: str,
        crushing: str, fines3: str, fines3Qty: str, production: str, dispatch: str, closingStock: str,
      },
      { reportDate: str }
    ),
    hint: `RAW MATERIAL STOCK sheet (table of materials with stock columns). Typical columns left to right: Material, Opening Stock, Inward, Consumption, Crushing/Screen, Fines %, Fines qty, Production, Dispatch, Closing Stock; headers may be worded slightly differently or be in a different order - match each value to the column header printed above it.
Copy every digit of long numbers carefully (do not drop a digit from 4-digit integer parts such as 1234.567).
Group heading rows (bold/centered rows with no figures, e.g. "RAW IRON ORE") go in "category" for the rows beneath them; each material row gets its own parent heading. Headings are not data rows.
Read only the raw-material part: stop before any COAL section and ignore TOTAL / SUB TOTAL / GRAND TOTAL rows.
"reportDate" = the "AS ON DATE" date if the sheet prints one, otherwise the main date at the top of the sheet. Blank cells stay "".`,
  },
  stock_coal: {
    schema: table(
      {
        category: str, material: str, openingStock: str, inward: str, consumption: str,
        fc: str, moistLossPct: str, landedCost: str, dispatch: str, closingStock: str,
      },
      { reportDate: str }
    ),
    hint: `COAL DETAILS section of a stock sheet, including any extra item rows printed below the coal TOTAL row down to the end of the table (e.g. other materials listed after "TOTAL COAL"). Typical columns: Material, Opening Stock, Inward, Consumption (net cons.), F/C (fixed carbon), Moisture loss, Landed Cost, Dispatch, Closing Stock; match each value to the header printed above it.
Read all coal rows and also the item rows after the coal TOTAL row; skip only TOTAL rows. "category": the coal section heading for coal rows, and the row's own heading/label for extra item rows after the total.
"fc" = the number only. Read the Landed Cost column carefully and never leave it empty when a value is printed there. Dispatch/Production-type figures printed in the extra rows go in their matching columns.
"reportDate" = the "AS ON DATE" date if the sheet prints one, otherwise the main date at the top. Blank cells stay "".`,
  },
  transfer: {
    schema: table({ entryType: str, partyName: str, materialName: str, vehicleNo: str, qty: str, rate: str }),
    hint: `Incoming / outgoing material record: a register, gate pass, slip, or a chat message (e.g. WhatsApp/Telegram screenshot). One row per entry.
"entryType": "incoming" or "outgoing" - take it from the heading/label that applies to the lines below it ("" if not stated). "materialName" and "partyName" are separate: material = what was moved, party = the company/person. Words like "advance payment" or "loading payment" are not part of either. "qty" = the quantity number only (no unit). A number in brackets after the quantity (like "Mt(3)") is a trip/vehicle count, NOT the quantity. "rate" = the price number only (drop @, /-, Rs, currency). "vehicleNo" = vehicle number exactly as written, else "".`,
  },
  production: {
    schema: table(
      { metricName: str, percentValue: str, k1Value: str, k2Value: str, totalValue: str },
      { date: str, downTimeRemarks: str }
    ),
    hint: `Daily PRODUCTION report (it may be one section of a bigger MIS page - ignore all other sections such as consumption tables, costs and down-time). Read only the production table: each row is a grade/metric with some of these value columns: percent, kiln 1, kiln 2, total. Put each number under the column header it sits below.
If the table has just ONE value column, that single quantity is the row's total: put it in "totalValue" AND in "k1Value", and leave percentValue and k2Value "". Never calculate a percentage; leave percentValue "" unless it is printed.
"downTimeRemarks" = the text written in the remarks box next to the "REMARKS" label (not the label itself, not other captions such as "feed loss time"); if only a dash is written, return "-". "date" = the report date.`,
  },
  sauda_sale: {
    schema: table({
      date: str, mainHeading: str, itemName: str, sizeMm: str, partyName: str, consigneeName: str,
      saudaQuantity: str, rateAmt: str, qtyDispatch: str, balPending: str,
      broker: str, deliveryTerms: str, paymentCondition: str, referenceName: str, remarks: str,
    }),
    hint: `SAUDA SALE sheet ("BALANCE PENDING OUTGOING"). One row per order. Columns left to right: Date, Material Name (itemName), Size (mm) (sizeMm), Party Name, Consignee Name, Sauda Qty, Rate/MT (rateAmt), Qty Dispatch, Bal. Pending, Broker, Terms of Delivery (deliveryTerms), Payment Condition, Reference Name, Remark (remarks) - match each value to the column header printed above it; blank cells stay "". The sheet has no "previous pending" column.
"mainHeading" = the bold/shaded group heading above a set of rows (e.g. DUST, Low Meg, Sponge Iron); it applies to every row under it. A heading with no order rows under it produces no rows.
Skip every TOTAL row: a shaded row that has no date and no party name and only carries the group's sums (it may be labelled "TOTAL ..." or just repeat the group name, e.g. "Sponge Iron" or "IRON ORE PELLET"). "date" = the row's own date as printed (dd.mm.yy). Copy long numbers digit by digit.`,
  },
  sauda_purchase: {
    schema: table({
      date: str, mainHeading: str, itemName: str, sizeMm: str, partyName: str,
      orderQuantity: str, rateMt: str, qtyReceived: str, balPending: str,
      broker: str, deliveryTerms: str, paymentCondition: str, referenceName: str, remarks: str,
    }),
    hint: `SAUDA PURCHASE sheet ("BALANCE PENDING INCOMING"). One row per order. Columns left to right: Date, Material Name (itemName), Size (MM) (sizeMm), Party Name, Order Qty (orderQuantity), Rate/MT in Rs (rateMt), Qty Received to till date (qtyReceived), Balance in MT (balPending), Broker Name, Terms of Delivery (deliveryTerms), Payment Condition, Reference Name, Remark (remarks) - match each value to the column header printed above it; blank cells stay "". Ignore the Expire Date column.
"mainHeading" = the bold/shaded group heading above a set of rows (e.g. IRON ORE, IRON ORE PELLET, Coal Rom/Fines, DOLOMITE); it applies to every row under it.
Skip every TOTAL row: a shaded row that has no date and no party name and only carries the group's sums (usually the group name in bold). "date" = the row's own date as printed (dd.mm.yy). Copy long numbers digit by digit.`,
  },
}

// ---------- cleaning ----------

// Common Cyrillic/Greek look-alikes the model occasionally emits inside Latin text
const LOOKALIKE = { а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i', ј: 'j', А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X' }

const cleanText = (v) =>
  String(v ?? '')
    .replace(/[Ѐ-ӿ]/g, (c) => LOOKALIKE[c] ?? c)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

// "123.600 Mt(5)" -> "123.600", "@330/-" -> "330", "30,011" -> "30011", "9100*" -> "9100", "52 FC" -> "52", "-" -> ""
export const cleanNumber = (v, allowPct = false) => {
  const s = String(v ?? '').replace(/,/g, '').replace(/[−–]/g, '-')
  const m = s.match(/-?\d+(?:\.\d+)?|-?\.\d+/)
  if (!m) return ''
  const hasPct = allowPct && new RegExp(`${m[0].replace('.', '\\.')}\\s*%`).test(s)
  return m[0] + (hasPct ? '%' : '')
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const pad = (n) => String(n).padStart(2, '0')

export const cleanDate = (v) => {
  const s = String(v ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  let m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/)
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`
  m = s.match(/(\d{1,2})[.\-/ ]+([A-Za-z]{3,9})[.\-/ ,]+(\d{2,4})/)
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3]
    return `${y}-${pad(MONTHS[m[2].slice(0, 3).toLowerCase()])}-${pad(m[1])}`
  }
  m = s.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/)
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`
  return ''
}

// Returns a cleaned copy of the model output. Never invents values: unparseable numbers become "".
export const sanitize = (page, data) => {
  const f = FIELDS[page]
  const fix = (obj) => {
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'rows') continue
      if (f.numeric.includes(k)) out[k] = cleanNumber(v)
      else if (f.pct.includes(k)) out[k] = cleanNumber(v, true)
      else if (f.date.includes(k)) out[k] = cleanDate(v)
      else out[k] = cleanText(v)
    }
    return out
  }
  let rows = (data?.rows || []).map(fix)
  if (page === 'production') {
    // Single value column (only a quantity printed on the right): the app wants it as both Kiln 1 and Total,
    // regardless of which of the two the model filled.
    rows = rows.map((r) => {
      if (r.percentValue === '' && r.k2Value === '') {
        if (r.totalValue !== '' && r.k1Value === '') return { ...r, k1Value: r.totalValue }
        if (r.k1Value !== '' && r.totalValue === '') return { ...r, totalValue: r.k1Value }
      }
      return r
    })
  }
  return { ...fix(data || {}), rows }
}

// ---------- arithmetic cross-checks (done in code, not by the model) ----------

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}
const near = (a, b, tol = 0.011) => Math.abs(a - b) <= tol

// Warnings only; a warning means "these figures don't add up, check the photo", not "wrong".
export const crossChecks = (page, data) => {
  const warnings = []
  ;(data?.rows || []).forEach((r, i) => {
    const who = r.partyName || r.material || r.metricName || ''
    const label = `Row ${i + 1}${who ? ` (${who})` : ''}`

    if (page === 'sauda_sale') {
      const s = num(r.saudaQuantity), p = num(r.prvPending), d = num(r.qtyDispatch), b = num(r.balPending)
      if (b === null || d === null) return
      const ok = [p !== null ? p - d : null, s !== null && p !== null ? s + p - d : null, s !== null ? s - d : null]
        .some((x) => x !== null && near(x, b))
      if (!ok) warnings.push(`${label}: Balance ${b} does not match Prev Pending - Dispatch (or Sauda - Dispatch).`)
    }

    if (page === 'sauda_purchase') {
      const o = num(r.orderQuantity), q = num(r.qtyReceived), b = num(r.balPending)
      if (o !== null && q !== null && b !== null && !near(o - q, b))
        warnings.push(`${label}: Order - Received = ${(o - q).toFixed(3)} but Balance shows ${b}.`)
    }

    if (page === 'stock_raw') {
      const o = num(r.openingStock), c = num(r.closingStock)
      if (o === null || c === null || num(r.production) || num(r.dispatch)) return
      const exp = o + (num(r.inward) || 0) - (num(r.consumption) || 0)
      if (!near(exp, c)) warnings.push(`${label}: Opening + Inward - Consumption = ${exp.toFixed(3)} but Closing shows ${c}.`)
    }

    if (page === 'stock_coal') {
      const o = num(r.openingStock), c = num(r.closingStock)
      if (o === null || c === null || num(r.dispatch)) return
      const base = o + (num(r.inward) || 0) - (num(r.consumption) || 0)
      const moist = num(r.moistLossPct)
      // closing may or may not have the moisture-loss quantity deducted
      if (!near(base, c) && !(moist !== null && near(base - moist, c)))
        warnings.push(`${label}: Opening + Inward - Consumption = ${base.toFixed(3)} but Closing shows ${c}.`)
    }

    if (page === 'production') {
      const a = num(r.k1Value), b = num(r.k2Value), t = num(r.totalValue)
      if (a !== null && b !== null && t !== null && !near(a + b, t, 0.02))
        warnings.push(`${label}: Kiln1 + Kiln2 = ${(a + b).toFixed(3)} but Total shows ${t}.`)
    }
  })
  return warnings
}
