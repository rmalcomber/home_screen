// Currency conversion for the launcher: "100 usd to gbp", "£50 in eur", "20 dollars to yen", "usd to gbp".
// Rates come from Frankfurter (ECB and other central-bank data, free, no key) and are cached for a few hours.

import { splits, parseValue } from './convert.js'

const SYMBOLS = { '£': 'GBP', '$': 'USD', '€': 'EUR', '¥': 'JPY', '₹': 'INR', '₩': 'KRW', '₽': 'RUB', '₺': 'TRY', '฿': 'THB', '₪': 'ILS' }
const NAMES = {
  dollar: 'USD', dollars: 'USD', buck: 'USD', bucks: 'USD',
  euro: 'EUR', euros: 'EUR',
  pound: 'GBP', pounds: 'GBP', quid: 'GBP', sterling: 'GBP',
  yen: 'JPY', rupee: 'INR', rupees: 'INR', yuan: 'CNY', renminbi: 'CNY',
  franc: 'CHF', francs: 'CHF', won: 'KRW', rouble: 'RUB', ruble: 'RUB', baht: 'THB', zloty: 'PLN', krona: 'SEK',
}
const SYM = '[£$€¥₹₩₽₺฿₪]'

function code(tok) {
  tok = (tok || '').trim()
  if (SYMBOLS[tok]) return SYMBOLS[tok]
  if (NAMES[tok.toLowerCase()]) return NAMES[tok.toLowerCase()]
  return /^[a-z]{3}$/i.test(tok) ? tok.toUpperCase() : null
}

/** { amount, from, to } if the input reads like a currency conversion (codes are validated later against live rates). */
export function parseCurrency(input) {
  const src = (input || '').trim()
  if (!src || src.length > 80) return null
  for (const { left, right } of splits(src)) {
    const to = code(right)
    if (!to) continue
    let amount = null
    let from = null
    let m
    if ((m = left.match(new RegExp(`^(${SYM})\\s*(.+)$`)))) {
      from = code(m[1])
      amount = parseValue(m[2])
    } else if ((m = left.match(new RegExp(`^(.+?)\\s*([a-z]{3,}|${SYM})$`, 'i')))) {
      from = code(m[2])
      amount = parseValue(m[1])
    }
    if (amount == null && code(left) && /^[a-z]{3,}$/i.test(left.trim())) {
      // "usd to gbp" -> 1 usd
      from = code(left)
      amount = 1
    }
    if (from && to && from !== to && amount != null && Number.isFinite(amount)) return { amount, from, to }
  }
  return null
}

/** rates: { CODE: units per 1 EUR }. Returns { value, rate, text, label } or null for unknown codes. */
export function convertCurrency({ amount, from, to }, rates) {
  if (!rates?.[from] || !rates?.[to]) return null
  const rate = rates[to] / rates[from]
  const value = amount * rate
  const text = value >= 1 ? value.toFixed(2) : String(Number(value.toPrecision(4)))
  const show = (n) => n.toLocaleString('en', { maximumFractionDigits: n >= 1 ? 2 : 6, minimumFractionDigits: n >= 1 ? 2 : 0 })
  return {
    value,
    rate,
    text,
    label: `${amount.toLocaleString('en', { maximumFractionDigits: 4 })} ${from} = ${show(value)} ${to}`,
    note: `1 ${from} = ${Number(rate.toPrecision(5))} ${to}`,
  }
}

// ---- rates (network + cache) ----
const KEY = 'launcher.fxRates'
const MAX_AGE = 6 * 3600 * 1000
let inflight = null

function cached() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}

/** Resolves { rates, date, stale } or null when offline and nothing is cached. */
export function getRates() {
  const c = cached()
  if (c && Date.now() - c.t < MAX_AGE) return Promise.resolve({ ...c, stale: false })
  inflight ||= (async () => {
    try {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), 6000)
      const r = await fetch('https://api.frankfurter.dev/v2/rates?base=EUR', { signal: ctl.signal })
      clearTimeout(timer)
      if (!r.ok) throw new Error(String(r.status))
      const rows = await r.json()
      const rates = { EUR: 1 }
      let date = ''
      for (const x of rows) {
        rates[x.quote] = x.rate
        if (x.date > date) date = x.date
      }
      const out = { t: Date.now(), date, rates }
      try { localStorage.setItem(KEY, JSON.stringify(out)) } catch {}
      return { ...out, stale: false }
    } catch {
      return c ? { ...c, stale: true } : null
    } finally {
      inflight = null
    }
  })()
  return inflight
}
