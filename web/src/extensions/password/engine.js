// Password generator for the launcher. Uses crypto.getRandomValues with rejection sampling (no modulo bias).
// Pure apart from the injectable `randomInt`; unit tested in password.test.js.

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digit: '0123456789',
  symbol: '!@#$%^&*()-_=+[]{}:;,.?',
}
const LOOKALIKES = /[O0oIl1|]/g

export const MIN_LENGTH = 4
export const MAX_LENGTH = 256

/** Uniform random integer in [0, max). */
export function randomInt(max) {
  if (max <= 0 || max > 2 ** 32) throw new RangeError('max out of range')
  const limit = Math.floor(2 ** 32 / max) * max
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % max
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** The character pools for the chosen options (look-alike characters removed when `easy`). */
export function pools({ lower = true, upper = true, digit = true, symbol = true, easy = false } = {}) {
  const on = { lower, upper, digit, symbol }
  return Object.keys(SETS).filter((k) => on[k]).map((k) => (easy ? SETS[k].replace(LOOKALIKES, '') : SETS[k])).filter(Boolean)
}

/** A random password that contains at least one character from every selected pool. */
export function generate(opts = {}, rand = randomInt) {
  const length = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, opts.length ?? 20))
  const ps = pools(opts)
  if (!ps.length) throw new Error('Select at least one kind of character')
  const all = ps.join('')
  const chars = ps.map((p) => p[rand(p.length)])
  while (chars.length < length) chars.push(all[rand(all.length)])
  return shuffle(chars, rand).join('')
}

/** Random digits (a PIN). */
export function pin(length = 6, rand = randomInt) {
  return Array.from({ length }, () => rand(10)).join('')
}

/** Random hex string of exactly `length` characters. */
export function hexToken(length = 32, rand = randomInt) {
  return Array.from({ length }, () => '0123456789abcdef'[rand(16)]).join('')
}

/** Random URL-safe (base64url alphabet) string of exactly `length` characters. */
export function urlToken(length = 32, rand = randomInt) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  return Array.from({ length }, () => A[rand(64)]).join('')
}

export const entropyBits = (length, poolSize) => Math.round(length * Math.log2(poolSize))

export function strengthLabel(bits) {
  return bits < 28 ? 'very weak' : bits < 36 ? 'weak' : bits < 60 ? 'fair' : bits < 80 ? 'strong' : bits < 128 ? 'very strong' : 'excellent'
}

const FLAGS = {
  nosymbols: { symbol: false }, nosym: { symbol: false }, alnum: { symbol: false },
  nonumbers: { digit: false }, nonum: { digit: false }, nodigits: { digit: false },
  noupper: { upper: false }, nolower: { lower: false }, easy: { easy: true },
}

/** "password", "password 24", "pw 16 nosymbols easy" → { length, lengthGiven, opts } | null */
export function parsePasswordCommand(q) {
  const m = /^\s*(?:password|passwd|pwgen|pw)((?:\s+\S+)*)\s*$/i.exec(q || '')
  if (!m) return null
  let length = 20
  let lengthGiven = false
  const opts = {}
  for (const tok of m[1].trim().split(/\s+/).filter(Boolean)) {
    if (/^\d{1,4}$/.test(tok)) { length = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, +tok)); lengthGiven = true }
    else if (FLAGS[tok.toLowerCase()]) Object.assign(opts, FLAGS[tok.toLowerCase()])
    else return null
  }
  if (!pools(opts).length) return null
  return { length, lengthGiven, opts }
}
