// Clean up, step 3: is a link still alive? Each address is asked once through the server's /api/run (browsers cannot call other
// sites), without following redirects, so a move can be told apart from a working page. Pure apart from the injected `send`;
// unit tested.

import { parseWeb, urlKey, isLocalHost } from './links.js'

export const USER_AGENT = 'Mozilla/5.0 (compatible; HomeScreen-LinkCheck/1.0; +https://github.com/rmalcomber/home_screen)'

/** The payload for POST /api/run: one request that does not follow redirects. */
export const checkRequest = (url, method) => ({
  method,
  url,
  headers: [['User-Agent', USER_AGENT], ['Accept', 'text/html,application/xhtml+xml,*/*;q=0.8'], ['Accept-Language', 'en']],
  body: null,
  follow: false,
  insecure: false,
  timeout: 15,
})

const header = (res, name) => (res.headers || []).find(([k]) => k.toLowerCase() === name)?.[1] || ''

/** Where a redirect leads, as an absolute address ('' when it cannot be told). */
export function redirectTarget(url, res) {
  const loc = header(res, 'location')
  if (!loc) return ''
  try {
    return new URL(loc, url).href
  } catch {
    return ''
  }
}

/** Is `to` just `from` with a trailing slash, another case, or http turned into https? */
const sameDestination = (from, to) => urlKey(from) === urlKey(to)

/**
 * Read one server answer. → { status, code?, to?, note?, warn?, retry? }
 *   status: ok | moved | temp | dead | blocked | timeout | error
 *   retry:  true when a different method might get a truer answer (HEAD refused, 404 on HEAD...)
 */
export function classify(url, res) {
  if (res.error) {
    const e = String(res.error)
    if (/timed? ?out|deadline/i.test(e)) return { status: 'timeout', note: 'No answer in time' }
    if (/dns|resolve|lookup|not known|no such host|no address|name or service/i.test(e)) return { status: 'dead', note: 'The address does not exist (DNS lookup failed)' }
    if (/refused/i.test(e)) return { status: 'dead', note: 'The server refused the connection' }
    if (/certificate|tls|ssl|handshake/i.test(e)) return { status: 'dead', note: 'The security certificate is not valid' }
    return { status: 'error', note: e.slice(0, 120) }
  }
  const code = res.status
  if (code >= 200 && code < 300) return { status: 'ok', code }
  if (code >= 300 && code < 400) {
    const to = redirectTarget(url, res)
    if (!to) return { status: 'ok', code, note: 'Redirects without a destination' }
    const permanent = code === 301 || code === 308
    if (sameDestination(url, to)) {
      const upgrade = /^http:/i.test(url.trim()) && /^https:/i.test(to)
      return upgrade ? { status: 'moved', code, to, note: 'Now served over https' } : { status: 'ok', code }
    }
    const t = parseWeb(to)
    const f = parseWeb(url)
    // A page that now sends everyone to the site's front page or a sign-in page is probably gone.
    const home = t && (t.pathname === '/' || t.pathname === '') && f && f.pathname.replace(/\/+$/, '') !== ''
    const login = t && /\b(log-?in|sign-?in|signin|auth|sso|account)\b/i.test(t.pathname + t.search)
    const warn = !!(home || login)
    const note = login ? 'Redirects to a sign-in page' : home ? 'Redirects to the front page: the page may be gone' : permanent ? 'Moved permanently' : ''
    return { status: permanent ? 'moved' : 'temp', code, to, note, warn }
  }
  if (code === 404 || code === 410) return { status: 'dead', code, note: code === 410 ? 'Gone' : 'Not found', retry: true }
  if (code === 401 || code === 403 || code === 429 || code === 999 || code === 451) return { status: 'blocked', code, note: code === 429 ? 'Rate limited' : code === 401 ? 'Needs a sign-in' : 'The site refused the request (it may block automated checks)', retry: code === 403 }
  if (code === 405 || code === 501 || code === 400) return { status: 'error', code, note: 'The server does not accept this kind of check', retry: true }
  if (code >= 500) return { status: 'error', code, note: `Server error ${code}` }
  return { status: 'error', code, note: `Unexpected answer ${code}` }
}

/**
 * Check one address. Local and non-web addresses are not sent anywhere. HEAD first (cheap); GET when HEAD is refused or says
 * "not found", because some servers answer HEAD badly. `send(payload)` posts to /api/run and returns its JSON.
 */
export async function checkUrl(url, send) {
  const u = parseWeb(url)
  if (!u) return { status: 'error', note: 'Not a web address' }
  if (isLocalHost(u.hostname)) return { status: 'local', note: 'A local address; the server cannot judge it from here' }
  const first = classify(url.trim(), await send(checkRequest(url.trim(), 'HEAD')))
  if (!first.retry) return first
  const second = classify(url.trim(), await send(checkRequest(url.trim(), 'GET')))
  // If GET works, the site just dislikes HEAD. Otherwise keep the more informative of the two answers.
  return second
}

/**
 * Run `worker(item)` over `items`, at most `limit` at a time. `onResult(item, result, done, total)` is called as each finishes;
 * `shouldStop()` ends the run early (items not started are skipped).
 */
export async function runPool(items, worker, { limit = 5, onResult = () => {}, shouldStop = () => false } = {}) {
  let next = 0
  let done = 0
  const total = items.length
  const lane = async () => {
    while (!shouldStop()) {
      const i = next++
      if (i >= total) return
      let r
      try {
        r = await worker(items[i])
      } catch (e) {
        r = { status: 'error', note: e?.message || 'Check failed' }
      }
      done++
      onResult(items[i], r, done, total)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, total) }, lane))
  return done
}
