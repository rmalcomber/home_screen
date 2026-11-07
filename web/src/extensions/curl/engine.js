// Parse a pasted curl command (bash style, incl. Chrome DevTools "Copy as cURL") into a structured request.
// Pure functions; the request itself is executed by the server (/api/run) because browsers enforce CORS.

/** Split a command line into words, honouring '…', "…", $'…' and backslash escapes/line continuations. */
export function shellSplit(s) {
  const out = []
  let cur = null
  let i = 0
  const push = () => { if (cur !== null) out.push(cur); cur = null }
  const add = (t) => { cur = (cur ?? '') + t }
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) { push(); i++; continue }
    if (c === '\\') {
      const n = s[i + 1]
      if (n === undefined) { i++; continue }
      if (/\s/.test(n)) { push(); i++; while (i < s.length && /\s/.test(s[i])) i++; continue } // line continuation (possibly flattened to spaces)
      add(n); i += 2; continue
    }
    if (c === "'") {
      const e = s.indexOf("'", i + 1)
      if (e < 0) throw new Error('Unterminated single quote')
      add(s.slice(i + 1, e)); i = e + 1; continue
    }
    if (c === '"') {
      i++
      let buf = ''
      for (;;) {
        if (i >= s.length) throw new Error('Unterminated double quote')
        const d = s[i]
        if (d === '"') { i++; break }
        if (d === '\\' && '"\\$`'.includes(s[i + 1] ?? '')) { buf += s[i + 1]; i += 2; continue }
        if (d === '\\' && s[i + 1] === '\n') { i += 2; continue }
        buf += d; i++
      }
      add(buf); continue
    }
    if (c === '$' && s[i + 1] === "'") {
      i += 2
      let buf = ''
      for (;;) {
        if (i >= s.length) throw new Error('Unterminated $\' quote')
        const d = s[i]
        if (d === "'") { i++; break }
        if (d !== '\\') { buf += d; i++; continue }
        const n = s[i + 1]
        const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', a: '\x07', b: '\b', f: '\f', v: '\v', e: '\x1b' }
        if (n in map) { buf += map[n]; i += 2 }
        else if (n === 'x' && /^[0-9a-f]{1,2}/i.test(s.slice(i + 2, i + 4))) { const h = s.slice(i + 2, i + 4).match(/^[0-9a-f]{1,2}/i)[0]; buf += String.fromCharCode(parseInt(h, 16)); i += 2 + h.length }
        else if (n === 'u' && /^[0-9a-f]{4}/i.test(s.slice(i + 2, i + 6))) { buf += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16)); i += 6 }
        else { buf += n ?? ''; i += 2 }
      }
      add(buf); continue
    }
    add(c); i++
  }
  push()
  return out
}

const LONG_WITH_ARG = new Set(['request', 'header', 'data', 'data-raw', 'data-binary', 'data-ascii', 'data-urlencode', 'user', 'user-agent', 'referer', 'cookie', 'form', 'url', 'max-time', 'json', 'output', 'proxy', 'connect-timeout', 'retry', 'cacert', 'cert', 'key', 'resolve', 'oauth2-bearer', 'range', 'limit-rate', 'upload-file', 'write-out', 'proxy-user', 'cookie-jar'])
const SHORT_WITH_ARG = new Set(['X', 'H', 'd', 'u', 'A', 'e', 'b', 'F', 'o', 'm', 'x', 'T', 'w', 'c', 'E', 'r'])
const SHORT_TO_LONG = { X: 'request', H: 'header', d: 'data', u: 'user', A: 'user-agent', e: 'referer', b: 'cookie', F: 'form', m: 'max-time', L: 'location', k: 'insecure', I: 'head', G: 'get' }

const b64 = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str)))

/** Returns { ok:true, method, url, origin, path, params, headers, implied, body, bodyKind, bodyPretty, … } or { ok:false, error }. */
export function parseCurl(input) {
  let words
  try { words = shellSplit(input.trim()) } catch (e) { return { ok: false, error: e.message } }
  if (!words.length || words[0].toLowerCase() !== 'curl') return { ok: false, error: 'Not a curl command' }

  const o = { method: null, headers: [], data: [], urlencode: [], form: false, follow: false, insecure: false, head: false, get: false, user: null, timeout: null, json: null, urls: [] }
  const warnings = []
  const apply = (name, val) => {
    switch (name) {
      case 'request': o.method = val.toUpperCase(); break
      case 'header': {
        const k = val.indexOf(':')
        if (k > 0) o.headers.push([val.slice(0, k).trim(), val.slice(k + 1).trim()])
        break
      }
      case 'data': case 'data-raw': case 'data-binary': case 'data-ascii':
        if (name !== 'data-raw' && val.startsWith('@')) warnings.push(`Reading data from a file (${val}) isn't supported`)
        else o.data.push(val)
        break
      case 'data-urlencode': {
        const k = val.indexOf('=')
        o.data.push(k < 0 ? encodeURIComponent(val) : (k === 0 ? '' : val.slice(0, k) + '=') + encodeURIComponent(val.slice(k + 1)))
        break
      }
      case 'json': o.json = val; break
      case 'user': o.user = val; break
      case 'user-agent': o.headers.push(['User-Agent', val]); break
      case 'referer': o.headers.push(['Referer', val]); break
      case 'cookie': if (!val.startsWith('@') && val.includes('=')) o.headers.push(['Cookie', val]); break
      case 'oauth2-bearer': o.headers.push(['Authorization', `Bearer ${val}`]); break
      case 'form': o.form = true; break
      case 'url': o.urls.push(val); break
      case 'max-time': { const n = parseFloat(val); if (n > 0) o.timeout = Math.ceil(n); break }
      case 'location': o.follow = true; break
      case 'insecure': o.insecure = true; break
      case 'head': o.head = true; break
      case 'get': o.get = true; break
      default: break // -s -S -v -i --compressed … don't change the request
    }
  }

  for (let i = 1; i < words.length; i++) {
    const w = words[i]
    if (w.startsWith('--') && w.length > 2) {
      let name = w.slice(2)
      let val
      const eq = name.indexOf('=')
      if (eq > 0) { val = name.slice(eq + 1); name = name.slice(0, eq) }
      if (LONG_WITH_ARG.has(name)) { if (val === undefined) val = words[++i] ?? '' ; apply(name, val) }
      else apply(name, '')
    } else if (w.startsWith('-') && w.length > 1) {
      // bundles like -sSL, -XPOST, -H'x: y'
      for (let k = 1; k < w.length; k++) {
        const f = w[k]
        if (SHORT_WITH_ARG.has(f)) {
          const rest = w.slice(k + 1)
          const val = rest || (words[++i] ?? '')
          if (SHORT_TO_LONG[f]) apply(SHORT_TO_LONG[f], val)
          break
        }
        if (SHORT_TO_LONG[f]) apply(SHORT_TO_LONG[f], '')
      }
    } else o.urls.push(w)
  }

  let rawUrl = o.urls[0]
  if (!rawUrl) return { ok: false, error: 'No URL found in the command' }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl)) rawUrl = 'http://' + rawUrl

  let body = o.json !== null ? o.json : o.data.length ? o.data.join('&') : null
  let u
  try { u = new URL(rawUrl) } catch { return { ok: false, error: `Invalid URL: ${rawUrl}` } }
  u.hash = ''
  if (o.get && body !== null && o.json === null) {
    u.search = (u.search ? u.search + '&' : '?') + body
    body = null
  }

  const headers = o.headers.map(([k, v]) => [k, v])
  const has = (n) => headers.some(([k]) => k.toLowerCase() === n)
  const implied = []
  const addImplied = (k, v) => { headers.push([k, v]); implied.push(k) }
  if (o.json !== null) {
    if (!has('content-type')) addImplied('Content-Type', 'application/json')
    if (!has('accept')) addImplied('Accept', 'application/json')
  }
  if (body !== null && !has('content-type')) addImplied('Content-Type', 'application/x-www-form-urlencoded')
  let userLabel = null
  if (o.user) {
    userLabel = o.user.split(':')[0]
    if (!has('authorization')) addImplied('Authorization', 'Basic ' + b64(o.user.includes(':') ? o.user : o.user + ':'))
  }

  const method = o.method || (o.head ? 'HEAD' : body !== null ? 'POST' : 'GET')
  const params = [...u.searchParams.entries()]

  const ct = (headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] || '').toLowerCase()
  let bodyKind = null
  let bodyPretty = null
  let bodyParams = null
  if (body !== null) {
    try { bodyPretty = JSON.stringify(JSON.parse(body), null, 2); bodyKind = 'json' } catch { /* not JSON */ }
    if (!bodyKind && ct.includes('x-www-form-urlencoded') && !/[\n{]/.test(body)) { bodyKind = 'form'; bodyParams = [...new URLSearchParams(body).entries()] }
    if (!bodyKind) bodyKind = 'text'
  }

  if (o.form) warnings.push('Multipart forms (-F) are not supported by the runner')

  return {
    ok: true,
    method,
    url: u.toString(),
    origin: u.origin,
    path: u.pathname,
    params,
    headers,
    implied,
    body,
    bodyKind,
    bodyPretty,
    bodyParams,
    follow: o.follow,
    insecure: o.insecure,
    timeout: o.timeout,
    user: userLabel,
    warnings,
    unsupported: o.form || (o.data.length === 0 && o.json === null && warnings.some((w) => w.startsWith('Reading data'))),
  }
}

/** Payload for POST /api/run (duplicate headers merged the way an HTTP client would). */
export function runPayload(p) {
  const merged = new Map()
  for (const [k, v] of p.headers) {
    const key = k.toLowerCase()
    const prev = merged.get(key)
    merged.set(key, prev ? { k: prev.k, v: prev.v + (key === 'cookie' ? '; ' : ', ') + v } : { k, v })
  }
  return {
    method: p.method,
    url: p.url,
    headers: [...merged.values()].map(({ k, v }) => [k, v]),
    body: p.body,
    follow: p.follow,
    insecure: p.insecure,
    timeout: p.timeout,
  }
}

export const looksLikeCurl = (q) => /^\s*curl(\s|$)/i.test(q)
