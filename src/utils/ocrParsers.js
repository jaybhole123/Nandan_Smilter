/**
 * OCR Text Parsers for each page module.
 * These functions take raw OCR text and extract structured data
 * to auto-fill form fields.
 */

// --- Common Helpers ---
const cleanNumber = (str) => {
  if (!str) return ''
  // Remove everything except digits, dots, and minus
  const cleaned = str.replace(/[^0-9.\-]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? '' : String(num)
}

const extractDate = (text) => {
  // Try to find date patterns: DD.MM.YY, DD/MM/YYYY, DD-MM-YY, etc.
  const datePatterns = [
    /(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/,
    /(\d{4})[.\/\-](\d{1,2})[.\/\-](\d{1,2})/  // YYYY-MM-DD
  ]
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match) {
      let d, m, y
      if (match[1].length === 4) {
        // YYYY-MM-DD format
        y = match[1]
        m = match[2].padStart(2, '0')
        d = match[3].padStart(2, '0')
      } else {
        d = match[1].padStart(2, '0')
        m = match[2].padStart(2, '0')
        y = match[3]
        if (y.length === 2) y = '20' + y
      }
      return `${y}-${m}-${d}`
    }
  }
  return new Date().toISOString().split('T')[0]
}

const findLineContaining = (lines, keyword) => {
  return lines.find(l => l.toUpperCase().includes(keyword.toUpperCase())) || ''
}

const extractValueAfterKeyword = (text, keyword) => {
  const regex = new RegExp(keyword + '[:\\s]*([^\\n]+)', 'i')
  const match = text.match(regex)
  return match ? match[1].trim() : ''
}

// ==========================================
// 1. Sauda Sale (Sale) Parser
// ==========================================
export const parseSaudaSaleOCR = (rawText) => {
  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const result = {
    date: extractDate(rawText),
    mainHeading: '',
    itemName: '',
    sizeMm: '',
    partyName: '',
    consigneeName: '',
    saudaQuantity: '',
    rateAmt: '',
    prvPending: '',
    qtyDispatch: '',
    balPending: '',
    broker: '',
    deliveryTerms: '',
    paymentCondition: '',
    referenceName: '',
    remarks: '',
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  const clean = value =>
    (value || '')
      .replace(/\s+/g, ' ')
      .replace(/[|]+/g, '')
      .trim()

  const cleanNumber = value =>
    clean(value)
      .replace(/,/g, '')
      .replace(/[^\d.-]/g, '')

  const isNumber = value =>
    /^-?\d+(?:\.\d+)?$/.test(cleanNumber(value))

  const isDate = value =>
    /^\d{2}[./-]\d{2}[./-]\d{2,4}$/.test(clean(value))

  const normalizeDate = value =>
    clean(value).replace(/[./]/g, '-')

  const dateRegex = /^\s*(\d{2}[./-]\d{2}[./-]\d{2,4})\s+/

  // ------------------------------------------------------------
  // Main heading
  // ------------------------------------------------------------

  const headingLine = lines.find(line =>
    /BALANCE\s+PENDING\s+OUTGOING/i.test(line)
  )

  if (headingLine) {
    result.mainHeading = clean(headingLine)
  }

  // ------------------------------------------------------------
  // Section / material detection
  // ------------------------------------------------------------

  const knownSections = [
    'DUST',
    'DOLOCHAR',
    'IRON ORE FINES',
    'SPONGE IRON PELLET',
    'SPONGE IRON',
    'IRON ORE PELLET',
  ]

  let currentSection = ''

  // ------------------------------------------------------------
  // Transaction-row parser
  //
  // Expected structure:
  //
  // DATE
  // MATERIAL
  // SIZE
  // PARTY
  // CONSIGNEE
  // SAUDA QTY
  // RATE
  // QTY DISPATCH
  // BAL PENDING
  // BROKER
  // DELIVERY
  // PAYMENT
  // REFERENCE
  // REMARK
  // ------------------------------------------------------------

  const transactions = []

  for (const line of lines) {
    const upper = line.toUpperCase()

    // Ignore header / total rows
    if (
      upper.startsWith('TOTAL ') ||
      upper.includes('MATERIAL NAME') ||
      upper.includes('SAUDA QTY') ||
      upper.includes('BALANCE PENDING OUTGOING')
    ) {
      continue
    }

    // ----------------------------------------------------------
    // Detect section heading
    // ----------------------------------------------------------

    const sectionMatch = knownSections.find(section => {
      return upper === section || upper.startsWith(section + ' ')
    })

    if (sectionMatch) {
      currentSection = sectionMatch
      continue
    }

    // ----------------------------------------------------------
    // Only transaction rows start with a date.
    // ----------------------------------------------------------

    const dateMatch = line.match(dateRegex)

    if (!dateMatch) {
      continue
    }

    const transactionDate = normalizeDate(dateMatch[1])

    // Remove date from beginning
    let remaining = line
      .slice(dateMatch[0].length)
      .trim()

    // ----------------------------------------------------------
    // Extract the numeric fields from RIGHT TO LEFT.
    //
    // The last numeric block before textual fields is:
    //
    // SAUDA QTY | RATE | QTY DISPATCH | BAL PENDING
    //
    // But because the OCR collapses whitespace, we first locate
    // the first 4 numeric values after the material/party area.
    // ----------------------------------------------------------

    const tokens = remaining.split(/\s+/)

    // Find numeric tokens.
    const numericIndexes = []

    tokens.forEach((token, index) => {
      const normalized = token.replace(/,/g, '')

      if (/^\d+(?:\.\d+)?$/.test(normalized)) {
        numericIndexes.push(index)
      }
    })

    if (numericIndexes.length < 4) {
      // Not enough numeric columns to safely parse this row.
      continue
    }

    // ----------------------------------------------------------
    // The transaction's four numeric columns are consecutive
    // in this OCR format.
    //
    // Example:
    // 1000.00 40 319.300 680.70
    //
    // or:
    // 2000.00 5,000 1309.240 690.760
    // ----------------------------------------------------------

    let numericStart = -1

    for (let i = 0; i <= numericIndexes.length - 4; i++) {
      const a = numericIndexes[i]
      const b = numericIndexes[i + 1]
      const c = numericIndexes[i + 2]
      const d = numericIndexes[i + 3]

      // They should be adjacent tokens.
      if (
        b === a + 1 &&
        c === b + 1 &&
        d === c + 1
      ) {
        numericStart = a
        break
      }
    }

    if (numericStart === -1) {
      continue
    }

    const saudaQty = tokens[numericStart]
    const rateAmt = tokens[numericStart + 1]
    const qtyDispatch = tokens[numericStart + 2]
    const balPending = tokens[numericStart + 3]

    // ----------------------------------------------------------
    // Everything before numeric columns:
    //
    // MATERIAL + SIZE + PARTY + CONSIGNEE
    // ----------------------------------------------------------

    const leftTokens = tokens.slice(0, numericStart)

    // Material is normally first part.
    //
    // We know the material from the document's section, but also
    // preserve the actual row material where possible.
    let rowMaterial = ''
    let sizeMm = ''
    let partyName = ''
    let consigneeName = ''

    // ----------------------------------------------------------
    // Find size token.
    //
    // Examples:
    // "-"
    // "0-20"
    // ----------------------------------------------------------

    const sizeIndex = leftTokens.findIndex(token =>
      token === '-' ||
      /^\d+(?:-\d+)?$/.test(token)
    )

    if (sizeIndex >= 0) {
      sizeMm = leftTokens[sizeIndex]
    }

    // ----------------------------------------------------------
    // Determine material.
    //
    // Since party names can contain many words, the safest way
    // is to use the current section and search for it in the row.
    // ----------------------------------------------------------

    if (currentSection) {
      const sectionWords = currentSection
        .toLowerCase()
        .split(/\s+/)

      const lowerLine = line.toLowerCase()

      const sectionPosition = lowerLine.indexOf(
        sectionWords.join(' ')
      )

      if (sectionPosition >= 0) {
        rowMaterial = currentSection
      }
    }

    // Better OCR aliases for material.
    if (!rowMaterial) {
      const materialAliases = [
        'ESP Dust',
        'Dolochar',
        'I/O Fines',
        'Iron Ore Fines',
        'Sponge Pellet',
        'Sponge Iron',
        'Iron Ore Pellet',
      ]

      const foundMaterial = materialAliases.find(material =>
        remaining.toLowerCase().startsWith(material.toLowerCase())
      )

      rowMaterial = foundMaterial || currentSection
    }

    // ----------------------------------------------------------
    // Parse text between size and numeric block.
    //
    // This contains PARTY + CONSIGNEE.
    // ----------------------------------------------------------

    let textBeforeNumbers = leftTokens

    // Remove material tokens from the front where possible.
    if (rowMaterial) {
      const materialParts = rowMaterial.split(/\s+/)

      const firstPartsMatch = textBeforeNumbers
        .slice(0, materialParts.length)
        .join(' ')
        .toLowerCase()

      if (
        firstPartsMatch === rowMaterial.toLowerCase()
      ) {
        textBeforeNumbers = textBeforeNumbers.slice(
          materialParts.length
        )
      }
    }

    // Remove size.
    if (sizeIndex >= 0) {
      const sizePos = textBeforeNumbers.findIndex(
        token => token === sizeMm
      )

      if (sizePos >= 0) {
        textBeforeNumbers = textBeforeNumbers.slice(sizePos + 1)
      }
    }

    // ----------------------------------------------------------
    // For this report CONSIGNEE is usually "-"
    // and PARTY occupies the remaining text.
    // ----------------------------------------------------------

    if (textBeforeNumbers.length) {
      const dashIndex = textBeforeNumbers.indexOf('-')

      if (dashIndex >= 0) {
        partyName = clean(
          textBeforeNumbers.slice(0, dashIndex).join(' ')
        )

        consigneeName = clean(
          textBeforeNumbers
            .slice(dashIndex + 1)
            .join(' ')
        )
      } else {
        partyName = clean(textBeforeNumbers.join(' '))
      }
    }

    // ----------------------------------------------------------
    // Text after the four numeric columns
    //
    // BROKER
    // DELIVERY
    // PAYMENT
    // REFERENCE
    // REMARK
    // ----------------------------------------------------------

    const afterNumbers = tokens
      .slice(numericStart + 4)
      .join(' ')

    /*
      The remaining fields are difficult to split purely by
      whitespace because values themselves contain spaces.

      We therefore use known report vocabulary where possible.
    */

    let broker = ''
    let deliveryTerms = ''
    let paymentCondition = ''
    let referenceName = ''
    let remarks = ''

    const knownDeliveryTerms = [
      'Ex-Plant',
      'Next Day',
      'Ex Plant',
    ]

    const knownPaymentTerms = [
      'Advance',
      'Loading Paym',
      'Loading Payment',
    ]

    // Find delivery
    const deliveryMatch = knownDeliveryTerms.find(term =>
      afterNumbers.toLowerCase().includes(term.toLowerCase())
    )

    if (deliveryMatch) {
      deliveryTerms = deliveryMatch
    }

    // Find payment
    const paymentMatch = knownPaymentTerms.find(term =>
      afterNumbers.toLowerCase().includes(term.toLowerCase())
    )

    if (paymentMatch) {
      paymentCondition = paymentMatch
    }

    // ----------------------------------------------------------
    // Reference names commonly end before a remark.
    // Use known "Sir" pattern.
    // ----------------------------------------------------------

    const sirMatch = afterNumbers.match(
      /([A-Za-z][A-Za-z0-9&().+\- ]*?\bSir)\b/i
    )

    if (sirMatch) {
      referenceName = clean(sirMatch[1])
    }

    // ----------------------------------------------------------
    // Broker
    //
    // Extract text before delivery term.
    // ----------------------------------------------------------

    if (deliveryMatch) {
      const deliveryPos = afterNumbers
        .toLowerCase()
        .indexOf(deliveryMatch.toLowerCase())

      if (deliveryPos >= 0) {
        broker = clean(
          afterNumbers.slice(0, deliveryPos)
        )
      }
    }

    // ----------------------------------------------------------
    // Remarks
    //
    // Anything after the reference name can be treated as remark.
    // ----------------------------------------------------------

    if (sirMatch) {
      const referenceEnd =
        sirMatch.index + sirMatch[0].length

      const remainder = clean(
        afterNumbers.slice(referenceEnd)
      )

      if (remainder) {
        remarks = remainder
      }
    }

    // ----------------------------------------------------------
    // Special case:
    // "W" / "Fe (T) 58" etc. are OCR remarks.
    // ----------------------------------------------------------

    if (!remarks) {
      const remarkMatch = afterNumbers.match(
        /\b(W|Fe\s*\(T\)\s*\d+(?:\.\d+)?)\b/i
      )

      if (remarkMatch) {
        remarks = clean(remarkMatch[0])
      }
    }

    // ----------------------------------------------------------
    // Save transaction
    // ----------------------------------------------------------

    transactions.push({
      date: transactionDate,
      mainHeading: result.mainHeading,
      itemName: rowMaterial || currentSection,
      sizeMm: clean(sizeMm),
      partyName: clean(partyName),
      consigneeName: clean(consigneeName),
      saudaQuantity: cleanNumber(saudaQty),
      rateAmt: cleanNumber(rateAmt),
      prvPending: '',
      qtyDispatch: cleanNumber(qtyDispatch),
      balPending: cleanNumber(balPending),
      broker,
      deliveryTerms,
      paymentCondition,
      referenceName,
      remarks,
    })
  }

  return {
    ...result,
    transactions,
  }
}

// ==========================================
// 2. SAUDA PURCHASE Parser
// ==========================================
export const parseSaudaPurchaseOCR = (rawText) => {
  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const clean = (value) =>
    (value ?? '')
      .replace(/\s+/g, ' ')
      .trim()

  const cleanNumber = (value) =>
    clean(value)
      .replace(/,/g, '')
      .replace(/[^\d.-]/g, '')

  const isNumeric = (value) =>
    /^\d+(?:\.\d+)?$/.test(
      clean(value).replace(/,/g, '')
    )

  const normalizeDate = (value) => {
    const parts = clean(value)
      .replace(/[./]/g, '-')
      .split('-')

    if (parts.length !== 3) return ''

    let [day, month, year] = parts

    if (year.length === 2) {
      year = `20${year}`
    }

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // ------------------------------------------------------------
  // SIZE DETECTION
  //
  // Handles:
  // (10-40)
  // (10 - 40)
  // 10-40
  // 10 - 40
  // 10–40
  // (10–40)
  // ------------------------------------------------------------

  const extractSize = (text) => {
    const normalized = clean(text)
      .replace(/[–—]/g, '-')

    const match = normalized.match(
      /\(?\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*\)?/i
    )

    if (!match) {
      return {
        sizeMm: '',
        start: -1,
        end: -1,
      }
    }

    return {
      sizeMm: `(${match[1]}-${match[2]})`,
      start: match.index,
      end: match.index + match[0].length,
    }
  }

  const result = {
    date: normalizeDate(extractDate(rawText)),
    mainHeading: '',
    itemName: '',
    sizeMm: '',
    partyName: '',
    orderQuantity: '',
    rateMt: '',
    qtyReceived: '',
    balPending: '',
    broker: '',
    deliveryTerms: '',
    paymentCondition: '',
    referenceName: '',
    remarks: '',
    transactions: [],
  }

  // ------------------------------------------------------------
  // MAIN HEADING
  // ------------------------------------------------------------

  const headingMatch = rawText.match(
    /BALANCE\s+PENDING\s+INCOMING\s*\(SAUDA\s+PURCHASE\)/i
  )

  if (headingMatch) {
    result.mainHeading = clean(headingMatch[0])
  }

  // ------------------------------------------------------------
  // SECTIONS
  // ------------------------------------------------------------

  const knownSections = [
    'IRON ORE PELLET',
    'IRON ORE',
    'COAL ROM/FINES',
    'DOLOMITE',
  ]

  const knownMaterials = [
    'Iron Ore Pellet',
    'Iron Ore',
    'Rom Coal(Gevra)',
    'Rom Coal(Dipika)',
    'Rom Coal(Jagarnathpur)',
    'Rom Coal(khaira)',
    'Rom Coal',
    'Coal Fines',
    'DOLOMITE',
  ]

  let currentSection = ''

  // ------------------------------------------------------------
  // NUMERIC BLOCK
  //
  // ORDER QTY
  // RATE/MT
  // QTY RECEIVED
  // BALANCE
  // ------------------------------------------------------------

  const findNumericBlock = (tokens) => {
    for (let i = 0; i <= tokens.length - 4; i++) {
      if (
        isNumeric(tokens[i]) &&
        isNumeric(tokens[i + 1]) &&
        isNumeric(tokens[i + 2]) &&
        isNumeric(tokens[i + 3])
      ) {
        return {
          start: i,
          orderQuantity: tokens[i],
          rateMt: tokens[i + 1],
          qtyReceived: tokens[i + 2],
          balPending: tokens[i + 3],
        }
      }
    }

    return null
  }

  // ------------------------------------------------------------
  // MATERIAL DETECTION
  // ------------------------------------------------------------

  const detectMaterial = (prefixText) => {
    const text = clean(prefixText)

    const sorted = [...knownMaterials].sort(
      (a, b) => b.length - a.length
    )

    const material = sorted.find(name =>
      text.toLowerCase().startsWith(
        name.toLowerCase()
      )
    )

    if (material) {
      return {
        material,
        textAfterMaterial: clean(
          text.slice(material.length)
        ),
      }
    }

    // If no exact material found, use current section.
    return {
      material: currentSection,
      textAfterMaterial: text,
    }
  }

  // ------------------------------------------------------------
  // TRAILING FIELDS
  // ------------------------------------------------------------

  const parseTrailingFields = (tokens) => {
    let broker = ''
    let deliveryTerms = ''
    let paymentCondition = ''
    let referenceName = ''
    let remarks = ''

    if (!tokens.length) {
      return {
        broker,
        deliveryTerms,
        paymentCondition,
        referenceName,
        remarks,
      }
    }

    const text = clean(tokens.join(' '))

    // ----------------------------------------------------------
    // DELIVERY
    // ----------------------------------------------------------

    const deliveryMatch = text.match(
      /\b(Ex-Plant|Ex\s*Plant|For|Next\s*Day)\b/i
    )

    if (deliveryMatch) {
      deliveryTerms = clean(deliveryMatch[1])

      broker = clean(
        text.slice(0, deliveryMatch.index)
      )
    }

    // ----------------------------------------------------------
    // PAYMENT
    // ----------------------------------------------------------

    const paymentMatch = text.match(
      /\b(Advance|Against\s+Payment|Loading\s+Payment|Loading\s+Paym)\b/i
    )

    if (paymentMatch) {
      paymentCondition = clean(paymentMatch[1])
    }

    // ----------------------------------------------------------
    // REFERENCE
    // ----------------------------------------------------------

    const referenceMatch = text.match(
      /\b([A-Za-z][A-Za-z0-9.&()'/-]*(?:\s+[A-Za-z][A-Za-z0-9.&()'/-]*){0,3}\s+Sir)\b/i
    )

    if (referenceMatch) {
      referenceName = clean(referenceMatch[1])

      const end =
        referenceMatch.index +
        referenceMatch[0].length

      remarks = clean(text.slice(end))
    }

    // ----------------------------------------------------------
    // REMARKS
    // ----------------------------------------------------------

    if (!referenceName) {
      const remarkPatterns = [
        /\bComp\.?\b/i,
        /\d+\s*-\s*\d+\s*FC/i,
        /\d+\s*FC\s*\+\/-\s*\d+/i,
        /\d+\s*FC/i,
      ]

      for (const regex of remarkPatterns) {
        const match = text.match(regex)

        if (match) {
          remarks = clean(match[0])
          break
        }
      }
    }

    return {
      broker,
      deliveryTerms,
      paymentCondition,
      referenceName,
      remarks,
    }
  }

  // ------------------------------------------------------------
  // TRANSACTION ROW
  // ------------------------------------------------------------

  const parseTransactionLine = (line) => {
    const dateMatch = line.match(
      /^\s*(\d{2}[./-]\d{2}[./-]\d{2,4})/
    )

    if (!dateMatch) {
      return null
    }

    const date = normalizeDate(dateMatch[1])

    const remaining = line
      .slice(dateMatch[0].length)
      .trim()

    // ----------------------------------------------------------
    // Preserve tabs when available.
    // ----------------------------------------------------------

    let tokens

    if (line.includes('\t')) {
      tokens = remaining
        .split(/\t+/)
        .map(clean)
        .filter(Boolean)
    } else {
      tokens = remaining
        .split(/\s+/)
        .map(clean)
        .filter(Boolean)
    }

    // ----------------------------------------------------------
    // Find numeric block
    // ----------------------------------------------------------

    const numericBlock = findNumericBlock(tokens)

    if (!numericBlock) {
      return null
    }

    // Everything before ORDER QTY
    const prefixTokens = tokens.slice(
      0,
      numericBlock.start
    )

    const trailingTokens = tokens.slice(
      numericBlock.start + 4
    )

    const prefixText = clean(
      prefixTokens.join(' ')
    )

    // ----------------------------------------------------------
    // MATERIAL
    // ----------------------------------------------------------

    const materialInfo =
      detectMaterial(prefixText)

    const itemName =
      materialInfo.material || currentSection

    let beforeParty =
      materialInfo.textAfterMaterial

    // ----------------------------------------------------------
    // SIZE
    //
    // THIS IS THE IMPORTANT FIX.
    //
    // We search the complete prefix string instead of checking
    // individual tokens.
    // ----------------------------------------------------------

    const sizeInfo =
      extractSize(beforeParty)

    let sizeMm = ''
    let partyName = ''

    if (sizeInfo.sizeMm) {
      sizeMm = sizeInfo.sizeMm

      partyName = clean(
        beforeParty
          .slice(sizeInfo.end)
      )
    } else {
      partyName = clean(beforeParty)
    }

    // ----------------------------------------------------------
    // TRAILING COLUMNS
    // ----------------------------------------------------------

    const trailing =
      parseTrailingFields(trailingTokens)

    return {
      date,

      mainHeading:
        result.mainHeading,

      itemName,

      sizeMm,

      partyName,

      orderQuantity:
        cleanNumber(
          numericBlock.orderQuantity
        ),

      rateMt:
        cleanNumber(
          numericBlock.rateMt
        ),

      qtyReceived:
        cleanNumber(
          numericBlock.qtyReceived
        ),

      balPending:
        cleanNumber(
          numericBlock.balPending
        ),

      broker:
        trailing.broker || '',

      deliveryTerms:
        trailing.deliveryTerms || '',

      paymentCondition:
        trailing.paymentCondition || '',

      referenceName:
        trailing.referenceName || '',

      remarks:
        trailing.remarks || '',
    }
  }

  // ------------------------------------------------------------
  // PROCESS DOCUMENT
  // ------------------------------------------------------------

  for (const line of lines) {
    const upper = line.toUpperCase()

    // Skip headers
    if (
      upper.includes('BALANCE PENDING INCOMING') ||
      upper.includes('MATERIAL NAME') ||
      upper.includes('ODER QTY') ||
      upper.includes('ORDER QTY')
    ) {
      continue
    }

    // Skip total rows
    if (/^TOTAL\b/i.test(line)) {
      continue
    }

    // ----------------------------------------------------------
    // Section
    // ----------------------------------------------------------

    const section = knownSections.find(
      section =>
        upper === section ||
        upper.startsWith(section + ' ')
    )

    if (section) {
      currentSection = section
      continue
    }

    // ----------------------------------------------------------
    // Transaction
    // ----------------------------------------------------------

    const transaction =
      parseTransactionLine(line)

    if (transaction) {
      result.transactions.push(transaction)
    }
  }

  // ------------------------------------------------------------
  // First transaction convenience fields
  // ------------------------------------------------------------

  const first = result.transactions[0]

  if (first) {
    result.itemName = first.itemName
    result.sizeMm = first.sizeMm
    result.partyName = first.partyName
    result.orderQuantity = first.orderQuantity
    result.rateMt = first.rateMt
    result.qtyReceived = first.qtyReceived
    result.balPending = first.balPending
    result.broker = first.broker
    result.deliveryTerms = first.deliveryTerms
    result.paymentCondition = first.paymentCondition
    result.referenceName = first.referenceName
    result.remarks = first.remarks
  }

  return result
}

// ==========================================
// 3. ITEM TRANSFER Parser
// ==========================================
export const parseItemTransferOCR = (rawText) => {
  const cleanNumber = (value) => {
    if (value === null || value === undefined || value === '') {
      return ''
    }

    return String(value)
      .replace(/,/g, '')
      .trim()
  }

  const result = []

  if (!rawText || typeof rawText !== 'string') {
    return result
  }

  const lines = rawText
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  let currentType = null

  // -----------------------------
  // Extract date
  // -----------------------------
  let reportDate = ''

  const dateMatch = rawText.match(
    /DATE\s*[:-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i
  )

  if (dateMatch) {
    reportDate = dateMatch[1]
  }

  // -----------------------------
  // Process lines
  // -----------------------------
  for (const line of lines) {
    const upper = line.toUpperCase()

    // Section
    if (upper === 'INCOMING') {
      currentType = 'incoming'
      continue
    }

    if (upper === 'OUTGOING') {
      currentType = 'outgoing'
      continue
    }

    // Ignore headers
    if (
      upper.includes('S.NO') ||
      upper.includes('PARTY NAME') ||
      upper.includes('MATERIAL NAME') ||
      upper.includes('VEHICLE NO')
    ) {
      continue
    }

    // -----------------------------------------
    // Row:
    // 1 JBT (NECO) Iron Ore Pellet 3 115.460 8850
    // -----------------------------------------
    const rowMatch = line.match(
      /^(\d+)\s+(.+?)\s+(\d+)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/
    )

    if (!rowMatch || !currentType) {
      continue
    }

    const serialNo = rowMatch[1]
    const middle = rowMatch[2].trim()
    const vehicleNo = rowMatch[3]
    const qty = rowMatch[4]
    const rate = rowMatch[5]

    // -----------------------------------------
    // Party + Material
    // -----------------------------------------
    let partyName = ''
    let materialName = ''

    const parts = middle
      .split(/\s{2,}/)
      .map(x => x.trim())
      .filter(Boolean)

    if (parts.length >= 2) {
      partyName = parts[0]
      materialName = parts.slice(1).join(' ')
    } else {
      // OCR fallback
      const words = middle.split(/\s+/)

      if (words.length >= 2) {
        partyName = words.slice(0, -1).join(' ')
        materialName = words[words.length - 1]
      } else {
        partyName = middle
      }
    }

    result.push({
      type: currentType,
      reportDate,
      serialNo,
      partyName,
      materialName,
      vehicleNo,
      qty: cleanNumber(qty),
      rate: cleanNumber(rate)
    })
  }

  return result
}

// ==========================================
// 4. STOCK Parser (Raw Material)
// ==========================================
export const parseStockOCR = (rawText) => {
  const text = rawText
    .replace(/&#x20;/g, ' ')
    .replace(/\r/g, '')

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  // Matches:
  // 0
  // 0.000
  // 3799.954
  // 1,331.10
  // -10.50
  const numberRegex = /-?\d[\d,]*(?:\.\d+)?/g

  const clean = (value) => {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return ''
    }

    return cleanNumber(
      String(value).replace(/,/g, '')
    )
  }

  /*
   * IMPORTANT:
   *
   * Extract numbers ONLY when they are outside parentheses.
   *
   * Therefore:
   *
   * Om Sponge Driclo(10-40) 0.000 0.000 0.000
   *
   * returns:
   *
   * 0.000
   * 0.000
   * 0.000
   *
   * instead of:
   *
   * 10
   * 40
   * 0.000
   * 0.000
   * 0.000
   */
  const getNumbersOutsideParentheses = (line) => {
    const matches = [...line.matchAll(numberRegex)]

    return matches.filter(match => {
      const before = line.slice(0, match.index)

      let depth = 0

      for (const char of before) {
        if (char === '(') depth++
        if (char === ')') depth--
      }

      return depth === 0
    }).map(match => ({
      value: match[0],
      index: match.index
    }))
  }

  const results = []

  for (const line of lines) {

    // ---------------------------------------------
    // Ignore report headers
    // ---------------------------------------------

    if (
      /RAW MATERIAL STOCK/i.test(line) ||
      /AS ON DATE/i.test(line) ||
      /MATERIAL\s+OPENING\s+STOCK/i.test(line)
    ) {
      continue
    }

    // ---------------------------------------------
    // Ignore dates
    // ---------------------------------------------

    if (
      /^\d{1,2}\/\d{1,2}\/\d{4}/.test(line)
    ) {
      continue
    }

    // ---------------------------------------------
    // Ignore section headings
    // ---------------------------------------------

    if (
      /^(?:RAW IRON ORE|RAW PELLET ORE|PROCESSED IRON ORE(?:\s*\(.*\))?|IRON FINES)$/i.test(
        line
      )
    ) {
      continue
    }

    // ---------------------------------------------
    // Ignore TOTAL rows
    // ---------------------------------------------

    if (/^TOTAL\b/i.test(line)) {
      continue
    }

    // ---------------------------------------------
    // Get numbers OUTSIDE parentheses
    // ---------------------------------------------

    const numbers = getNumbersOutsideParentheses(line)

    if (numbers.length < 2) {
      continue
    }

    // ---------------------------------------------
    // Material = everything before first
    // real stock number
    // ---------------------------------------------

    const firstNumber = numbers[0]

    const material = line
      .slice(0, firstNumber.index)
      .trim()
      .replace(/^[-–—]+\s*/, '')
      .trim()

    if (!material) {
      continue
    }

    // ---------------------------------------------
    // Crushing percentage
    // ---------------------------------------------

    const crushingMatch = line.match(
      /(\d+(?:\.\d+)?)\s*%/
    )

    const crushing = crushingMatch
      ? `${crushingMatch[1]}%`
      : '0%'

    // ---------------------------------------------
    // Remove percentage numbers
    // ---------------------------------------------

    const values = numbers
      .map(n => n.value)
      .filter(value => {
        const regex = new RegExp(
          `${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*%`
        )

        return !regex.test(line)
      })

    // ---------------------------------------------
    // Default result
    // ---------------------------------------------

    const result = {
      material,
      openingStock: '',
      inward: '',
      consumption: '',
      crushing,
      fines3: '0%',
      fines3Qty: '0',
      production: '',
      dispatch: '',
      closingStock: '',
      unit: 'ton',
      remarks: '',
    }

    // ---------------------------------------------
    // Standard RAW MATERIAL row
    //
    // Example:
    //
    // Lloyd Ore (10-40)
    // 3799.954 343.280 0.000 18%
    // 0.000 0.000 4143.234
    // ---------------------------------------------

    if (crushingMatch && values.length >= 6) {

      result.openingStock = clean(values[0])

      result.inward = clean(values[1])

      result.consumption = clean(values[2])

      /*
       * Remaining values depend on the table columns.
       *
       * For now:
       *
       * values[3] = fines/screen quantity
       * values[4] = fines(-3) quantity
       * last      = closing
       */

      result.fines3Qty = clean(values[4])

      result.closingStock = clean(
        values[values.length - 1]
      )
    }

    // ---------------------------------------------
    // IRON FINES
    //
    // Lloyds fines
    // 989.915 0.000 989.915
    // ---------------------------------------------

    else if (!crushingMatch && values.length === 3) {

      result.openingStock = clean(values[0])

      result.inward = clean(values[1])

      result.closingStock = clean(values[2])
    }

    // ---------------------------------------------
    // Generic fallback
    // ---------------------------------------------

    else if (values.length >= 3) {

      result.openingStock = clean(values[0])

      result.inward = clean(values[1])

      result.consumption = clean(values[2])

      result.closingStock = clean(
        values[values.length - 1]
      )
    }

    else if (values.length === 2) {

      result.openingStock = clean(values[0])

      result.closingStock = clean(values[1])
    }

    results.push(result)
  }

  return results
}

// ==========================================
// 5. STOCK Parser (Coal Detail)
// ==========================================
export const parseCoalStockOCR = (rawText) => {
  const lines = rawText
    .replace(/&#x20;/g, ' ')
    .split(/\r?\n/)

  // Only parse rows before TOTAL COAL
  const totalCoalIndex = lines.findIndex(line =>
    /\bTOTAL\s+COAL\b/i.test(line)
  )

  const coalLines =
    totalCoalIndex >= 0
      ? lines.slice(0, totalCoalIndex)
      : lines

  // Materials that must not be treated as coal rows
  const nonCoalMaterial =
    /\b(?:DOLOMITE|CHAR|DOLUCHAR|SPONGE\s+PELLET|SPONGE\s+IRON|ESP\s+DUST|BAG\s+FILTER\s+DUST)\b/i

  // Number regex:
  // 167.260
  // 0.000
  // 36.680
  // 39
  // 1,234.50
  const numberRegex = /-?\d[\d,]*(?:\.\d+)?/g

  const rows = []

  for (const line of coalLines) {
    const trimmedLine = line.trim()

    if (!trimmedLine) continue

    // Ignore headers
    if (
      /^(?:COAL\s+DETAILS|OPENING\s+STOCK|MATERIAL)\b/i.test(trimmedLine)
    ) {
      continue
    }

    // Ignore non-coal materials
    if (nonCoalMaterial.test(trimmedLine)) {
      continue
    }

    /*
     * FC pattern:
     *
     * 36.680     34 FC
     * 24.460     32 FC
     * 39 FC
     * 30.570     38 FC
     *
     * We specifically look for:
     * NUMBER + FC
     */
    const fcMatch = trimmedLine.match(
      /(-?\d[\d,]*(?:\.\d+)?)\s*FC\b/i
    )

    if (!fcMatch) {
      continue
    }

    const fcValue = fcMatch[1]

    // Position of the FC number within the original line
    const fcIndex = trimmedLine.indexOf(fcValue, fcMatch.index)

    /*
     * Everything before FC contains:
     *
     * material
     * opening
     * inward
     * consumption
     *
     * Depending on OCR, consumption may be missing.
     */
    const beforeFc = trimmedLine.slice(0, fcIndex)

    const beforeNumbers = [...beforeFc.matchAll(numberRegex)]
      .filter(match => {
        const prefix = beforeFc.slice(0, match.index)
        return (prefix.match(/\(/g) || []).length <= (prefix.match(/\)/g) || []).length
      })

    if (beforeNumbers.length < 2) {
      continue
    }

    /*
     * The material is everything before the first numeric value.
     */
    const firstNumber = beforeNumbers[0]

    const material = beforeFc
      .slice(0, firstNumber.index)
      .trim()

    if (!material) continue

    /*
     * Values before FC:
     *
     * Normal:
     * opening, inward, consumption
     *
     * Example:
     * 167.260  0.000  36.680  34 FC
     *
     * Missing consumption:
     * 137.470  0.000  39 FC
     */
    const valuesBeforeFc = beforeNumbers.map(match => match[0])

    const opening = valuesBeforeFc[0]
    const inward = valuesBeforeFc[1]

    let consumption = ''

    if (valuesBeforeFc.length >= 3) {
      consumption = valuesBeforeFc[2]
    }

    /*
     * Everything after "FC" contains:
     *
     * moist loss
     * landed cost
     * closing stock
     *
     * Example:
     *
     * 1.330 - 130.580
     *
     * OR
     *
     * - 1.109 - 106.900
     *
     * "-" is ignored.
     */
    const afterFc = trimmedLine.slice(
      fcIndex + fcValue.length
    )

    const suffixNumbers = [...afterFc.matchAll(numberRegex)]

    if (suffixNumbers.length === 0) {
      continue
    }

    /*
     * Your OCR format has:
     *
     * Moist Loss | Landed Cost | Closing Stock
     *
     * But "-" means no landed cost.
     *
     * Examples:
     *
     * 1.330 - 130.580
     * => moistLoss = 1.330
     * => landedCost = ''
     * => closing = 130.580
     *
     * 1.109 - 106.900
     * => same
     *
     * 0.000 - 1987.100
     * => same
     */

    const suffixValues = suffixNumbers.map(match => match[0])

    let moistLoss = ''
    let landedCost = ''
    let closing = ''

    if (suffixValues.length === 1) {
      // Only closing stock found
      closing = suffixValues[0]
    } else if (suffixValues.length === 2) {
      // Moist Loss + Closing Stock
      moistLoss = suffixValues[0]
      closing = suffixValues[1]
    } else {
      // Moist Loss + Landed Cost + Closing Stock
      moistLoss = suffixValues[0]
      landedCost = suffixValues[1]
      closing = suffixValues[suffixValues.length - 1]
    }

    rows.push({
      material,

      openingStock: cleanNumber(opening),

      inward: cleanNumber(inward),

      consumption: consumption
        ? cleanNumber(consumption)
        : '',

      fc: cleanNumber(fcValue),

      moistLossPct: moistLoss
        ? cleanNumber(moistLoss)
        : '',

      dispatch: '',

      landedCost: landedCost
        ? cleanNumber(landedCost)
        : '',

      closingStock: cleanNumber(closing),
    })
  }

  return rows
}

// ==========================================
// 6. PRODUCTION Parser
// ==========================================
export const parseProductionOCR = (rawText) => {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l)
  
  const rows = []
  let remarks = ''

  for (const line of lines) {
    // Check for remarks
    if (line.toUpperCase().includes('REMARK') || line.toUpperCase().includes('DOWN TIME')) {
      remarks = line.replace(/.*remarks?\s*:?\s*/i, '').trim()
      continue
    }

    // Skip header lines
    if (line.toUpperCase().includes('PRODUCTION') || 
        line.toUpperCase().includes('METRIC') || 
        line.toUpperCase().includes('GRADE') && line.toUpperCase().includes('K-')) {
      continue
    }

    // Try to parse data rows: "Label Number Number Number Number"
    const tokens = line.split(/\s+/)
    const numberTokens = tokens.filter(t => /^-?[\d,]+(\.\d+)?%?$/.test(t))
    
    if (numberTokens.length >= 2) {
      const labelTokens = tokens.filter(t => !/^-?[\d,]+(\.\d+)?%?$/.test(t))
      const label = labelTokens.join(' ') || line

      rows.push({
        id: Date.now() + Math.random(),
        metricName: label,
        percentValue: numberTokens.length >= 4 ? numberTokens[0].replace('%', '') : '',
        k1Value: numberTokens.length >= 4 ? cleanNumber(numberTokens[1]) : cleanNumber(numberTokens[0]),
        k2Value: numberTokens.length >= 4 ? cleanNumber(numberTokens[2]) : (numberTokens.length >= 2 ? cleanNumber(numberTokens[1]) : ''),
        totalValue: numberTokens.length >= 4 ? cleanNumber(numberTokens[3]) : (numberTokens.length >= 3 ? cleanNumber(numberTokens[2]) : ''),
      })
    }
  }

  return { rows, remarks }
}
