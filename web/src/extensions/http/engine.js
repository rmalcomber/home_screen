// Looking things up in the HTTP reference data. Pure; unit tested in engine.test.js.
//
//   http 404 | status 404 | http not found | status 4xx     status codes
//   header content-type | headers cache                     HTTP headers
//   mime png | mime .json | mime image/png | mime font       media types
import { STATUS, STATUS_CLASS, HEADERS, MIME } from './data.js'

/** { word: 'status' | 'header' | 'mime', text } for "http …", "status …", "header(s) …", "mime(type) …", or null. */
export function parseHttpCommand(q) {
  const m = /^\s*(http|status|headers?|mime(?:type)?s?)(?:[ \t]+([\s\S]*))?$/i.exec(q || '')
  if (!m) return null
  const w = m[1].toLowerCase()
  const word = w.startsWith('header') ? 'header' : w.startsWith('mime') ? 'mime' : 'status'
  return { word, text: (m[2] || '').trim() }
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const words = (s) => norm(s).split(' ').filter(Boolean)

// The codes most people look up, shown for a bare "http"
const COMMON = [200, 201, 204, 301, 302, 304, 400, 401, 403, 404, 405, 409, 422, 429, 500, 502, 503, 504]

const toStatus = ([code, name, meaning, spec, source]) => ({ code, name, meaning, spec, source: source || '', unofficial: !!source && !/^WebDAV$/.test(source) })

/** Status codes for "404", "4xx" or "4" (a class), or words such as "not found" / "redirect". Best matches first. */
export function lookupStatus(text, limit = 8) {
  const t = text.trim()
  if (!t) return COMMON.map((c) => STATUS.find((s) => s[0] === c)).filter(Boolean).map(toStatus)
  if (/^\d{3}$/.test(t)) return STATUS.filter((s) => s[0] === Number(t)).map(toStatus)
  const cls = /^([1-5])(?:xx|\*\*)?$/i.exec(t)
  if (cls) return STATUS.filter((s) => String(s[0])[0] === cls[1]).map(toStatus)
  const q = words(t)
  if (!q.length) return []
  const scored = []
  for (const s of STATUS) {
    const name = norm(s[1])
    const meaning = norm(s[2])
    let score = 0
    for (const w of q) {
      if (name === w) score += 10
      else if (name.split(' ').includes(w)) score += 6
      else if (name.includes(w)) score += 4
      else if (meaning.split(' ').includes(w)) score += 2
      else if (meaning.includes(w)) score += 1
      else { score = 0; break }
    }
    if (score) scored.push([score, s])
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1][0] - b[1][0]).slice(0, limit).map(([, s]) => toStatus(s))
}

/** The family of a status code: "Client error: the request was wrong". */
export const statusClass = (code) => STATUS_CLASS[String(code)[0]] || ''

const toHeader = ([name, kind, description, example]) => ({ name, kind, description, example })

/** Headers by name (exact, then prefix, then contained) or by words in the description. */
export function lookupHeader(text, limit = 8) {
  const t = text.trim()
  if (!t) return []
  const q = norm(t)
  const key = q.replace(/ /g, '')
  const scored = []
  for (const h of HEADERS) {
    const name = norm(h[0])
    const nameKey = name.replace(/ /g, '')
    let score = 0
    if (nameKey === key) score = 100
    else if (nameKey.startsWith(key)) score = 60
    else if (nameKey.includes(key)) score = 40
    else if (words(t).every((w) => norm(h[2]).includes(w))) score = 10
    if (score) scored.push([score, h])
  }
  const best = Math.max(0, ...scored.map(([s]) => s))
  // when some header names match, leave out the ones that only match in their description
  return scored.filter(([s]) => best < 40 || s >= 40).sort((a, b) => b[0] - a[0] || (a[1][0] < b[1][0] ? -1 : 1)).slice(0, limit).map(([, h]) => toHeader(h))
}

const toMime = ([exts, type, description]) => ({ exts, type, description })

/** Media types by extension ("png", ".png"), by type ("image/png"), or by words ("font", "spreadsheet"). */
export function lookupMime(text, limit = 10) {
  const t = text.trim().toLowerCase().replace(/^\*?\./, '')
  if (!t) return []
  const scored = []
  for (const m of MIME) {
    const [exts, type, description] = m
    let score = 0
    if (exts.includes(t)) score = 100
    else if (type === t) score = 90
    else if (exts.some((e) => e.startsWith(t))) score = 60
    else if (type.startsWith(t)) score = 50
    else if (type.includes(t)) score = 30
    else if (words(t).every((w) => norm(description).includes(w))) score = 20
    if (score) scored.push([score, m])
  }
  const best = Math.max(0, ...scored.map(([s]) => s))
  return scored.filter(([s]) => best < 30 || s >= 30).sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, m]) => toMime(m))
}

export const statusUrl = (code) => `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${code}`
export const headerUrl = (name) => `https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/${name}`

/** The launcher text that reopens a lookup. */
export const httpFill = (word, text) => `${word} ${text}`.trim()
