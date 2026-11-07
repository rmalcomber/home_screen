// Timestamp converter for the launcher: unix seconds/ms/µs/ns, ISO dates, "now", offsets like "+3d", optional "in <timezone>".
// Pure (clock injectable); unit tested in timestamp.test.js.
import { relativeTime } from '../../core/lib/text.js'

const UNIT_MS = { s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000, m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000, h: 3600000, hr: 3600000, hrs: 3600000, hour: 3600000, hours: 3600000, d: 86400000, day: 86400000, days: 86400000, w: 604800000, wk: 604800000, week: 604800000, weeks: 604800000 }
const MAX_MS = 8.64e15

const validZone = (z) => {
  try { new Intl.DateTimeFormat('en', { timeZone: z }); return true } catch { return false }
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i

/**
 * "now", "ts", "ts 1700000000", "1700000000000", "2026-11-06T12:00:00Z", "ts +3d", "1700000000 in Asia/Tokyo" …
 * → { ms, note, zone?, alt? } | null.   `alt` is the same wall-clock time read as UTC when no zone was given.
 */
export function parseTimestampCommand(q, now = Date.now()) {
  let s = (q || '').trim()
  if (!s) return null
  let zone = null
  const zm = /^(.*?)\s+in\s+([A-Za-z]+(?:\/[A-Za-z0-9_+-]+)*)$/i.exec(s)
  if (zm && validZone(zm[2])) { s = zm[1].trim(); zone = zm[2] }

  const pm = /^(?:ts|timestamp|epoch|unix)(?:\s+([\s\S]*))?$/i.exec(s)
  const prefixed = !!pm
  const rest = (pm ? pm[1] || '' : s).trim()
  const out = (ms, note, extra = {}) => (Number.isFinite(ms) && Math.abs(ms) <= MAX_MS ? { ms: Math.round(ms), note, zone, ...extra } : null)

  if (!rest || /^now$/i.test(rest)) return prefixed || /^now$/i.test(rest) ? out(now, 'current time') : null

  const off = /^(?:now\s*)?([+-])\s*(\d+(?:\.\d+)?)\s*([a-z]+)$/i.exec(rest)
  if (off && UNIT_MS[off[3].toLowerCase()] && (prefixed || /^now/i.test(rest))) {
    const sign = off[1] === '-' ? -1 : 1
    return out(now + sign * parseFloat(off[2]) * UNIT_MS[off[3].toLowerCase()], `now ${off[1]} ${off[2]} ${off[3]}`)
  }

  const num = /^([+-]?\d+(?:\.\d+)?)\s*(s|ms|us|µs|ns)?$/i.exec(rest)
  if (num) {
    const digits = num[1].replace(/^[+-]/, '').split('.')[0].length
    if (!prefixed && (digits < 9 || num[1].includes('.') || num[2])) return null // bare numbers must look like a timestamp
    const unit = (num[2] || (digits <= 11 ? 's' : digits <= 14 ? 'ms' : digits <= 17 ? 'us' : 'ns')).toLowerCase().replace('µ', 'u')
    const div = { s: 1 / 1000, ms: 1, us: 1000, ns: 1e6 }[unit]
    const names = { s: 'seconds', ms: 'milliseconds', us: 'microseconds', ns: 'nanoseconds' }
    return out(parseFloat(num[1]) / div, `read as ${names[unit]}${num[2] ? '' : ' (from the number of digits)'}`)
  }

  const iso = ISO.exec(rest)
  if (iso) {
    const [, y, mo, d, h = '0', mi = '0', sec = '0', frac = '0', tz] = iso
    const ms = Math.round(parseFloat('0.' + frac) * 1000)
    const parts = [+y, +mo - 1, +d, +h, +mi, +sec, ms]
    if (tz) {
      const t = Date.UTC(...parts)
      if (tz.toUpperCase() === 'Z') return out(t, 'ISO date (UTC)')
      const m = /([+-])(\d{2}):?(\d{2})/.exec(tz)
      return out(t - (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) * 60000, `ISO date with offset ${tz}`)
    }
    // no zone given: wall-clock time in the browser's zone, with the UTC reading offered as an alternative
    return out(new Date(...parts).getTime(), 'no time zone given: read as your local time', { alt: Date.UTC(...parts) })
  }

  if (prefixed) {
    const t = Date.parse(rest)
    if (!Number.isNaN(t)) return out(t, 'parsed as a date by the browser')
  }
  return null
}

const pad = (n, l = 2) => String(n).padStart(l, '0')

/** ISO 8601 in the browser's zone with offset, e.g. 2026-11-06T12:00:00.000+01:00 */
export function isoLocal(d) {
  const off = -d.getTimezoneOffset()
  const a = Math.abs(off)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}${off < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`
}

/** Every representation worth copying: [{ id, label, value }]. */
export function formatRows(ms, { zone = null, now = Date.now() } = {}) {
  const d = new Date(ms)
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const full = (timeZone) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'long', timeZone }).format(d)
  return [
    { id: 'unix', label: 'Unix seconds', value: String(Math.floor(ms / 1000)) },
    { id: 'ms', label: 'Unix milliseconds', value: String(ms) },
    { id: 'iso', label: 'ISO 8601 (UTC)', value: d.toISOString() },
    ...(zone ? [{ id: 'zone', label: zone, value: full(zone) }] : []),
    { id: 'local', label: `Local (${localZone})`, value: full(undefined) },
    { id: 'localiso', label: 'ISO 8601 (local)', value: isoLocal(d) },
    { id: 'rfc', label: 'RFC 2822 / HTTP date', value: d.toUTCString() },
    { id: 'rel', label: 'Relative', value: relativeTime(ms, now) },
  ]
}
