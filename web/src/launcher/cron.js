// Cron expression parser, English description and next-run calculator for the launcher.
// Supports 5-field (minute hour day-of-month month day-of-week), 6-field with seconds first (Quartz/Spring) or with a
// year last (AWS), 7-field Quartz, names (JAN, MON), lists, ranges, steps, `?`, and Quartz L / W / # specials, plus
// @hourly-style macros. Pure; unit tested in cron.test.js.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DOWS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const KINDS = {
  second: { min: 0, max: 59 },
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dom: { min: 1, max: 31, label: 'day-of-month' },
  month: { min: 1, max: 12, names: MONTHS, base: 1 },
  dow: { min: 0, max: 7, names: DOWS, base: 0, label: 'day-of-week' },
  year: { min: 1970, max: 2199 },
}
export const FIELD_LABELS = { second: 'Second', minute: 'Minute', hour: 'Hour', dom: 'Day of month', month: 'Month', dow: 'Day of week', year: 'Year' }

const MACROS = {
  '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *',
}

class CronError extends Error {}
const fail = (m) => { throw new CronError(m) }
const kindName = (k) => KINDS[k].label || k

function num(tok, kind, oneBased) {
  const def = KINDS[kind]
  if (def.names) {
    const i = def.names.indexOf(tok.toUpperCase())
    if (i >= 0) return i + def.base
  }
  if (!/^\d+$/.test(tok)) fail(`"${tok}" isn't a valid ${kindName(kind)} value`)
  const n = parseInt(tok, 10)
  if (kind === 'dow' && oneBased) {
    if (n < 1 || n > 7) fail(`${n} is out of range for day-of-week (1–7, where 1 is Sunday)`)
    return n - 1
  }
  return n
}

function check(n, kind) {
  const { min, max } = KINDS[kind]
  if (n < min || n > max) fail(`${n} is out of range for ${kindName(kind)} (${min}–${max})`)
  return n
}

function parseField(raw, kind, oneBased = false) {
  const def = KINDS[kind]
  const values = new Set()
  const specials = []
  const items = []
  let any = false
  const top = kind === 'dow' ? 6 : def.max
  for (const part of raw.split(',')) {
    if (!part) fail(`Empty item in the ${kindName(kind)} field`)
    if (part === '*' || part === '?') {
      if (part === '?' && kind !== 'dom' && kind !== 'dow') fail('"?" is only allowed in the day-of-month and day-of-week fields')
      any = true
      for (let v = def.min; v <= top; v++) values.add(v)
      items.push({ t: 'any' })
      continue
    }
    if (kind === 'dom') {
      let m
      if (part === 'L') { specials.push({ t: 'last' }); continue }
      if (part === 'LW') { specials.push({ t: 'lastWeekday' }); continue }
      if ((m = /^L-(\d+)$/.exec(part))) { specials.push({ t: 'lastOffset', n: +m[1] }); continue }
      if ((m = /^(\d+)W$/.exec(part))) { specials.push({ t: 'nearest', n: check(+m[1], 'dom') }); continue }
    }
    if (kind === 'dow') {
      let m
      if ((m = /^(.+)#(\d)$/.exec(part))) {
        const k = +m[2]
        if (k < 1 || k > 5) fail(`"${part}": the occurrence must be 1–5`)
        specials.push({ t: 'nth', d: check(num(m[1], 'dow', oneBased), 'dow') % 7, k })
        continue
      }
      if ((m = /^(.+)L$/.exec(part))) { specials.push({ t: 'lastDow', d: check(num(m[1], 'dow', oneBased), 'dow') % 7 }); continue }
    }
    const pieces = part.split('/')
    if (pieces.length > 2) fail(`"${part}" has more than one "/"`)
    const [rangePart, stepStr] = pieces
    let lo
    let hi
    let step = 1
    const star = rangePart === '*'
    if (star) {
      lo = def.min
      hi = top
    } else if (rangePart.includes('-')) {
      const [a, b, ...extra] = rangePart.split('-')
      if (extra.length || a === '' || b === '') fail(`"${rangePart}" isn't a valid range`)
      lo = check(num(a, kind, oneBased), kind)
      hi = check(num(b, kind, oneBased), kind)
      if (lo > hi) fail(`The range ${rangePart} is backwards`)
    } else {
      lo = check(num(rangePart, kind, oneBased), kind)
      hi = stepStr !== undefined ? top : lo
    }
    if (stepStr !== undefined) {
      if (!/^\d+$/.test(stepStr) || +stepStr < 1) fail(`"${part}": the step must be a positive number`)
      step = +stepStr
    }
    for (let v = lo; v <= hi; v += step) values.add(kind === 'dow' && v === 7 ? 0 : v)
    items.push({ t: stepStr !== undefined ? 'step' : 'range', lo, hi, step, star, single: lo === hi && stepStr === undefined })
  }
  return { raw, kind, any, values, specials, items }
}

const ORDERS = {
  5: ['minute', 'hour', 'dom', 'month', 'dow'],
  6: ['second', 'minute', 'hour', 'dom', 'month', 'dow'],
  '6aws': ['minute', 'hour', 'dom', 'month', 'dow', 'year'],
  7: ['second', 'minute', 'hour', 'dom', 'month', 'dow', 'year'],
}

/**
 * Parse an expression. 5 fields = standard; 7 = Quartz. Six fields are ambiguous, so `dialect` picks:
 *   'seconds' (default)  seconds first, Spring-style day numbers (0–7, 0/7 = Sunday)
 *   'quartz6'            seconds first, Quartz day numbers (1–7, 1 = Sunday)
 *   'aws'                year last (EventBridge), day numbers 1–7 with 1 = Sunday
 */
export function parseCron(expr, dialect = 'seconds') {
  let text = (expr || '').trim().replace(/\s+/g, ' ')
  if (/^@reboot$/i.test(text)) return { ok: true, reboot: true, expr: text, count: 0, order: [], fields: {} }
  const macro = MACROS[text.toLowerCase()]
  if (macro) text = macro
  if (!text) return { ok: false, errors: [{ field: null, message: 'Type a cron expression, for example */15 9-17 * * 1-5' }] }
  const raw = text.split(' ')
  const key = raw.length === 6 && dialect === 'aws' ? '6aws' : raw.length
  const used = raw.length === 5 ? 'standard' : raw.length === 7 ? 'quartz' : dialect
  const oneBased = ['quartz', 'quartz6', 'aws'].includes(used)
  const order = ORDERS[key]
  if (!order) return { ok: false, errors: [{ field: null, message: `Found ${raw.length} fields; a cron expression has 5 (or 6–7 with seconds and/or a year)` }] }
  const fields = {}
  const errors = []
  order.forEach((k, i) => {
    try { fields[k] = parseField(raw[i], k, oneBased) } catch (e) {
      if (!(e instanceof CronError)) throw e
      errors.push({ field: k, message: e.message })
    }
  })
  if (errors.length) return { ok: false, errors }
  return { ok: true, expr: text, count: raw.length, order, fields, hasSeconds: !!fields.second, dialect: used }
}

// ---------------------------------------------------------------- next runs

const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const dowOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay()
const lastWeekday = (y, m) => { let d = daysIn(y, m); while ([0, 6].includes(dowOf(y, m, d))) d--; return d }
function nearestWeekday(y, m, n) {
  const dim = daysIn(y, m)
  if (n > dim) return -1
  const w = dowOf(y, m, n)
  if (w === 6) return n === 1 ? 3 : n - 1
  if (w === 0) return n === dim ? n - 2 : n + 1
  return n
}

function domMatches(f, y, m, d) {
  if (f.values.has(d)) return true
  const dim = daysIn(y, m)
  return f.specials.some((s) => (s.t === 'last' ? d === dim : s.t === 'lastWeekday' ? d === lastWeekday(y, m) : s.t === 'lastOffset' ? d === dim - s.n : s.t === 'nearest' ? d === nearestWeekday(y, m, s.n) : false))
}
function dowMatches(f, y, m, d) {
  const w = dowOf(y, m, d)
  if (f.values.has(w)) return true
  const dim = daysIn(y, m)
  return f.specials.some((s) => (s.t === 'lastDow' ? w === s.d && d + 7 > dim : s.t === 'nth' ? w === s.d && Math.ceil(d / 7) === s.k : false))
}

function dayMatches(p, y, m, d) {
  const { month, dom, dow, year } = p.fields
  if (!month.values.has(m)) return false
  if (year && !year.values.has(y)) return false
  const domRestricted = !dom.any
  const dowRestricted = !dow.any
  if (!domRestricted && !dowRestricted) return true
  if (!domRestricted) return dowMatches(dow, y, m, d)
  if (!dowRestricted) return domMatches(dom, y, m, d)
  return domMatches(dom, y, m, d) || dowMatches(dow, y, m, d) // standard cron: either one matching is enough
}

/** The next `count` run times (ms since epoch) strictly after `from`, in local time or UTC. */
export function nextRuns(p, from = Date.now(), count = 10, { utc = false } = {}) {
  if (!p.ok || p.reboot) return []
  const secs = p.fields.second ? [...p.fields.second.values].sort((a, b) => a - b) : [0]
  const mins = [...p.fields.minute.values].sort((a, b) => a - b)
  const hrs = [...p.fields.hour.values].sort((a, b) => a - b)
  const f = new Date(from)
  const [fy, fm, fd] = utc ? [f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()] : [f.getFullYear(), f.getMonth(), f.getDate()]
  const out = []
  for (let i = 0; i < 366 * 9 && out.length < count; i++) {
    const day = new Date(Date.UTC(fy, fm, fd + i))
    const y = day.getUTCFullYear()
    const m = day.getUTCMonth() + 1
    const d = day.getUTCDate()
    if (!dayMatches(p, y, m, d)) continue
    for (const h of hrs) for (const mi of mins) for (const s of secs) {
      let t
      if (utc) t = Date.UTC(y, m - 1, d, h, mi, s)
      else {
        const dt = new Date(y, m - 1, d, h, mi, s)
        if (dt.getHours() !== h || dt.getMinutes() !== mi) continue // doesn't exist (daylight-saving gap)
        t = dt.getTime()
      }
      if (t > from) { out.push(t); if (out.length >= count) return out }
    }
  }
  return out
}

// ---------------------------------------------------------------- English

const pad = (n) => String(n).padStart(2, '0')
const hhmm = (h, m, s) => `${pad(h)}:${pad(m)}${s ? ':' + pad(s) : ''}`
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const ord = (n) => { const v = n % 100; return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th') }
const joinAnd = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1])
const sorted = (set) => [...set].sort((a, b) => a - b)

function runsOf(vals) {
  const runs = []
  for (const v of vals) { const l = runs[runs.length - 1]; if (l && v === l[1] + 1) l[1] = v; else runs.push([v, v]) }
  return runs
}
function describeValues(vals, name = String) {
  const parts = []
  for (const [a, b] of runsOf(vals)) {
    if (b - a >= 2) parts.push(`${name(a)} through ${name(b)}`)
    else { parts.push(name(a)); if (b !== a) parts.push(name(b)) }
  }
  return joinAnd(parts)
}

const onlyStep = (f) => (f.items.length === 1 && f.items[0].t === 'step' ? f.items[0] : null)
const single = (f) => (!f.any && f.items.length === 1 && f.items[0].single && f.values.size === 1 ? [...f.values][0] : null)
const plural = (n, unit) => (n === 1 ? unit : `${n} ${unit}s`)

function unitPhrase(f, unit) {
  if (f.any) return `every ${unit}`
  const st = onlyStep(f)
  if (st) {
    if (st.star) return `every ${plural(st.step, unit)}`
    const top = KINDS[f.kind].max
    return st.hi === top ? `every ${plural(st.step, unit)} starting at ${unit} ${st.lo}` : `every ${plural(st.step, unit)} from ${unit} ${st.lo} through ${st.hi}`
  }
  const vals = sorted(f.values)
  return `${unit}${vals.length > 1 ? 's' : ''} ${describeValues(vals)}`
}

function hourPhrase(f) {
  if (f.any) return 'every hour'
  const st = onlyStep(f)
  if (st && st.star) return `every ${plural(st.step, 'hour')}`
  const vals = sorted(f.values)
  const runs = runsOf(vals)
  if (!st && runs.length === 1 && runs[0][1] > runs[0][0]) return `between ${hhmm(runs[0][0], 0)} and ${hhmm(runs[0][1], 59)}`
  return `during hour${vals.length > 1 ? 's' : ''} ${describeValues(vals)}`
}

function describeTime(p) {
  const { second, minute, hour } = p.fields
  const sSingle = second ? single(second) : 0
  const secondsRestricted = second && !(sSingle === 0)
  const m = single(minute)
  const hExplicit = !hour.any && hour.items.every((i) => i.t === 'range')
  const hVals = sorted(hour.values)

  if (secondsRestricted && sSingle !== null && m !== null && hExplicit && hVals.length <= 6) return `At ${joinAnd(hVals.map((h) => hhmm(h, m, sSingle)))}`
  const secPart = secondsRestricted ? unitPhrase(second, 'second') : null
  if (secPart && minute.any && hour.any) return cap(secPart)

  let main
  if (minute.any && hour.any) main = 'every minute'
  else if (m !== null && hExplicit && hVals.length <= 6) main = `at ${joinAnd(hVals.map((h) => hhmm(h, m)))}`
  else if (m !== null && hExplicit && runsOf(hVals).length === 1 && hVals.length > 1) {
    const a = hVals[0]
    const b = hVals[hVals.length - 1]
    main = m === 0 ? `every hour, from ${hhmm(a, 0)} through ${hhmm(b, 0)}` : `every hour at minute ${m}, from ${hhmm(a, m)} through ${hhmm(b, m)}`
  } else if (onlyStep(minute)?.star && hour.any) main = unitPhrase(minute, 'minute')
  else if (m !== null && hour.any) main = m === 0 ? 'at the start of every hour' : `at minute ${m} past every hour`
  else main = `${minute.any ? 'every minute' : unitPhrase(minute, 'minute')}, ${hourPhrase(hour)}`
  return cap(secPart ? `${secPart}, ${main}` : main)
}

const domPhrase = (f) => {
  const parts = []
  const vals = sorted(f.values)
  if (vals.length) parts.push(`the ${describeValues(vals, ord)}`)
  for (const s of f.specials) {
    if (s.t === 'last') parts.push('the last day')
    else if (s.t === 'lastWeekday') parts.push('the last weekday')
    else if (s.t === 'lastOffset') parts.push(`${s.n} day${s.n === 1 ? '' : 's'} before the last day`)
    else if (s.t === 'nearest') parts.push(`the weekday nearest the ${ord(s.n)}`)
  }
  const st = onlyStep(f)
  if (st && st.star) return `every ${plural(st.step, 'day')} of the month`
  return joinAnd(parts) + ' of the month'
}

const dowPhrase = (f) => {
  const parts = []
  const vals = sorted(f.values)
  if (vals.length) parts.push(describeValues(vals, (d) => DOW_NAMES[d]))
  for (const s of f.specials) {
    if (s.t === 'lastDow') parts.push(`the last ${DOW_NAMES[s.d]} of the month`)
    else if (s.t === 'nth') parts.push(`the ${ord(s.k)} ${DOW_NAMES[s.d]} of the month`)
  }
  return joinAnd(parts)
}

const monthPhrase = (f) => `in ${describeValues(sorted(f.values), (m) => MONTH_NAMES[m - 1])}`
const yearPhrase = (f) => `in ${describeValues(sorted(f.values))}`

function describeDate(p) {
  const { dom, dow, month, year } = p.fields
  const out = []
  if (dom.any && dow.any) { if (month.any) out.push('every day') }
  else if (dow.any) out.push(`on ${domPhrase(dom)}`)
  else if (dom.any) out.push(`on ${dowPhrase(dow)}`)
  else out.push(`on ${domPhrase(dom)} and on ${dowPhrase(dow)}`)
  if (!month.any) out.push(monthPhrase(month))
  if (year && !year.any) out.push(yearPhrase(year))
  return out
}

/** One-sentence English description. */
export function describe(p) {
  if (p.reboot) return 'At system startup (it has no repeating schedule)'
  return [describeTime(p), ...describeDate(p)].join(', ')
}

/** Short meaning of one field, for the breakdown table. */
export function fieldMeaning(p, key) {
  const f = p.fields[key]
  if (!f) return ''
  if (key === 'second' || key === 'minute') return f.any ? `every ${key}` : unitPhrase(f, key)
  if (key === 'hour') return f.any ? 'every hour' : sorted(f.values).length === 1 && !onlyStep(f) ? `at ${hhmm([...f.values][0], 0)}` : hourPhrase(f).replace(/^during /, '')
  if (f.any) return key === 'dom' ? 'every day of the month' : key === 'dow' ? 'every day of the week' : key === 'month' ? 'every month' : 'every year'
  if (key === 'dom') return domPhrase(f)
  if (key === 'dow') return dowPhrase(f)
  if (key === 'month') return monthPhrase(f).replace(/^in /, '')
  return yearPhrase(f).replace(/^in /, '')
}

/** "cron <expr>", "crontab <expr>", "@daily", or a bare expression that is clearly cron → { expr } | null */
export function parseCronCommand(q) {
  const t = (q || '').trim()
  if (/^cron(?:tab)?$/i.test(t)) return { expr: '' }
  const m = /^cron(?:tab)?\s+([\s\S]+)$/i.exec(t)
  if (m) return { expr: m[1].trim().replace(/\s+/g, ' ') }
  if (/^@(yearly|annually|monthly|weekly|daily|midnight|hourly|reboot)$/i.test(t)) return { expr: t }
  const f = t.split(/\s+/)
  if (f.length >= 5 && f.length <= 7 && f.every((x) => /^[0-9*?/,\-A-Za-z#]+$/.test(x)) && f.some((x) => /[*/]/.test(x)) && parseCron(t).ok) return { expr: f.join(' ') }
  return null
}
