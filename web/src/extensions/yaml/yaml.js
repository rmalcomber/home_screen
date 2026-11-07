// A small YAML reader and writer: the part of YAML that configuration files and API examples use.
// Pure; unit tested in yaml.test.js.
//
// Reads: block maps and lists (nested, and "- key: value"), plain, 'single' and "double" quoted scalars (also across lines),
// flow [lists] and {maps}, | and > block scalars with chomping and indent indicators, comments, a leading --- and trailing ...
// Types follow the YAML 1.2 core schema: null/~/empty, true/false, integers (also 0x and 0o), floats; everything else is text.
// Refuses, with a message and a line number: anchors, aliases, tags, merge keys (<<), complex keys (?), several documents,
// tabs as indentation, and plain text that continues over several lines (use quotes or | instead).

export class YamlError extends Error {
  constructor(message, line) {
    super(line ? `Line ${line}: ${message}` : message)
    this.name = 'YamlError'
    this.line = line || null
  }
}

const ESCAPES = { 0: '\0', a: '\x07', b: '\b', t: '\t', '\t': '\t', n: '\n', v: '\v', f: '\f', r: '\r', e: '\x1b', ' ': ' ', '"': '"', '/': '/', '\\': '\\', N: '\u0085', _: '\u00a0', L: '\u2028', P: '\u2029' }

/** Turns the text of a plain scalar into null, a boolean, a number or a string (YAML 1.2 core schema). */
export function resolveScalar(s) {
  if (s === '' || s === '~' || /^(null|Null|NULL)$/.test(s)) return null
  if (/^(true|True|TRUE)$/.test(s)) return true
  if (/^(false|False|FALSE)$/.test(s)) return false
  if (/^[-+]?[0-9]+$/.test(s)) {
    const n = Number(s)
    return Number.isSafeInteger(n) ? n : s // too large to keep exactly: stays text
  }
  if (/^0o[0-7]+$/.test(s)) return parseInt(s.slice(2), 8)
  if (/^0x[0-9a-fA-F]+$/.test(s)) {
    const n = parseInt(s.slice(2), 16)
    return Number.isSafeInteger(n) ? n : s
  }
  if (/^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/.test(s)) return Number(s)
  return s
}

/** Cuts a trailing " # comment" from text that is not inside quotes. */
function stripComment(s) {
  let q = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '\\' && q === '"') i++
      else if (c === q) {
        if (q === "'" && s[i + 1] === "'") i++
        else q = null
      }
    } else if ((c === '"' || c === "'") && (i === 0 || /[\s[{,:]/.test(s[i - 1]))) q = c
    else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).replace(/\s+$/, '')
  }
  return s.replace(/\s+$/, '')
}

export function parseYaml(text) {
  const raw = String(text).replace(/^﻿/, '').split(/\r?\n/)
  const lines = raw.map((r, k) => {
    const indent = r.length - r.replace(/^ +/, '').length
    return { no: k + 1, raw: r, indent, text: r.slice(indent), blank: /^\s*(#.*)?$/.test(r), tab: /^ *\t/.test(r) }
  })
  let p = 0

  const fail = (msg, line) => {
    throw new YamlError(msg, line?.no)
  }
  const cur = () => {
    while (p < lines.length && lines[p].blank) p++
    return p < lines.length ? lines[p] : null
  }
  const check = (l) => {
    if (l.tab) fail('Tabs cannot be used for indentation; use spaces', l)
  }

  // ---- quoted scalars (may continue over several lines)
  function quoted(rest, line) {
    const q = rest[0]
    let buf = rest.slice(1)
    let out = ''
    let escapedBreak = false
    for (;;) {
      let closed = -1
      escapedBreak = false
      for (let i = 0; i < buf.length; i++) {
        const c = buf[i]
        if (q === '"' && c === '\\') {
          const n = buf[i + 1]
          if (n === undefined) { escapedBreak = true; break } // "\" at the end of a line joins it with the next
          if (n === 'x' || n === 'u' || n === 'U') {
            const len = n === 'x' ? 2 : n === 'u' ? 4 : 8
            const hex = buf.slice(i + 2, i + 2 + len)
            if (hex.length !== len || !/^[0-9a-fA-F]+$/.test(hex)) fail(`Invalid escape \\${n}${hex}`, line)
            out += String.fromCodePoint(parseInt(hex, 16))
            i += 1 + len
          } else if (n in ESCAPES) {
            out += ESCAPES[n]
            i++
          } else fail(`Unknown escape \\${n}`, line)
        } else if (q === "'" && c === "'") {
          if (buf[i + 1] === "'") { out += "'"; i++ } else { closed = i; break }
        } else if (q === '"' && c === '"') {
          closed = i
          break
        } else out += c
      }
      if (closed >= 0) {
        const after = buf.slice(closed + 1).trim()
        if (after && after[0] !== '#') fail('Unexpected text after the closing quote', line)
        return { value: out }
      }
      // not closed on this line: fold in the next one (a blank line becomes a line break, otherwise a space)
      let blanks = 0
      let next
      do {
        if (p >= lines.length) fail('The quoted text is never closed', line)
        next = lines[p++].raw.trim()
        if (next === '') blanks++
      } while (next === '')
      if (!escapedBreak) out = out.replace(/[ \t]+$/, '') + (blanks ? '\n'.repeat(blanks) : ' ')
      buf = next
    }
  }

  // ---- flow collections: [a, b] and {a: 1}
  const depthOf = (s) => {
    let d = 0
    let q = null
    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      if (q) {
        if (c === '\\' && q === '"') i++
        else if (c === q) {
          if (q === "'" && s[i + 1] === "'") i++
          else q = null
        }
      } else if (c === '"' || c === "'") q = c
      else if (c === '[' || c === '{') d++
      else if (c === ']' || c === '}') d--
    }
    return d
  }
  function flowValue(rest, line) {
    let buf = stripComment(rest)
    while (depthOf(buf) > 0) {
      if (p >= lines.length) fail('The [ or { is never closed', line)
      const next = lines[p++]
      if (!next.blank) buf += ' ' + stripComment(next.text)
    }
    let pos = 0
    const ws = () => { while (pos < buf.length && /\s/.test(buf[pos])) pos++ }
    const readQuoted = () => {
      const q = buf[pos]
      let out = ''
      pos++
      for (; pos < buf.length; pos++) {
        const c = buf[pos]
        if (q === '"' && c === '\\') {
          const n = buf[pos + 1]
          if (n === 'x' || n === 'u' || n === 'U') {
            const len = n === 'x' ? 2 : n === 'u' ? 4 : 8
            out += String.fromCodePoint(parseInt(buf.slice(pos + 2, pos + 2 + len), 16))
            pos += 1 + len
          } else if (n in ESCAPES) {
            out += ESCAPES[n]
            pos++
          } else fail(`Unknown escape \\${n}`, line)
        } else if (q === "'" && c === "'") {
          if (buf[pos + 1] === "'") { out += "'"; pos++ } else { pos++; return out }
        } else if (q === '"' && c === '"') {
          pos++
          return out
        } else out += c
      }
      return fail('The quoted text is never closed', line)
    }
    const readPlain = (isKey) => {
      const start = pos
      while (pos < buf.length) {
        const c = buf[pos]
        if (c === ',' || c === ']' || c === '}') break
        if (c === ':' && (pos + 1 === buf.length || /[\s,\]}]/.test(buf[pos + 1]))) { if (isKey) break }
        pos++
      }
      return buf.slice(start, pos).trim()
    }
    const node = () => {
      ws()
      const c = buf[pos]
      if (c === '[') {
        pos++
        const arr = []
        for (;;) {
          ws()
          if (buf[pos] === ']') { pos++; return arr }
          arr.push(node())
          ws()
          if (buf[pos] === ',') pos++
          else if (buf[pos] !== ']') fail('Expected , or ] in the list', line)
        }
      }
      if (c === '{') {
        pos++
        const obj = {}
        for (;;) {
          ws()
          if (buf[pos] === '}') { pos++; return obj }
          let key
          if (buf[pos] === '"' || buf[pos] === "'") key = readQuoted()
          else key = readPlain(true)
          if (key === undefined || (key === '' && buf[pos] !== ':')) fail('Expected a key in the map', line)
          ws()
          let value = null
          if (buf[pos] === ':') {
            pos++
            ws()
            value = buf[pos] === ',' || buf[pos] === '}' ? null : node()
          }
          if (Object.prototype.hasOwnProperty.call(obj, key)) fail(`Duplicate key "${key}"`, line)
          obj[key] = value
          ws()
          if (buf[pos] === ',') pos++
          else if (buf[pos] !== '}') fail('Expected , or } in the map', line)
        }
      }
      if (c === '"' || c === "'") return readQuoted()
      if (c === '&' || c === '*' || c === '!') fail('Anchors, aliases and tags are not supported', line)
      return resolveScalar(readPlain(false))
    }
    const value = node()
    ws()
    if (pos < buf.length) fail(`Unexpected "${buf.slice(pos, pos + 10)}" after the flow collection`, line)
    return value
  }

  // ---- block scalars: | and >
  function blockScalar(header, line, parentIndent) {
    const h = /^([|>])(?:([1-9])([+-]?)|([+-]?)([1-9])?)\s*(?:#.*)?$/.exec(header)
    if (!h) fail('Invalid block scalar header (expected | or > with an optional - or +)', line)
    const folded = h[1] === '>'
    const chomp = h[3] || h[4] || ''
    const explicit = h[2] || h[5] ? Number(h[2] || h[5]) : 0
    let blockIndent = explicit ? Math.max(parentIndent, 0) + explicit : -1
    const body = []
    while (p < lines.length) {
      const r = lines[p].raw
      if (r.trim() === '') { body.push(''); p++; continue }
      const ind = r.length - r.replace(/^ +/, '').length
      if (blockIndent < 0) {
        if (ind <= parentIndent) break
        blockIndent = ind
      }
      if (ind < blockIndent) break
      body.push(r.slice(blockIndent))
      p++
    }
    // trailing empty lines belong to chomping, not to the text
    let trail = 0
    while (body.length && body[body.length - 1] === '') { body.pop(); trail++ }
    // lines handed back after a block that ended on blank lines are fine: they are blank
    let value
    if (!folded) value = body.join('\n')
    else {
      value = ''
      body.forEach((ln, k) => {
        if (k === 0) { value += ln; return }
        const prev = body[k - 1]
        if (ln === '') value += '\n'
        else if (prev === '') value += ln
        else if (/^\s/.test(ln) || /^\s/.test(prev)) value += '\n' + ln
        else value += ' ' + ln
      })
    }
    if (!body.length) return chomp === '+' ? '\n'.repeat(trail) : ''
    if (chomp === '-') return value
    if (chomp === '+') return value + '\n'.repeat(trail + 1)
    return value + '\n'
  }

  function parseInline(rest, line, parentIndent) {
    const c = rest[0]
    if (c === '|' || c === '>') return blockScalar(rest, line, parentIndent)
    if (c === '[' || c === '{') return flowValue(rest, line)
    if (c === '"' || c === "'") return quotedValue(rest, line)
    if (c === '&' || c === '*' || c === '!') fail('Anchors, aliases and tags are not supported', line)
    if (c === '@' || c === '`') fail(`"${c}" cannot start a value; put the text in quotes`, line)
    const value = stripComment(rest)
    if (/^-(\s|$)/.test(value)) fail('A list cannot start on the same line as its key', line)
    if (/:(\s|$)/.test(value)) fail('A plain value cannot contain ": " (put the text in quotes)', line)
    return resolveScalar(value)
  }

  function quotedValue(rest, line) {
    const { value } = quoted(rest, line)
    return value
  }

  // ---- keys
  function splitKey(t, line) {
    const c = t[0]
    if (c === '[' || c === '{') return null
    if (c === '?' && /^\?(\s|$)/.test(t)) fail('Complex keys (starting with ?) are not supported', line)
    if (c === '"' || c === "'") {
      let i = 1
      for (; i < t.length; i++) {
        if (c === '"' && t[i] === '\\') i++
        else if (t[i] === c) {
          if (c === "'" && t[i + 1] === "'") i++
          else break
        }
      }
      if (i >= t.length) return null
      const after = t.slice(i + 1)
      const m = /^\s*:(\s|$)/.exec(after)
      if (!m) return null
      const k = quoted(t.slice(0, i + 1), line).value
      return { key: k, rest: after.slice(m[0].length) }
    }
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '#' && i > 0 && /\s/.test(t[i - 1])) return null
      if (t[i] === ':' && (i + 1 === t.length || /\s/.test(t[i + 1]))) {
        const key = t.slice(0, i).trim()
        if (!key) return null
        if (key[0] === '&' || key[0] === '*' || key[0] === '!') fail('Anchors, aliases and tags are not supported', line)
        return { key, rest: t.slice(i + 1) }
      }
    }
    return null
  }

  // ---- blocks
  function parseBlock(l) {
    check(l)
    const t = l.text
    if (/^-(\s|$)/.test(t)) return parseSeq(l.indent)
    if (splitKey(t, l)) return parseMap(l.indent)
    p++
    return parseInline(t, l, l.indent - 1)
  }

  function parseSeq(indent) {
    const out = []
    for (;;) {
      const l = cur()
      if (!l || l.indent < indent) break
      check(l)
      if (l.indent > indent) fail('Unexpected indentation', l)
      if (!/^-(\s|$)/.test(l.text)) break
      const after = l.text.slice(1)
      const rest = after.replace(/^\s+/, '')
      const col = l.indent + 1 + (after.length - rest.length)
      if (rest === '' || rest[0] === '#') {
        p++
        const n = cur()
        out.push(n && n.indent > indent ? parseBlock(n) : null)
        continue
      }
      if (/^-(\s|$)/.test(rest) || splitKey(rest, l)) {
        lines[p] = { ...l, indent: col, text: rest }
        out.push(parseBlock(lines[p]))
        continue
      }
      p++
      out.push(parseInline(rest, l, indent))
    }
    return out
  }

  function parseMap(indent) {
    const out = {}
    for (;;) {
      const l = cur()
      if (!l || l.indent < indent) break
      check(l)
      if (l.indent > indent) fail('Unexpected indentation. A long plain value cannot continue on the next line: use quotes, | or >', l)
      const sk = splitKey(l.text, l)
      if (!sk) {
        if (/^-(\s|$)/.test(l.text) || /^(---|\.\.\.)(\s|$)/.test(l.text)) break
        fail('Expected "key: value" here', l)
      }
      if (sk.key === '<<') fail('Merge keys (<<) and anchors are not supported', l)
      if (Object.prototype.hasOwnProperty.call(out, sk.key)) fail(`Duplicate key "${sk.key}"`, l)
      p++
      const rest = sk.rest.replace(/^\s+/, '')
      let value
      if (rest === '' || rest[0] === '#') {
        const n = cur()
        if (n && n.indent > indent) value = parseBlock(n)
        else if (n && n.indent === indent && /^-(\s|$)/.test(n.text)) value = parseSeq(indent)
        else value = null
      } else value = parseInline(rest, l, indent)
      out[sk.key] = value
    }
    return out
  }

  // ---- document
  while (p < lines.length && (lines[p].blank || /^%/.test(lines[p].text))) p++
  if (p < lines.length && /^---(\s|$)/.test(lines[p].text)) {
    const first = lines[p]
    const after = first.text.slice(3).trim()
    if (after && after[0] !== '#') fail('Put the content of the document on the line after ---', first)
    p++
  }
  const first = cur()
  if (!first) return null
  const value = parseBlock(first)
  const left = cur()
  if (left) {
    if (/^---(\s|$)/.test(left.text)) fail('Several documents in one file are not supported', left)
    if (!/^\.\.\.(\s|$)/.test(left.text)) fail('Unexpected content', left)
  }
  return value
}

// ---------------------------------------------------------------- writing

const RESERVED = /^(null|Null|NULL|~|true|True|TRUE|false|False|FALSE|yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF)$/
const NUMBERISH = /^[-+]?(\.[0-9]+|[0-9][0-9_,]*(\.[0-9_]*)?)([eE][-+]?[0-9]+)?$|^0[xob][0-9a-fA-F_]+$|^[-+]?\.(inf|Inf|INF|nan|NaN|NAN)$/
const DATEISH = /^\d{4}-\d{1,2}-\d{1,2}([Tt ].*)?$|^\d{1,2}:\d{2}(:\d{2})?$/

/** Can this text be written as a plain scalar and read back as the same string? */
export function plainSafe(s) {
  if (s === '' || s !== s.trim()) return false
  if (RESERVED.test(s) || NUMBERISH.test(s) || DATEISH.test(s)) return false
  if (/[\n\r\t\0-\x1f\x7f\u0085\u2028\u2029]/.test(s)) return false
  if (/^[-?:](\s|$)/.test(s) || /^[[\]{},#&*!|>'"%@`]/.test(s)) return false
  if (/:(\s|$)/.test(s) || /\s#/.test(s)) return false
  if (/^(---|\.\.\.)(\s|$)/.test(s)) return false
  return true
}

const quote = (s) => JSON.stringify(s) // JSON strings are valid YAML double-quoted scalars

function scalarText(v) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return String(v)
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : Number.isNaN(v) ? '.nan' : v > 0 ? '.inf' : '-.inf'
  const s = String(v)
  return s === '' ? "''" : plainSafe(s) ? s : quote(s)
}

const keyText = (k) => (k === '' ? "''" : plainSafe(k) ? k : quote(k))
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isEmptyContainer = (v) => (Array.isArray(v) ? v.length === 0 : isObj(v) && Object.keys(v).length === 0)
const emptyText = (v) => (Array.isArray(v) ? '[]' : '{}')

/** Can a string be written as a | block (keeps its line breaks readable)? */
const blockable = (s) => typeof s === 'string' && s.includes('\n') && !/[\r\0-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s) && !/^\s/.test(s) && !/^\s*\n/.test(s)

function blockScalarLines(s, pad) {
  const trailing = s.length - s.replace(/\n+$/, '').length
  const header = trailing === 0 ? '|-' : trailing === 1 ? '|' : '|+'
  const body = s.replace(/\n+$/, '').split('\n').map((ln) => (ln === '' ? '' : pad + ln))
  if (trailing > 1) for (let i = 1; i < trailing; i++) body.push('')
  return { header, body }
}

function emitBlock(value, depth) {
  const pad = '  '.repeat(depth)
  const out = []
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isEmptyContainer(item)) out.push(`${pad}- ${emptyText(item)}`)
      else if (Array.isArray(item) || isObj(item)) {
        const inner = emitBlock(item, depth + 1)
        inner[0] = `${pad}- ${inner[0].slice(pad.length + 2)}`
        out.push(...inner)
      } else if (blockable(item)) {
        const { header, body } = blockScalarLines(item, pad + '  ')
        out.push(`${pad}- ${header}`, ...body)
      } else out.push(`${pad}- ${scalarText(item)}`)
    }
    return out
  }
  for (const [k, v] of Object.entries(value)) {
    const key = keyText(k)
    if (isEmptyContainer(v)) out.push(`${pad}${key}: ${emptyText(v)}`)
    else if (Array.isArray(v) || isObj(v)) out.push(`${pad}${key}:`, ...emitBlock(v, depth + 1))
    else if (blockable(v)) {
      const { header, body } = blockScalarLines(v, pad + '  ')
      out.push(`${pad}${key}: ${header}`, ...body)
    } else out.push(`${pad}${key}: ${scalarText(v)}`)
  }
  return out
}

/** Any JSON value as YAML text (two-space indent, ends with a newline). */
export function toYaml(value) {
  if (value !== null && typeof value === 'object' && !isEmptyContainer(value)) return emitBlock(value, 0).join('\n') + '\n'
  if (isEmptyContainer(value)) return emptyText(value) + '\n'
  if (blockable(value)) {
    const { header, body } = blockScalarLines(value, '  ')
    return [header, ...body].join('\n') + '\n'
  }
  return scalarText(value) + '\n'
}
