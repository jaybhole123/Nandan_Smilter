// Offline self-test for the AI reader's code-side logic (no API key, no network):
//   node server/selftest.mjs
import assert from 'node:assert/strict'
import { PAGES, sanitize, crossChecks, cleanNumber, cleanDate } from './schemas.js'

let passed = 0
const t = (name, fn) => { try { fn(); passed++; console.log('ok  ', name) } catch (e) { console.log('FAIL', name, '-', e.message); process.exitCode = 1 } }

t('cleanNumber strips units, symbols, commas', () => {
  assert.equal(cleanNumber('123.600 Mt(5)'), '123.600')
  assert.equal(cleanNumber('@330/-'), '330')
  assert.equal(cleanNumber('52 FC'), '52')
  assert.equal(cleanNumber('30,011'), '30011')
  assert.equal(cleanNumber('9100*'), '9100')
  assert.equal(cleanNumber('Rs. 1,250.50'), '1250.50')
  assert.equal(cleanNumber('-'), '')
  assert.equal(cleanNumber('nil'), '')
  assert.equal(cleanNumber(''), '')
})
t('cleanNumber keeps % only where allowed', () => {
  assert.equal(cleanNumber('20%', true), '20%')
  assert.equal(cleanNumber('20 %', true), '20%')
  assert.equal(cleanNumber('20%', false), '20')
})
t('cleanDate normalises common formats', () => {
  assert.equal(cleanDate('21.10.2026'), '2026-10-21')
  assert.equal(cleanDate('10.08.26'), '2026-08-10')
  assert.equal(cleanDate('21-Oct-26'), '2026-10-21')
  assert.equal(cleanDate('Wednesday 21 October 2026'), '2026-10-21')
  assert.equal(cleanDate('2026/10/21'), '2026-10-21')
  assert.equal(cleanDate('2026-10-21'), '2026-10-21')
  assert.equal(cleanDate('garbage'), '')
})
t('sanitize cleans a transfer row and fixes look-alike letters', () => {
  const out = sanitize('transfer', { rows: [{ entryType: 'outgoing', partyName: 'Kartikeyа  Chemicals', materialName: 'Sponge iron', vehicleNo: '', qty: '123.600 Mt(5)', rate: '@330/-' }] })
  assert.equal(out.rows[0].qty, '123.600')
  assert.equal(out.rows[0].rate, '330')
  assert.equal(out.rows[0].partyName, 'Kartikeya Chemicals') // Cyrillic "а" -> Latin
})
t('sanitize production: single value column becomes k1 and total', () => {
  const out = sanitize('production', { date: '21 October 2026', downTimeRemarks: '-', rows: [
    { metricName: '"A" GRADE', percentValue: '', k1Value: '', k2Value: '', totalValue: '114.00' },
    { metricName: 'KILNS', percentValue: '', k1Value: '60', k2Value: '54', totalValue: '114' },
  ] })
  assert.equal(out.date, '2026-10-21')
  assert.equal(out.rows[0].k1Value, '114.00')
  assert.equal(out.rows[0].totalValue, '114.00')
  assert.equal(out.rows[1].k1Value, '60') // two-kiln rows untouched
})
t('sauda sale: carried-forward and fresh orders pass, wrong balance warns', () => {
  const rows = [
    { partyName: 'A', saudaQuantity: '1000', prvPending: '325.020', qtyDispatch: '0', balPending: '325.020' }, // prev - dispatch
    { partyName: 'B', saudaQuantity: '100', prvPending: '77.810', qtyDispatch: '24.680', balPending: '53.130' },
    { partyName: 'C', saudaQuantity: '500', prvPending: '0', qtyDispatch: '100', balPending: '400' }, // fresh: sauda - dispatch
    { partyName: 'D', saudaQuantity: '100', prvPending: '50', qtyDispatch: '10', balPending: '999' }, // wrong
  ]
  const w = crossChecks('sauda_sale', { rows })
  assert.equal(w.length, 1)
  assert.match(w[0], /Row 4/)
})
t('sauda purchase: balance = order - received', () => {
  const ok = { partyName: 'X', orderQuantity: '20000', qtyReceived: '19683.040', balPending: '316.960' }
  const bad = { partyName: 'Y', orderQuantity: '20000', qtyReceived: '19683.040', balPending: '416.960' }
  assert.equal(crossChecks('sauda_purchase', { rows: [ok] }).length, 0)
  assert.equal(crossChecks('sauda_purchase', { rows: [bad] }).length, 1)
})
t('stock raw / coal arithmetic', () => {
  assert.equal(crossChecks('stock_raw', { rows: [{ material: 'M', openingStock: '5603.243', inward: '337.390', consumption: '625.000', closingStock: '5315.633' }] }).length, 0)
  assert.equal(crossChecks('stock_raw', { rows: [{ material: 'M', openingStock: '5603.243', inward: '337.390', consumption: '625.000', closingStock: '5115.633' }] }).length, 1)
  // coal: closing may include the moisture-loss deduction
  assert.equal(crossChecks('stock_coal', { rows: [{ material: 'C', openingStock: '419.091', inward: '', consumption: '37.600', moistLossPct: '1.364', closingStock: '380.127' }] }).length, 0)
  assert.equal(crossChecks('stock_coal', { rows: [{ material: 'C', openingStock: '419.091', inward: '', consumption: '37.600', moistLossPct: '1.364', closingStock: '300.000' }] }).length, 1)
})
t('every page has a strict, consistent schema', () => {
  for (const [page, cfg] of Object.entries(PAGES)) {
    const s = cfg.schema
    assert.equal(s.additionalProperties, false, page)
    assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), page)
    const item = s.properties.rows.items
    assert.deepEqual([...item.required].sort(), Object.keys(item.properties).sort(), page)
    assert.ok(cfg.hint.length > 50, page)
  }
  // Nandan_Smilter's Sauda pages carry these columns (Size, Consignee, Broker, Terms, Payment, Reference, Remark)
  const keysOf = (p) => Object.keys(PAGES[p].schema.properties.rows.items.properties)
  for (const k of ['sizeMm', 'broker', 'deliveryTerms', 'paymentCondition', 'referenceName', 'remarks']) {
    assert.ok(keysOf('sauda_purchase').includes(k), 'sauda_purchase.' + k)
    assert.ok(keysOf('sauda_sale').includes(k), 'sauda_sale.' + k)
  }
  assert.ok(keysOf('sauda_sale').includes('consigneeName'), 'sauda_sale.consigneeName')
})

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`)
