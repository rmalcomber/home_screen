// JSON helpers for the launcher formatter. Pure; unit tested in json.test.js.

const lineCol = (text, pos) => {
  const before = text.slice(0, Math.max(0, pos))
  const lines = before.split('\n')
  return { line: lines.length, col: lines[lines.length - 1].length + 1 }
}

function errorAt(text, message, pos) {
  const { line, col } = lineCol(text, pos)
  return { message, pos, line, col, snippet: text.split('\n')[line - 1] ?? '' }
}

/** Lenient parser: comments, trailing commas, single quotes, unquoted keys. Returns value or throws {message,pos}. */
function parseRelaxed(src) {
  let i = 0
  const fail = (message, pos = i) => { throw { message, pos } }
  const ws = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++
      if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++ }
      else if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); if (e < 0) fail('Unterminated comment'); i = e + 2 }
      else return
    }
  }
  const str = () => {
    const q = src[i++]
    let out = ''
    for (;;) {
      if (i >= src.length) fail('Unterminated string')
      const c = src[i++]
      if (c === q) return out
      if (c !== '\\') { out += c; continue }
      const n = src[i++]
      const map = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '/': '/', '\\': '\\', "'": "'", '"': '"' }
      if (n in map) out += map[n]
      else if (n === 'u' && /^[0-9a-f]{4}$/i.test(src.slice(i, i + 4))) { out += String.fromCharCode(parseInt(src.slice(i, i + 4), 16)); i += 4 }
      else fail('Bad escape sequence', i - 2)
    }
  }
  const value = () => {
    ws()
    const c = src[i]
    if (c === '{') {
      i++
      const obj = {}
      for (;;) {
        ws()
        if (src[i] === '}') { i++; return obj }
        let key
        if (src[i] === '"' || src[i] === "'") key = str()
        else {
          const m = /^[A-Za-z_$][\w$]*|^-?\d+(\.\d+)?/.exec(src.slice(i))
          if (!m) fail('Expected a property name')
          key = m[0]; i += key.length
        }
        ws()
        if (src[i] !== ':') fail("Expected ':' after property name")
        i++
        obj[key] = value()
        ws()
        if (src[i] === ',') { i++; continue }
        if (src[i] === '}') { i++; return obj }
        fail("Expected ',' or '}'")
      }
    }
    if (c === '[') {
      i++
      const arr = []
      for (;;) {
        ws()
        if (src[i] === ']') { i++; return arr }
        arr.push(value())
        ws()
        if (src[i] === ',') { i++; continue }
        if (src[i] === ']') { i++; return arr }
        fail("Expected ',' or ']'")
      }
    }
    if (c === '"' || c === "'") return str()
    const m = /^(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|true|false|null)/.exec(src.slice(i))
    if (!m) fail(c === undefined ? 'Unexpected end of input' : `Unexpected character '${c}'`)
    i += m[0].length
    return JSON.parse(m[0])
  }
  const v = value()
  ws()
  if (i < src.length) fail('Unexpected content after the JSON value')
  return v
}

/**
 * Parse text as JSON, falling back to a lenient parse and unwrapping JSON-encoded strings.
 * Returns { ok:true, value, relaxed, unwrapped } or { ok:false, error:{message,line,col,snippet} }.
 */
export function parseJson(input) {
  const text = (input || '').trim()
  let value
  let relaxed = false
  let strictError = null
  try {
    value = JSON.parse(text)
  } catch (e) {
    const m = /position (\d+)/.exec(e.message)
    strictError = { message: e.message.replace(/ in JSON at position.*$/, '').replace(/\s*\(line.*$/, ''), pos: m ? +m[1] : 0 }
    try {
      value = parseRelaxed(text)
      relaxed = true
    } catch (e2) {
      // The lenient parser gets further than the strict one, so its failure point is the real problem.
      const err = e2 && typeof e2.pos === 'number' ? e2 : strictError
      return { ok: false, error: errorAt(text, err.message, err.pos) }
    }
  }
  let unwrapped = false
  if (typeof value === 'string' && /^\s*[[{]/.test(value)) {
    const inner = parseJson(value)
    if (inner.ok) return { ...inner, unwrapped: true }
  }
  return { ok: true, value, relaxed, unwrapped }
}

const sortKeys = (v) =>
  Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v

export function formatJson(value, { indent = 2, sort = false, minify = false } = {}) {
  const v = sort ? sortKeys(value) : value
  return minify ? JSON.stringify(v) : JSON.stringify(v, null, indent === 'tab' ? '\t' : indent)
}

export function stats(value) {
  let nodes = 0
  let depth = 0
  const walk = (v, d) => {
    nodes++
    depth = Math.max(depth, d)
    if (Array.isArray(v)) v.forEach((x) => walk(x, d + 1))
    else if (v && typeof v === 'object') Object.values(v).forEach((x) => walk(x, d + 1))
  }
  walk(value, 1)
  const type = Array.isArray(value) ? `array · ${value.length} item${value.length === 1 ? '' : 's'}` : value && typeof value === 'object' ? `object · ${Object.keys(value).length} key${Object.keys(value).length === 1 ? '' : 's'}` : typeof value
  return { type, nodes, depth, bytes: new TextEncoder().encode(JSON.stringify(value)).length }
}

/** Should the launcher show the JSON panel for this input? Avoids hijacking short searches like "[wip]". */
export function looksLikeJson(q) {
  const t = (q || '').trim()
  if (!/^[[{]/.test(t) && !/^"\s*[[{]/.test(t)) return false
  if (t.length < 2) return false
  return true
}

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

/** Split formatted JSON into [{text, cls}] tokens for syntax colouring. */
export function highlight(text) {
  const out = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    if (m[1] !== undefined) {
      out.push({ text: m[1], cls: m[2] ? 'text-info' : 'text-success' })
      if (m[2]) out.push({ text: m[2] })
    } else if (m[3] !== undefined) out.push({ text: m[0], cls: 'text-secondary' })
    else out.push({ text: m[0], cls: 'text-warning' })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}
