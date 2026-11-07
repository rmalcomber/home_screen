// URL and HTML encoding for the launcher. Pure; unit tested in engine.test.js.
//
//   url <text>        encode / decode, and a table of the parts when the text is a URL or has a query string
//   urlencode / urldecode <text>
//   html <text>       HTML entities, both ways (htmlencode / htmldecode for one way)
//   qs <text>         parse a query string or URL into a table

const WORDS = ['url', 'urlencode', 'urldecode', 'html', 'htmlencode', 'htmldecode', 'qs', 'query']

/** { word, text } for "url …", "html …", "qs …" and the encode/decode variants, or null. */
export function parseUrlCommand(q) {
  const m = new RegExp(`^\\s*(${WORDS.join('|')})(?:[ \\t]+|\\r?\\n|$)([\\s\\S]*)$`, 'i').exec(q || '')
  if (!m) return null
  const word = m[1].toLowerCase()
  return { word: word === 'query' ? 'qs' : word, text: m[2].replace(/\s+$/, '') }
}

export const encodeComponent = (s) => encodeURIComponent(s)
export const encodeFull = (s) => {
  try {
    return encodeURI(s)
  } catch {
    return null // lone surrogate
  }
}

/** Decodes %XX sequences; null when the text is not valid. `form` also turns + into a space. */
export function decodeComponent(s, { form = false } = {}) {
  try {
    return decodeURIComponent(form ? s.replace(/\+/g, ' ') : s)
  } catch {
    return null
  }
}

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', bull: '•', middot: '·', euro: '€', pound: '£', yen: '¥', cent: '¢',
  deg: '°', plusmn: '±', times: '×', divide: '÷', sect: '§', para: '¶', larr: '←', rarr: '→', uarr: '↑', darr: '↓', hearts: '♥', check: '✓',
}

/** Escapes the five characters that matter in HTML. */
export const htmlEncode = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Escapes everything outside printable ASCII as numeric entities as well. */
export const htmlEncodeAll = (s) =>
  htmlEncode(s).replace(/[^\x20-\x7e\n\r\t]/gu, (c) => `&#${c.codePointAt(0)};`)

/** Decodes numeric entities and the common named ones; unknown names are left alone. */
export function htmlDecode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : m
    }
    return NAMED[e.toLowerCase()] ?? NAMED[e] ?? m
  })
}

const looksLikeUrl = (s) => /^[a-z][a-z0-9+.-]*:\/\//i.test(s.trim()) || /^(mailto|tel|data|file):/i.test(s.trim())

/**
 * Splits a URL, a "?a=b" fragment, or a bare "a=b&c=d" into parts and parameters.
 * Returns { ok, isUrl, parts: [[label, value]], params: [{ key, value }], error? }.
 */
export function parseUrl(text) {
  const t = (text || '').trim()
  if (!t) return { ok: false, error: 'Nothing to parse' }
  let query = ''
  const parts = []
  let isUrl = false
  if (looksLikeUrl(t)) {
    let u
    try {
      u = new URL(t)
    } catch {
      return { ok: false, error: 'That does not look like a valid URL' }
    }
    isUrl = true
    query = u.search.slice(1)
    const add = (label, value) => { if (value) parts.push([label, value]) }
    add('Scheme', u.protocol.replace(/:$/, ''))
    add('User', decodeComponent(u.username) ?? u.username)
    add('Password', u.password ? '••••' : '')
    add('Host', u.hostname)
    add('Port', u.port)
    add('Path', decodeComponent(u.pathname) ?? u.pathname)
    add('Query', u.search.slice(1))
    add('Fragment', decodeComponent(u.hash.slice(1)) ?? u.hash.slice(1))
    add('Origin', u.origin !== 'null' ? u.origin : '')
  } else {
    query = t.startsWith('?') ? t.slice(1) : t
    const h = query.indexOf('#')
    if (h >= 0) query = query.slice(0, h)
    if (!query.includes('=')) return { ok: false, error: 'No query string found (expected key=value pairs)' }
  }
  const params = []
  for (const piece of query.split('&')) {
    if (!piece) continue
    const eq = piece.indexOf('=')
    const rawKey = eq < 0 ? piece : piece.slice(0, eq)
    const rawVal = eq < 0 ? '' : piece.slice(eq + 1)
    params.push({ key: decodeComponent(rawKey, { form: true }) ?? rawKey, value: decodeComponent(rawVal, { form: true }) ?? rawVal })
  }
  if (!isUrl && !params.length) return { ok: false, error: 'No query string found' }
  return { ok: true, isUrl, parts, params }
}

/** Does this text look like something worth parsing (a URL, or key=value pairs)? */
export const parseable = (text) => looksLikeUrl(text) || /^\??[^\s=&]+=[^\s]*(&[^\s=&]+=?[^\s]*)*$/.test((text || '').trim())

/** The launcher text that reopens a parse. */
export const urlFill = (word, text) => `${word} ${text}`
