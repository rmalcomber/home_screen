// Number bases, byte sizes and bit tools for the launcher. Pure; unit tested in engine.test.js. All integers are BigInt.
//
//   hex ff | bin 1010 | oct 755 | dec 255 | base 255 | base 36 zz     number in every base
//   0xff  0b1010  0o17                                                  the same, with no command word
//   bytes 1536000 | bytes 1.5 GiB                                       sizes in SI and IEC units
//   bits (1<<3)|(1<<5) | bits 0xF0 & 0x3C | bits set 0 2 5             bit expressions and flags

const WORDS = ['hex', 'bin', 'oct', 'dec', 'base', 'bytes', 'bits']
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

/** { word, text } for "hex ff", or { word: 'literal', text } for a bare 0x / 0b / 0o number, or null. */
export function parseBasesCommand(q) {
  const s = q || ''
  const m = new RegExp(`^\\s*(${WORDS.join('|')})(?:[ \\t]+|$)([\\s\\S]*)$`, 'i').exec(s)
  if (m) return { word: m[1].toLowerCase(), text: m[2].trim() }
  if (/^\s*[-+]?0[xX][0-9a-fA-F_]+\s*$|^\s*[-+]?0[bB][01_]+\s*$|^\s*[-+]?0[oO][0-7_]+\s*$/.test(s)) return { word: 'literal', text: s.trim() }
  return null
}

/** Parses an integer in the given radix (2-36); prefixes 0x 0b 0o override it. Returns a BigInt or null. */
export function parseInteger(text, radix = 10) {
  let t = String(text).trim().replace(/_/g, '')
  let neg = false
  if (/^[-+]/.test(t)) { neg = t[0] === '-'; t = t.slice(1) }
  const p = /^0([xbo])/i.exec(t)
  if (p && t.length > 2) { radix = { x: 16, b: 2, o: 8 }[p[1].toLowerCase()]; t = t.slice(2) }
  if (!t) return null
  let v = 0n
  const r = BigInt(radix)
  for (const ch of t.toLowerCase()) {
    const d = DIGITS.indexOf(ch)
    if (d < 0 || d >= radix) return null
    v = v * r + BigInt(d)
  }
  return neg ? -v : v
}

const group = (s, n, sep = ' ') => {
  const parts = []
  for (let i = s.length; i > 0; i -= n) parts.unshift(s.slice(Math.max(0, i - n), i))
  return parts.join(sep)
}

/** The widths (in bits) that a value fits in, as a two's complement value: [{ bits, hex, bin }]. */
export function twosComplement(v) {
  const out = []
  for (const bits of [8, 16, 32, 64]) {
    const lim = 1n << BigInt(bits)
    if (v >= -(lim >> 1n) && v < lim) {
      const u = v < 0n ? lim + v : v
      out.push({ bits, hex: '0x' + u.toString(16).toUpperCase().padStart(bits / 4, '0'), bin: group(u.toString(2).padStart(bits, '0'), 4) })
    }
  }
  return out
}

/** Rows for a number: decimal, hex, binary, octal, base 36, plus two's complement for negatives and the set bits. */
export function baseRows(v) {
  const neg = v < 0n
  const a = neg ? -v : v
  const sign = neg ? '-' : ''
  const rows = [
    { id: 'dec', label: 'Decimal', value: v.toString(), alt: group(a.toString(), 3, ',').replace(/^/, sign) },
    { id: 'hex', label: 'Hexadecimal', value: `${sign}0x${a.toString(16).toUpperCase()}` },
    { id: 'bin', label: 'Binary', value: `${sign}0b${a.toString(2)}`, alt: sign + group(a.toString(2), 4) },
    { id: 'oct', label: 'Octal', value: `${sign}0o${a.toString(8)}` },
    { id: 'b36', label: 'Base 36', value: sign + a.toString(36) },
  ]
  if (neg) for (const t of twosComplement(v)) rows.push({ id: `tc${t.bits}`, label: `${t.bits}-bit two's complement`, value: t.hex, alt: t.bin })
  const bytes = a === 0n ? 1 : Math.ceil(a.toString(16).length / 2)
  rows.push({ id: 'size', label: 'Size', value: `${bytes} byte${bytes === 1 ? '' : 's'} · ${a.toString(2).length} bit${a.toString(2).length === 1 ? '' : 's'}` })
  return rows
}

/** Positions (0 = lowest) of the bits that are set in a non-negative value. */
export function setBits(v) {
  const out = []
  const s = (v < 0n ? -v : v).toString(2)
  for (let i = 0; i < s.length; i++) if (s[s.length - 1 - i] === '1') out.push(i)
  return out
}

// ---- byte sizes
const SI = [['KB', 1e3], ['MB', 1e6], ['GB', 1e9], ['TB', 1e12], ['PB', 1e15]]
const IEC = [['KiB', 1024], ['MiB', 1024 ** 2], ['GiB', 1024 ** 3], ['TiB', 1024 ** 4], ['PiB', 1024 ** 5]]
const UNIT_FACTOR = new Map([['b', 1], ['byte', 1], ['bytes', 1], ...SI.map(([u, f]) => [u.toLowerCase(), f]), ...IEC.map(([u, f]) => [u.toLowerCase(), f]), ['k', 1024], ['m', 1024 ** 2], ['g', 1024 ** 3], ['t', 1024 ** 4]])

/** "1536000", "1.5 GiB", "10mb" -> a number of bytes, or null. A bare K, M, G, T means the binary (1024) size. */
export function parseSize(text) {
  const m = /^\s*(\d+(?:[.,]\d+)?|\.\d+)\s*([a-z]*)\s*$/i.exec(text || '')
  if (!m) return null
  const factor = UNIT_FACTOR.get(m[2].toLowerCase() || 'b')
  if (!factor) return null
  const n = Number(m[1].replace(',', '.')) * factor
  return Number.isFinite(n) && n <= Number.MAX_SAFE_INTEGER ? Math.round(n) : null
}

const trim = (n) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/\.?0+$/, '')
const human = (bytes, table) => {
  let best = [`B`, 1]
  for (const e of table) if (bytes >= e[1]) best = e
  return `${trim(bytes / best[1])} ${best[0]}`
}

/** Rows for a size in bytes: the exact byte count, both human-readable forms, then every unit. */
export function sizeRows(bytes) {
  const rows = [
    { id: 'bytes', label: 'Bytes', value: bytes.toLocaleString('en-US') },
    { id: 'si', label: 'Human (SI, powers of 1000)', value: human(bytes, SI) },
    { id: 'iec', label: 'Human (IEC, powers of 1024)', value: human(bytes, IEC) },
  ]
  for (const [u, f] of SI) if (bytes >= f / 10) rows.push({ id: u, label: u, value: `${trim(bytes / f)} ${u}` })
  for (const [u, f] of IEC) if (bytes >= f / 10) rows.push({ id: u, label: u, value: `${trim(bytes / f)} ${u}` })
  rows.push({ id: 'bits', label: 'Bits', value: (BigInt(bytes) * 8n).toLocaleString('en-US') })
  return rows
}

// ---- bit expressions: numbers (any prefix), parentheses and  ~ ! * / % + - << >> & ^ |
const PRECEDENCE = { '|': 1, '^': 2, '&': 3, '<<': 4, '>>': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 }

/** Evaluates a bit expression to a BigInt. Returns { ok, value } or { ok: false, error }. */
export function evalBits(text) {
  const src = String(text || '')
  const tokens = []
  for (let i = 0; i < src.length; ) {
    const c = src[i]
    if (/\s/.test(c)) { i++; continue }
    const num = /^(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*)/.exec(src.slice(i))
    if (num) { tokens.push({ n: parseInteger(num[0]) }); i += num[0].length; continue }
    const op = /^(<<|>>|[-+*/%&|^~()])/.exec(src.slice(i))
    if (!op) return { ok: false, error: `Unexpected "${c}"` }
    tokens.push({ op: op[1] })
    i += op[1].length
  }
  if (!tokens.length) return { ok: false, error: 'Nothing to calculate' }
  let pos = 0
  const peek = () => tokens[pos]
  const parsePrimary = () => {
    const t = tokens[pos++]
    if (!t) throw new Error('The expression ends too early')
    if (t.n !== undefined) return t.n
    if (t.op === '(') {
      const v = parseExpr(0)
      if (tokens[pos]?.op !== ')') throw new Error('Missing )')
      pos++
      return v
    }
    if (t.op === '-') return -parsePrimary()
    if (t.op === '+') return parsePrimary()
    if (t.op === '~') return ~parsePrimary()
    throw new Error(`Unexpected "${t.op}"`)
  }
  const parseExpr = (min) => {
    let left = parsePrimary()
    for (;;) {
      const t = peek()
      const prec = t?.op && PRECEDENCE[t.op]
      if (!prec || prec <= min) return left
      pos++
      const right = parseExpr(prec)
      switch (t.op) {
        case '|': left |= right; break
        case '^': left ^= right; break
        case '&': left &= right; break
        case '<<': if (right < 0n || right > 4096n) throw new Error('Shift is too large'); left <<= right; break
        case '>>': if (right < 0n || right > 4096n) throw new Error('Shift is too large'); left >>= right; break
        case '+': left += right; break
        case '-': left -= right; break
        case '*': left *= right; break
        case '/': if (right === 0n) throw new Error('Division by zero'); left /= right; break
        case '%': if (right === 0n) throw new Error('Division by zero'); left %= right; break
      }
    }
  }
  try {
    const value = parseExpr(0)
    if (pos < tokens.length) return { ok: false, error: `Unexpected "${tokens[pos].op ?? tokens[pos].n}"` }
    return { ok: true, value }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/** "set 0 2 5" or "set 0,2,5" -> the value with those bits set, or null. */
export function fromBitPositions(text) {
  const m = /^set\s+([\d\s,]+)$/i.exec((text || '').trim())
  if (!m) return null
  let v = 0n
  for (const p of m[1].split(/[\s,]+/).filter(Boolean)) {
    const n = Number(p)
    if (!Number.isInteger(n) || n > 4096) return null
    v |= 1n << BigInt(n)
  }
  return v
}

/** The launcher text that reopens a value. */
export const basesFill = (word, text) => `${word} ${text}`.trim()
