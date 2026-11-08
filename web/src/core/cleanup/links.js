// Clean up, step 1: find every link on the dashboard and compare them. Pure (no network, no store); unit tested.
//
// A link is a plain object with a `ref` that says where it lives, so a later edit can find it again:
//   { kind: 'link', index }                  bookmarks tile: config.links[index]
//   { kind: 'dev', index, env }              developer tile: config.services[index][env]  (env: dev | stage | prod)
//   { kind: 'github', index }                GitHub tile:    config.repos[index].url

import { devServices, parseGithub, hostOf, rootDomain } from '../util.js'

const TRACKING = /^(utm_[a-z0-9_]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|yclid|_hsenc|_hsmi|mkt_tok|vero_id|ref_src|ref_url|spm)$/i

/** Parse a link as an http(s) URL, or null. Surrounding spaces are ignored. */
export function parseWeb(url) {
  try {
    const u = new URL(String(url || '').trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null
  } catch {
    return null
  }
}

/** The link without tracking parameters (utm_*, fbclid, gclid...) and fragments-only noise; unchanged text if nothing to remove. */
export function cleanUrl(url) {
  const u = parseWeb(url)
  if (!u) return String(url || '').trim()
  let changed = false
  for (const k of [...u.searchParams.keys()]) {
    if (TRACKING.test(k)) {
      u.searchParams.delete(k)
      changed = true
    }
  }
  if (!changed) return String(url).trim()
  return u.href.replace(/\?$/, '')
}

/**
 * A key that is equal for links that go to the same place: scheme and `www.` ignored, host lower-cased, default port and
 * fragment dropped, trailing slash dropped, tracking parameters removed, remaining parameters sorted. '' for anything that is not
 * a web address.
 */
export function urlKey(url) {
  const u = parseWeb(url)
  if (!u) return ''
  const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k)).sort(([a, x], [b, y]) => (a === b ? x.localeCompare(y) : a.localeCompare(b)))
  const q = params.length ? '?' + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : ''
  const path = u.pathname.replace(/\/+$/, '')
  const port = u.port && !['80', '443'].includes(u.port) ? ':' + u.port : ''
  return `${u.hostname.toLowerCase().replace(/^www\./, '')}${port}${path}${q}`
}

/** localhost, private ranges, `.local` names and single-label hosts: not reachable from the server's point of view, so not checked. */
export function isLocalHost(host) {
  const h = (host || '').toLowerCase()
  if (!h) return false
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.internal') || h.endsWith('.home.arpa')) return true
  if (h.includes(':')) return h === '::1' || /^f[cd]/.test(h) || h.startsWith('fe80')
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(h)
  if (m) {
    const [a, b] = [+m[1], +m[2]]
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || a === 0
  }
  return !h.includes('.')
}

/** Every link on the dashboard, in dashboard order. `pages` supplies names. */
export function collectLinks(tiles, pages = []) {
  const pageName = (id) => pages.find((p) => p.id === id)?.name || ''
  const byId = new Map(tiles.map((t) => [t.id, t]))
  const out = []
  const add = (t, ref, url, title) => {
    const g = t.parent_id != null ? byId.get(t.parent_id) : null
    out.push({
      url: String(url || ''),
      title: String(title || ''),
      ref,
      tileId: t.id,
      tileTitle: t.title || '',
      tileType: t.type,
      pageId: t.page_id,
      pageName: pageName(t.page_id),
      groupTitle: g?.title || '',
    })
  }
  for (const t of tiles) {
    const c = t.config || {}
    if (t.type === 'bookmarks') (c.links || []).forEach((l, index) => l && l.url && add(t, { kind: 'link', index }, l.url, l.title))
    else if (t.type === 'dev') {
      devServices(c).forEach((s, index) => {
        for (const env of ['dev', 'stage', 'prod']) if (s?.[env]) add(t, { kind: 'dev', index, env }, s[env], s.name ? `${s.name} (${env})` : env)
      })
    } else if (t.type === 'github') {
      ;(c.repos || []).forEach((r, index) => {
        const g = parseGithub(r?.url, c.owner)
        if (g) add(t, { kind: 'github', index }, g.base, `${g.owner}/${g.repo}`)
      })
    }
  }
  return out
}

/** Short place text for a link: "Tile · Page" (and the group, when it is in one). */
export const whereText = (l) => [l.groupTitle && `${l.groupTitle} ›`, l.tileTitle || l.tileType, l.pageName && `· ${l.pageName}`].filter(Boolean).join(' ')

export { hostOf, rootDomain }
