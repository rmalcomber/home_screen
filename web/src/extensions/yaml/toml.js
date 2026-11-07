// A small TOML 1.0 reader and writer. Pure; unit tested in toml.test.js.
//
// Reads everything in TOML 1.0: comments, bare/quoted/dotted keys, basic, literal and multi-line strings, integers (also hex, octal,
// binary, underscores), floats (inf and nan become the numbers Infinity and NaN), booleans, dates and times (kept as text),
// arrays, inline tables, [tables] and [[arrays of tables]], with the duplicate and redefinition errors the spec asks for.
// Integers too big for JavaScript to hold exactly stay text.
// Writes any JSON map: simple values first, then [tables] and [[arrays of tables]]. TOML has no null, so nulls are left out
// and reported in `warnings`.

export class TomlError extends Error {
  constructor(message, line) {
    super(line ? `Line ${line}: ${message}` : message)
    this.name = 'TomlError'
    this.line = line || null
  }
}

const BARE = /^[A-Za-z0-9_-]+$/
const ESC = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' }

export function parseToml(text) {
  const s = String(text).replace(/^﻿/, '')
  let pos = 0
  const root = {}
  const header = new WeakSet() // tables created by a [header]
  const dotted = new WeakSet() // tables created by a dotted key
  const closed = new WeakSet() // inline tables: cannot be extended
  const tableArrays = new WeakSet() // arrays created by [[header]]

  const lineAt = (at) => s.slice(0, at).split('\n').length
  const fail = (msg, at = pos) => {
    throw new TomlError(msg, lineAt(at))
  }
  const eof = () => pos >= s.length
  const peek = (n = 0) => s[pos + n]
  const spaces = () => { while (peek() === ' ' || peek() === '\t') pos++ }
  const comment = () => { if (peek() === '#') while (!eof() && peek() !== '\n') pos++ }
  const eol = () => peek() === '\n' || (peek() === '\r' && peek(1) === '\n')
  const skipAll = () => {
    for (;;) {
      spaces()
      if (peek() === '#') comment()
      else if (peek() === '\n') pos++
      else if (peek() === '\r' && peek(1) === '\n') pos += 2
      else return
    }
  }
  const control = (c) => (c < ' ' && c !== '\t') || c === '\x7f'

  // ---- strings
  function basicString() {
    pos++ // opening quote
    let out = ''
    for (;;) {
      if (eof() || peek() === '\n') fail('The string is never closed')
      const c = s[pos++]
      if (c === '"') return out
      if (c === '\\') out += escape()
      else if (control(c)) fail('Control characters must be escaped in a string', pos - 1)
      else out += c
    }
  }
  function escape() {
    const n = s[pos++]
    if (n in ESC) return ESC[n]
    if (n === 'u' || n === 'U') {
      const len = n === 'u' ? 4 : 8
      const hex = s.slice(pos, pos + len)
      if (hex.length !== len || !/^[0-9a-fA-F]+$/.test(hex)) fail(`Invalid \\${n} escape`, pos - 2)
      const code = parseInt(hex, 16)
      if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) fail('Not a valid Unicode character', pos - 2)
      pos += len
      return String.fromCodePoint(code)
    }
    return fail(`Unknown escape \\${n ?? ''}`, pos - 2)
  }
  function literalString() {
    pos++
    const start = pos
    while (!eof() && peek() !== "'" && peek() !== '\n') pos++
    if (peek() !== "'") fail('The string is never closed', start)
    const out = s.slice(start, pos)
    pos++
    return out
  }
  function multiBasic() {
    const at = pos
    pos += 3
    if (peek() === '\r' && peek(1) === '\n') pos += 2
    else if (peek() === '\n') pos++
    let out = ''
    for (;;) {
      if (eof()) fail('The multi-line string is never closed', at)
      if (s.startsWith('"""', pos)) {
        let extra = 0
        while (s[pos + 3 + extra] === '"') extra++
        if (extra > 2) fail('Too many quotes at the end of the string', pos)
        out += '"'.repeat(extra)
        pos += 3 + extra
        return out
      }
      const c = s[pos++]
      if (c === '\\') {
        // a backslash at the end of a line trims the line break and the white space that follows
        let q = pos
        while (s[q] === ' ' || s[q] === '\t') q++
        if (s[q] === '\n' || (s[q] === '\r' && s[q + 1] === '\n')) {
          while (/[ \t\r\n]/.test(s[q] ?? '')) q++
          pos = q
        } else out += escape()
      } else if (control(c) && c !== '\n' && c !== '\r') fail('Control characters must be escaped in a string', pos - 1)
      else out += c
    }
  }
  function multiLiteral() {
    const at = pos
    pos += 3
    if (peek() === '\r' && peek(1) === '\n') pos += 2
    else if (peek() === '\n') pos++
    const start = pos
    for (;;) {
      if (eof()) fail('The multi-line string is never closed', at)
      if (s.startsWith("'''", pos)) {
        let extra = 0
        while (s[pos + 3 + extra] === "'") extra++
        if (extra > 2) fail('Too many quotes at the end of the string', pos)
        const out = s.slice(start, pos + extra)
        pos += 3 + extra
        return out
      }
      pos++
    }
  }

  // ---- keys
  function keyPath() {
    const keys = []
    for (;;) {
      spaces()
      const c = peek()
      if (c === '"') keys.push(basicString())
      else if (c === "'") keys.push(literalString())
      else {
        const start = pos
        while (!eof() && /[A-Za-z0-9_-]/.test(peek())) pos++
        if (pos === start) fail(c === undefined || eol() ? 'Expected a key' : `Unexpected "${c}" where a key should be`)
        keys.push(s.slice(start, pos))
      }
      spaces()
      if (peek() === '.') pos++
      else return keys
    }
  }

  // ---- values
  function value() {
    const c = peek()
    if (c === '"') return s.startsWith('"""', pos) ? multiBasic() : basicString()
    if (c === "'") return s.startsWith("'''", pos) ? multiLiteral() : literalString()
    if (c === '[') return array()
    if (c === '{') return inlineTable()
    const start = pos
    while (!eof() && !/[\s,\]}#]/.test(peek())) pos++
    let tok = s.slice(start, pos)
    if (tok === '') return fail(c === undefined || eol() ? 'Expected a value' : `Unexpected "${c}" where a value should be`)
    if (tok === 'true') return true
    if (tok === 'false') return false
    // a date and time may be separated by a space
    if (/^\d{4}-\d{2}-\d{2}$/.test(tok) && peek() === ' ' && /^\d{2}:\d{2}/.test(s.slice(pos + 1, pos + 6))) {
      pos++
      const t0 = pos
      while (!eof() && !/[\s,\]}#]/.test(peek())) pos++
      tok += ' ' + s.slice(t0, pos)
    }
    if (/^\d{4}-\d{2}-\d{2}([Tt ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([Zz]|[+-]\d{2}:\d{2})?)?$/.test(tok) || /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(tok)) return tok
    if (/^[+-]?inf$/.test(tok)) return tok[0] === '-' ? -Infinity : Infinity
    if (/^[+-]?nan$/.test(tok)) return NaN
    const clean = tok.replace(/([0-9a-fA-F])_(?=[0-9a-fA-F])/g, '$1') // digit separators: 1_000, 0xDEAD_BEEF
    if (/^[+-]?(0|[1-9]\d*)$/.test(clean) && !/^[+-]?0\d/.test(tok)) {
      const n = Number(clean)
      return Number.isSafeInteger(n) ? n : clean
    }
    if (/^0x[0-9a-fA-F]+$/.test(clean) || /^0o[0-7]+$/.test(clean) || /^0b[01]+$/.test(clean)) {
      const n = Number(clean)
      return Number.isSafeInteger(n) ? n : clean
    }
    if (/^[+-]?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(clean) && /[.eE]/.test(clean)) return Number(clean)
    return fail(`Cannot read the value "${tok}" (put text in quotes)`, start)
  }
  function array() {
    pos++
    const out = []
    for (;;) {
      skipAll()
      if (peek() === ']') { pos++; return out }
      if (eof()) fail('The [ is never closed')
      out.push(value())
      skipAll()
      if (peek() === ',') pos++
      else if (peek() !== ']') fail('Expected , or ] in the array')
    }
  }
  function inlineTable() {
    pos++
    const out = {}
    closed.add(out)
    spaces()
    if (peek() === '}') { pos++; return out }
    for (;;) {
      spaces()
      const keys = keyPath()
      spaces()
      if (peek() !== '=') fail('Expected = after the key')
      pos++
      spaces()
      assign(out, keys, value())
      spaces()
      if (peek() === ',') { pos++; continue }
      if (peek() === '}') { pos++; return out }
      fail(eol() || eof() ? 'An inline table must be on one line and end with }' : 'Expected , or } in the inline table')
    }
  }

  // ---- building the document
  function assign(table, keys, v) {
    let t = table
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (!Object.prototype.hasOwnProperty.call(t, k)) {
        const n = {}
        dotted.add(n)
        t[k] = n
      } else if (!(t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) || closed.has(t[k]) || header.has(t[k])) fail(`"${k}" is already defined and cannot be extended here`)
      t = t[k]
    }
    const last = keys[keys.length - 1]
    if (Object.prototype.hasOwnProperty.call(t, last)) fail(`Duplicate key "${last}"`)
    t[last] = v
  }

  function openTable(keys, isArray) {
    let t = root
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      let n = t[k]
      if (n === undefined) { n = {}; t[k] = n }
      else if (Array.isArray(n)) {
        if (!tableArrays.has(n)) fail(`"${k}" is a plain array, not a table`)
        n = n[n.length - 1]
      } else if (typeof n !== 'object' || n === null || closed.has(n)) fail(`"${k}" is already defined and cannot be extended here`)
      t = n
    }
    const last = keys[keys.length - 1]
    const existing = t[last]
    if (isArray) {
      if (existing === undefined) {
        const arr = []
        tableArrays.add(arr)
        t[last] = arr
      } else if (!Array.isArray(existing) || !tableArrays.has(existing)) fail(`"${last}" is already defined and is not an array of tables`)
      const item = {}
      header.add(item)
      t[last].push(item)
      return item
    }
    if (existing === undefined) {
      const n = {}
      header.add(n)
      t[last] = n
      return n
    }
    if (Array.isArray(existing) || typeof existing !== 'object' || closed.has(existing) || header.has(existing) || dotted.has(existing)) fail(`The table [${keys.join('.')}] is already defined`)
    header.add(existing) // it was only implied by a deeper header such as [a.b]
    return existing
  }

  let table = root
  while (!eof()) {
    skipAll()
    if (eof()) break
    const c = peek()
    if (c === '[') {
      const isArray = peek(1) === '['
      pos += isArray ? 2 : 1
      const keys = keyPath()
      spaces()
      if (isArray ? !(peek() === ']' && peek(1) === ']') : peek() !== ']') fail(isArray ? 'Expected ]] to close the header' : 'Expected ] to close the header')
      pos += isArray ? 2 : 1
      table = openTable(keys, isArray)
    } else {
      const keys = keyPath()
      spaces()
      if (peek() !== '=') fail('Expected = after the key')
      pos++
      spaces()
      assign(table, keys, value())
    }
    spaces()
    comment()
    if (!eof() && !eol()) fail(`Unexpected "${peek()}": expected the end of the line`)
  }
  return root
}

// ---------------------------------------------------------------- writing

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const keyText = (k) => (BARE.test(k) ? k : tomlString(k))

function tomlString(str) {
  return JSON.stringify(str).replace(/\x7f/g, '\\u007f')
}

/** Any JSON map as TOML. Returns { text, warnings }; throws TomlError when the value is not a map. */
export function toToml(value) {
  if (!isPlain(value)) throw new TomlError('TOML needs a map (key = value pairs) at the top level, not a list or a single value')
  const skipped = []
  const lines = []

  const inline = (v, where) => {
    if (typeof v === 'string') return tomlString(v)
    if (typeof v === 'boolean') return String(v)
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : Number.isNaN(v) ? 'nan' : v > 0 ? 'inf' : '-inf'
    if (Array.isArray(v)) {
      const items = []
      v.forEach((x, i) => {
        if (x === null || x === undefined) skipped.push(`${where}[${i}]`)
        else items.push(inline(x, `${where}[${i}]`))
      })
      return `[${items.join(', ')}]`
    }
    const parts = []
    for (const [k, x] of Object.entries(v)) {
      if (x === null || x === undefined) skipped.push(`${where}.${k}`)
      else parts.push(`${keyText(k)} = ${inline(x, `${where}.${k}`)}`)
    }
    return parts.length ? `{ ${parts.join(', ')} }` : '{}'
  }

  const isTableArray = (v) => Array.isArray(v) && v.length > 0 && v.every(isPlain)

  function emit(obj, path) {
    const simple = []
    const tables = []
    const arrays = []
    for (const [k, v] of Object.entries(obj)) {
      const where = [...path, k].join('.')
      if (v === null || v === undefined) skipped.push(where)
      else if (isPlain(v)) tables.push([k, v])
      else if (isTableArray(v)) arrays.push([k, v])
      else simple.push(`${keyText(k)} = ${inline(v, where)}`)
    }
    lines.push(...simple)
    for (const [k, v] of tables) {
      const p = [...path, k]
      if (lines.length) lines.push('')
      const live = Object.values(v).filter((x) => x !== null && x !== undefined)
      const hasDirect = live.some((x) => !isPlain(x) && !isTableArray(x))
      if (hasDirect || live.length === 0) lines.push(`[${p.map(keyText).join('.')}]`)
      emit(v, p)
    }
    for (const [k, items] of arrays) {
      const p = [...path, k]
      for (const item of items) {
        if (lines.length) lines.push('')
        lines.push(`[[${p.map(keyText).join('.')}]]`)
        emit(item, p)
      }
    }
  }
  emit(value, [])
  const warnings = skipped.length ? [`TOML has no null: left out ${skipped.length === 1 ? skipped[0] : `${skipped.length} values (${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? ', ...' : ''})`}`] : []
  return { text: lines.length ? lines.join('\n') + '\n' : '', warnings }
}
