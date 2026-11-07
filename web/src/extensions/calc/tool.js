import { calculate } from './calc.js'
import { convert } from './convert.js'
import { parseCurrency, convertCurrency, getRates } from './currency.js'

// Calculator, unit and currency converter: math (1+1, (2+3)*4), units (10 km to miles, 100f to c), money (100 usd to gbp).
// Registered first so the answer shows above link results. Enter copies the result.
export default {
  async items(q) {
    const cv = q.trim() ? convert(q) : null
    if (cv) return [calcItem(q.trim(), cv.text, cv.label, cv.label)]
    const fx = q.trim() ? parseCurrency(q) : null
    if (fx) {
      const data = await getRates() // cached for hours; only fetched when the input looks like a currency conversion
      if (!data) return [{ key: 'fx:offline', title: 'Currency rates unavailable', subtitle: 'Needs internet access (api.frankfurter.dev)', kind: 'Offline', icon: 'iconify:fa6-solid:coins', run() {} }]
      const r = convertCurrency(fx, data.rates)
      if (!r) return []
      return [calcItem(q.trim(), r.text, r.label, r.label, `${r.note} · rates ${data.date}${data.stale ? ' (offline, cached)' : ''}`)]
    }
    const r = calculate(q)
    // Empty query: expose past calculations so they show up under "Recent" and can be re-copied.
    if (!q.trim()) return calcHistory().map((h) => calcItem(h.expr, h.text, h.label || `${h.expr} = ${h.text}`, h.label))
    if (!r) return []
    return [calcItem(q.trim().replace(/^=/, '').trim(), r.text, `= ${r.text}`)]
  },
}

const HK = 'launcher.calcHistory'
function calcHistory() {
  try {
    return JSON.parse(localStorage.getItem(HK) || '[]')
  } catch {
    return []
  }
}
function remember(expr, text, label) {
  try {
    localStorage.setItem(HK, JSON.stringify([{ expr, text, label }, ...calcHistory().filter((h) => h.expr !== expr)].slice(0, 25)))
  } catch {}
}
function calcItem(expr, text, title, label, note) {
  return {
    key: `calc:${expr}`,
    title,
    subtitle: `${note || expr}  ·  Enter to copy`,
    kind: 'Copy',
    icon: note ? 'iconify:fa6-solid:coins' : 'iconify:fa6-solid:calculator',
    run: () => {
      remember(expr, text, label)
      navigator.clipboard?.writeText(text).catch(() => {})
    },
  }
}

