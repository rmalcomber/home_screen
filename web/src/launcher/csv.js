// CSV <-> JSON conversion for the launcher. Pure; unit tested in csv.test.js.
import { parseJson, formatJson } from './json.js'

const DELIMS = [',', '\t', ';', '|']

/** RFC 4180 parser: quoted fields, "" escapes, newlines inside quotes, CRLF, BOM. Blank lines are dropped. */
export function parseCsv(text, delimiter = ',') {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows = []
  let row = []
  let field = ''
  let inQ = false
  let quoted = false
  const n = text.length
  for (let i = 0; i < n; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false
      } else field += c
      continue
    }
    if (c === '"' && field === '' && !quoted) { inQ = true; quoted = true; continue }
    if (c === delimiter) { row.push(field); field = ''; quoted = false; continue }
    if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []; field = ''; quoted = false
      continue
    }
    field += c
  }
  if (field !== '' || row.length || quoted) { row.push(field); rows.push(row) }
  return { rows: rows.filter((r) => !(r.length === 1 && r[0].trim() === '')), unterminated: inQ }
}

/** Pick the delimiter that splits the first lines into a consistent number of columns. */
export function detectDelimiter(text) {
  const sample = text.length > 4000 ? text.slice(0, text.lastIndexOf('\n', 4000) > 0 ? text.lastIndexOf('\n', 4000) : 4000) : text
  let best = ','
  let bestScore = 0
  for (const d of DELIMS) {
    const { rows } = parseCsv(sample, d)
    if (!rows.length) continue
    const w0 = rows[0].length
    if (w0 < 2) continue
    const consistent = rows.filter((r) => r.length === w0).length / rows.length
    const score = consistent * 1000 + w0
    if (score > bestScore) { best = d; bestScore = score }
  }
  return best
}

export function inferType(s) {
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n) && (!/^-?\d+$/.test(s) || Number.isSafeInteger(n))) return n
    return s
  }
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === 'true'
  return s
}

const uniqueHeaders = (hs) => {
  const seen = new Map()
  return hs.map((h, i) => {
    const base = h === '' ? `column_${i + 1}` : h
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}_${n}`
  })
}

/** rows (arrays of strings) → JSON value. shape: objects | arrays | keyed (first column becomes the key). */
export function rowsToJson(rows, { header = true, infer = true, emptyNull = true, trim = true, shape = 'objects' } = {}) {
  const clean = rows.map((r) => r.map((c) => (trim ? c.trim() : c)))
  const conv = (c) => (c === '' ? (emptyNull ? null : '') : infer ? inferType(c) : c)
  const warnings = []
  if (!header || shape === 'arrays') {
    const body = header ? clean.slice(1) : clean
    return { value: body.map((r) => r.map(conv)), columns: header ? clean[0] : [], warnings }
  }
  const heads = uniqueHeaders(clean[0])
  const body = clean.slice(1)
  const ragged = body.filter((r) => r.length !== heads.length).length
  if (ragged) warnings.push(`${ragged} row${ragged === 1 ? ' has' : 's have'} a different number of columns than the header; short rows are padded and extra cells are dropped.`)
  const obj = (r) => Object.fromEntries(heads.map((h, i) => [h, conv(i < r.length ? r[i] : '')]))
  if (shape === 'keyed') {
    const out = {}
    let dup = 0
    for (const r of body) {
      const o = obj(r)
      const key = String(r[0] ?? '')
      if (key in out) dup++
      const { [heads[0]]: _k, ...rest } = o
      out[key] = rest
    }
    if (dup) warnings.push(`${dup} duplicate key${dup === 1 ? '' : 's'} in the first column; the last row wins.`)
    return { value: out, columns: heads, warnings }
  }
  return { value: body.map(obj), columns: heads, warnings }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function flatten(o, flat, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (flat && isObj(v) && Object.keys(v).length) flatten(v, flat, key, out)
    else out[key] = v
  }
  return out
}

/** JSON value → { header: string[]|null, rows: any[][] }. */
export function jsonToRows(value, { flatten: flat = true } = {}) {
  let items
  if (Array.isArray(value)) items = value
  else if (isObj(value) && Object.values(value).length && Object.values(value).every(isObj)) {
    items = Object.entries(value).map(([key, v]) => ({ key, ...v })) // { id1: {…}, id2: {…} } → rows with a key column
  } else items = [value]

  if (items.length && items.every(Array.isArray)) return { header: null, rows: items }
  const objs = items.map((it) => (isObj(it) ? flatten(it, flat) : { value: it }))
  const header = []
  const seen = new Set()
  for (const o of objs) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); header.push(k) }
  return { header, rows: objs.map((o) => header.map((k) => o[k])) }
}

const cellText = (v) => (v === null || v === undefined ? '' : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v))

export function toCsv(header, rows, { delimiter = ',', quoteAll = false, includeHeader = true } = {}) {
  const q = (s) => (quoteAll || s.includes(delimiter) || /["\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = []
  if (header && includeHeader) lines.push(header.map((h) => q(String(h))).join(delimiter))
  for (const r of rows) lines.push(r.map((c) => q(cellText(c))).join(delimiter))
  return lines.join('\n') + '\n'
}

const jsonOut = (value, { outFmt = 'pretty', indent = 2 } = {}) =>
  outFmt === 'lines' ? (Array.isArray(value) ? value.map((v) => JSON.stringify(v)).join('\n') : JSON.stringify(value)) : formatJson(value, { indent, minify: outFmt === 'min' })

/** CSV text → JSON text. */
export function csvToJson(text, o = {}) {
  const delimiter = !o.delimiter || o.delimiter === 'auto' ? detectDelimiter(text) : o.delimiter
  const { rows, unterminated } = parseCsv(text, delimiter)
  if (!rows.length) return { error: 'Nothing to convert yet: paste some CSV (or TSV).' }
  const { value, columns, warnings } = rowsToJson(rows, o)
  if (unterminated) warnings.push('A quoted field is never closed, so the end of the data was swallowed into it.')
  const count = Array.isArray(value) ? value.length : Object.keys(value).length
  return { output: jsonOut(value, o), delimiter, count, columns, warnings, preview: rows.slice(0, 9), json: true }
}

/** JSON text → CSV text. */
export function jsonToCsv(text, o = {}) {
  const r = parseJson(text)
  if (!r.ok) return { error: `That isn't valid JSON: ${r.error.message} (line ${r.error.line}, column ${r.error.col})` }
  const { header, rows } = jsonToRows(r.value, o)
  const cols = header ? header.length : Math.max(0, ...rows.map((x) => x.length))
  return { output: toCsv(header, rows, o), count: rows.length, columns: header || [], cols, warnings: r.relaxed ? ['The JSON had comments, trailing commas or single quotes; they were tolerated.'] : [], json: false, preview: [header || [], ...rows].slice(0, 9).map((x) => x.map(cellText)) }
}

/** "csv", "tsv", "csv2json", "json2csv" + text, or bare multi-line data that clearly looks like CSV/TSV → { text } | null */
export function parseCsvCommand(q) {
  const m = /^\s*(?:csv|tsv|csv2json|tsv2json|json2csv)(?:[ \t]+|\r?\n|$)([\s\S]*)$/i.exec(q || '')
  if (m) return { text: m[1] }
  const t = (q || '').trim()
  if (!t || /^[[{"]/.test(t)) return null
  const lines = t.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return null
  for (const d of DELIMS) {
    const { rows } = parseCsv(t, d)
    if (rows.length >= 2 && rows[0].length >= 2 && rows.every((r) => r.length === rows[0].length)) return { text: q }
  }
  return null
}

export const csvFill = (text) => `csv ${text}`
