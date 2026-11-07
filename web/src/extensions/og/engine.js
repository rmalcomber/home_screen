// Open Graph viewer for the launcher: work out the URL, ask the server to fetch the page (the browser cannot: CORS), and read the
// meta tags from the HTML. Pure apart from DOMParser; unit tested in engine.test.js.
//
//   og https://example.com/article

export const USER_AGENT = 'Mozilla/5.0 (compatible; HomeScreen-OpenGraph/1.0; +https://github.com/rmalcomber/home_screen)'

/** { text } for "og …", "opengraph …", "ogp …" (text may be empty), or null. */
export function parseOgCommand(q) {
  const m = /^\s*(?:og|opengraph|ogp)(?:[ \t]+([\s\S]*))?$/i.exec(q || '')
  return m ? { text: (m[1] || '').trim() } : null
}

/** Text -> an http(s) URL. A missing scheme means https. Returns { ok, url } or { ok: false, error }. */
export function normalizeUrl(text) {
  let t = String(text || '').trim()
  if (!t) return { ok: false, error: 'Type a web address after "og", for example og https://example.com' }
  if (/\s/.test(t)) return { ok: false, error: 'A web address cannot contain spaces' }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(t) && !/^[^/]*\.[^/]*:\d+/.test(t) && !/^localhost:\d+/i.test(t)) return { ok: false, error: 'Only http and https addresses can be fetched' }
    t = 'https://' + t
  }
  let u
  try {
    u = new URL(t)
  } catch {
    return { ok: false, error: `"${text}" is not a valid web address` }
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: 'Only http and https addresses can be fetched' }
  if (!u.hostname) return { ok: false, error: `"${text}" is not a valid web address` }
  return { ok: true, url: u.href }
}

/** The payload for POST /api/run: a plain GET that follows redirects and asks for HTML. */
export function ogRequest(url) {
  return {
    method: 'GET',
    url,
    headers: [['User-Agent', USER_AGENT], ['Accept', 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5'], ['Accept-Language', 'en']],
    body: null,
    follow: true,
    insecure: false,
    timeout: 20,
  }
}

const BASIC = ['description', 'author', 'keywords', 'robots', 'theme-color', 'color-scheme', 'generator', 'application-name', 'viewport']
const OG_PREFIXES = ['og:', 'article:', 'book:', 'profile:', 'music:', 'video:', 'fb:', 'product:']

/** Reads the Open Graph, Twitter and basic tags of an HTML page. `pageUrl` resolves relative URLs. */
export function parseOpenGraph(html, pageUrl) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  const baseHref = doc.querySelector('base[href]')?.getAttribute('href')
  let base = pageUrl
  try {
    if (baseHref) base = new URL(baseHref, pageUrl).href
  } catch {}
  const resolve = (href) => {
    if (!href) return ''
    try {
      return new URL(href, base).href
    } catch {
      return href
    }
  }
  const og = []
  const twitter = []
  const basic = []
  for (const m of doc.querySelectorAll('meta')) {
    const key = (m.getAttribute('property') || m.getAttribute('name') || '').trim().toLowerCase()
    const content = m.getAttribute('content')
    if (!key || content === null) continue
    const row = [key, content.trim()]
    if (OG_PREFIXES.some((p) => key.startsWith(p))) og.push(row)
    else if (key.startsWith('twitter:')) twitter.push(row)
    else if (BASIC.includes(key)) basic.push(row)
  }
  const first = (rows, key) => rows.find((r) => r[0] === key)?.[1] || ''
  const pageTitle = (doc.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim()
  const canonical = resolve(doc.querySelector('link[rel~="canonical"]')?.getAttribute('href'))
  const icons = [...doc.querySelectorAll('link[rel]')]
    .filter((l) => /(^|\s)(icon|apple-touch-icon|apple-touch-icon-precomposed|mask-icon)(\s|$)/i.test(l.getAttribute('rel')) && l.getAttribute('href'))
    .map((l) => ({ rel: l.getAttribute('rel').toLowerCase(), href: resolve(l.getAttribute('href')), sizes: l.getAttribute('sizes') || '', type: l.getAttribute('type') || '' }))
  const feeds = [...doc.querySelectorAll('link[rel~="alternate"][type]')]
    .filter((l) => /rss|atom|feed/i.test(l.getAttribute('type')) && l.getAttribute('href'))
    .map((l) => ({ title: l.getAttribute('title') || '', href: resolve(l.getAttribute('href')), type: l.getAttribute('type') }))
  const rawImage = first(og, 'og:image') || first(og, 'og:image:url') || first(twitter, 'twitter:image') || first(twitter, 'twitter:image:src')
  const summary = {
    title: first(og, 'og:title') || first(twitter, 'twitter:title') || pageTitle,
    description: first(og, 'og:description') || first(twitter, 'twitter:description') || first(basic, 'description'),
    image: resolve(rawImage),
    imageAlt: first(og, 'og:image:alt') || first(twitter, 'twitter:image:alt'),
    site: first(og, 'og:site_name'),
    type: first(og, 'og:type'),
    url: resolve(first(og, 'og:url')) || canonical || pageUrl,
    card: first(twitter, 'twitter:card'),
  }
  return { summary, og, twitter, basic, icons, feeds, canonical, pageTitle, imageWasRelative: !!rawImage && !/^[a-z][a-z0-9+.-]*:/i.test(rawImage) && !rawImage.startsWith('//') }
}

/** How well the page is set up for sharing: [{ level: 'ok' | 'warn' | 'info', text }]. */
export function checks(data) {
  const out = []
  const has = (rows, k) => rows.some((r) => r[0] === k && r[1])
  const need = (k, why) => out.push(has(data.og, k) ? { level: 'ok', text: `${k} is set` } : { level: 'warn', text: `${k} is missing: ${why}` })
  need('og:title', 'shared links fall back to the page title')
  need('og:description', 'shared links show no summary, or a random piece of the page')
  need('og:image', 'shared links show no picture')
  need('og:url', 'the same page may be counted under several addresses')
  need('og:type', 'apps treat the page as a plain website')
  if (has(data.og, 'og:image')) {
    if (data.imageWasRelative) out.push({ level: 'warn', text: 'og:image is a relative address: some apps need a full https:// address' })
    if (!has(data.og, 'og:image:width') || !has(data.og, 'og:image:height')) out.push({ level: 'info', text: 'og:image:width and og:image:height are not set: some apps load the picture late' })
    if (data.summary.image && !data.summary.image.startsWith('https://')) out.push({ level: 'warn', text: 'The image is not served over https' })
    if (!has(data.og, 'og:image:alt') && !has(data.twitter, 'twitter:image:alt')) out.push({ level: 'info', text: 'No image description (og:image:alt) for people who cannot see the picture' })
  }
  if (!has(data.twitter, 'twitter:card')) out.push({ level: 'info', text: 'twitter:card is not set: X and Twitter use a small card unless told otherwise' })
  const d = data.summary.description
  if (d && d.length > 200) out.push({ level: 'info', text: `The description is ${d.length} characters long: most apps cut it near 200` })
  const t = data.summary.title
  if (t && t.length > 70) out.push({ level: 'info', text: `The title is ${t.length} characters long: most apps cut it near 60 to 70` })
  if (data.canonical && has(data.og, 'og:url') && data.canonical !== data.summary.url) out.push({ level: 'info', text: `The canonical link (${data.canonical}) differs from og:url` })
  return out
}

/**
 * Turns the answer of /api/run into the page data: { ok: true, data, notes } or { ok: false, error }.
 * `res` is the JSON the server returns; `url` is the address that was requested.
 */
export function readResponse(res, url) {
  if (!res || typeof res !== 'object') return { ok: false, error: 'No answer from the server' }
  if (res.error) return { ok: false, error: res.error }
  const type = (res.headers || []).find(([k]) => String(k).toLowerCase() === 'content-type')?.[1] || ''
  if (res.binary || (type && !/html|xml/i.test(type))) return { ok: false, error: `That address is not a web page (${type || 'binary data'})` }
  const notes = []
  const status = Number(res.status)
  if (status >= 300 && status < 400) notes.push(`The server answered ${status} and the redirect was not followed (no Location, or too many redirects)`)
  if (res.truncated) notes.push('The page is large: only the first 2 MB were read')
  if (!res.body || !String(res.body).trim()) return { ok: false, error: `The server answered ${status || ''} ${res.status_text || ''} with an empty page`.replace(/\s+/g, ' ').trim() }
  const data = parseOpenGraph(res.body, url)
  if (status >= 400) {
    const none = !data.og.length && !data.twitter.length
    if (none) return { ok: false, error: `The server answered ${status} ${res.status_text || ''}`.trim() + '. Some sites refuse requests that do not come from a browser.' }
    notes.push(`The server answered ${status} ${res.status_text || ''}`.trim() + ', but the page still carries tags')
  }
  return { ok: true, data, notes }
}

/** The launcher text that reopens a lookup. */
export const ogFill = (url) => `og ${url}`
