// UUID helpers for the launcher. Pure (random source injectable); unit tested in uuid.test.js.

const rnd = (n) => crypto.getRandomValues(new Uint8Array(n))
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
const fmt = (h) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`

/** Random UUID (v4). */
export function v4(random = rnd) {
  const b = random(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  return fmt(hex(b))
}

/** Time-ordered UUID (v7): 48-bit unix ms timestamp + random. Sorts by creation time. */
export function v7(now = Date.now(), random = rnd) {
  const b = random(16)
  let t = BigInt(now)
  for (let i = 5; i >= 0; i--) { b[i] = Number(t & 0xffn); t >>= 8n }
  b[6] = (b[6] & 0x0f) | 0x70
  b[8] = (b[8] & 0x3f) | 0x80
  return fmt(hex(b))
}

export const NIL = '00000000-0000-0000-0000-000000000000'

export const forms = (u) => ({
  lower: u.toLowerCase(),
  upper: u.toUpperCase(),
  compact: u.replace(/-/g, '').toLowerCase(),
  braces: `{${u.toUpperCase()}}`,
})

const VARIANT = (b) => (b < 0x80 ? 'NCS (reserved)' : b < 0xc0 ? 'RFC 4122 / 9562' : b < 0xe0 ? 'Microsoft (reserved)' : 'Future (reserved)')
const VERSION_NAME = { 1: 'time-based', 2: 'DCE security', 3: 'name-based (MD5)', 4: 'random', 5: 'name-based (SHA-1)', 6: 'reordered time-based', 7: 'Unix-time ordered', 8: 'custom' }

/** Parse a UUID in common spellings (hyphens optional, {braces}, urn:uuid:). Returns details or null. */
export function parseUuid(input) {
  const s = (input || '').trim().replace(/^urn:uuid:/i, '').replace(/^\{(.*)\}$/, '$1').replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/i.test(s)) return null
  const h = s.toLowerCase()
  const canonical = fmt(h)
  if (canonical === NIL) return { canonical, nil: true }
  const version = parseInt(h[12], 16)
  const variant = VARIANT(parseInt(h.slice(16, 18), 16))
  let time = null
  if (version === 7) time = new Date(parseInt(h.slice(0, 12), 16))
  else if (version === 1 || version === 6) {
    const raw = version === 1 ? BigInt('0x' + h.slice(12, 16).slice(1) + h.slice(8, 12) + h.slice(0, 8)) : BigInt('0x' + h.slice(0, 12) + h.slice(13, 16))
    const ms = Number(raw / 10000n) - 12219292800000
    time = new Date(ms)
  }
  return { canonical, version, versionName: VERSION_NAME[version] || 'unknown', variant, time: time && !Number.isNaN(time.getTime()) ? time : null }
}

/** "uuid", "guid 5", "uuid <uuid>" → { count } | { inspect } | null */
export function parseUuidCommand(q) {
  const m = /^\s*(?:uuid|guid)(?:\s+(\S+))?\s*$/i.exec(q || '')
  if (!m) return null
  if (!m[1]) return { count: 1 }
  if (/^\d{1,3}$/.test(m[1])) return { count: Math.min(100, Math.max(1, +m[1])) }
  const p = parseUuid(m[1])
  return p ? { inspect: p } : null
}
