// Pure helpers (unit tested in util.test.js)

const MULTI = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'org.nz', 'co.jp', 'co.in', 'com.br', 'com.cn', 'co.za', 'com.mx', 'com.sg', 'com.tr',
  'com.hk', 'co.kr', 'com.ar', 'com.tw',
])

export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/** Registrable domain, ignoring subdomains: docs.github.com -> github.com, a.bbc.co.uk -> bbc.co.uk */
export function rootDomain(host) {
  host = (host || '').toLowerCase().replace(/^www\./, '')
  if (!host || host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) return host
  const p = host.split('.')
  if (p.length <= 2) return host
  const two = p.slice(-2).join('.')
  return MULTI.has(two) ? p.slice(-3).join('.') : two
}

export function faviconUrl(url) {
  const h = hostOf(url)
  return h ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=32` : ''
}

/** Parse a Chrome/Netscape bookmarks export into [{title,url}] (http/https only). */
export function parseBookmarks(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out = []
  for (const a of doc.querySelectorAll('a[href]')) {
    const url = a.getAttribute('href') || ''
    if (!/^https?:\/\//i.test(url)) continue
    out.push({ title: (a.textContent || '').trim() || hostOf(url), url })
  }
  return out
}

/** Group bookmarks by root domain; biggest groups first. */
export function groupByDomain(links) {
  const m = new Map()
  for (const l of links) {
    const d = rootDomain(hostOf(l.url))
    if (!d) continue
    if (!m.has(d)) m.set(d, [])
    m.get(d).push(l)
  }
  return [...m.entries()]
    .map(([domain, links]) => ({ domain, links }))
    .sort((a, b) => b.links.length - a.links.length || a.domain.localeCompare(b.domain))
}

/** owner/repo from https://github.com/owner/repo[/...] */
export function parseGithub(input, defaultOwner = '') {
  input = (input || '').trim()
  if (!input) return null
  let path = input
  if (/^https?:\/\//i.test(input)) {
    try {
      const u = new URL(input)
      if (!/(^|\.)github\.com$/i.test(u.hostname)) return null
      path = u.pathname
    } catch {
      return null
    }
  } else {
    path = input.replace(/^github\.com\//i, '')
  }
  const parts = path.split('/').filter(Boolean)
  let owner, repo
  if (parts.length >= 2) [owner, repo] = parts
  else if (parts.length === 1 && defaultOwner.trim()) [owner, repo] = [defaultOwner.trim(), parts[0]]
  if (!owner || !repo) return null
  repo = repo.replace(/\.git$/, '')
  return { owner, repo, base: `https://github.com/${owner}/${repo}` }
}

/** Dev tile services; migrates the old single-service config shape. */
export function devServices(c) {
  c = c || {}
  if (Array.isArray(c.services)) return c.services
  return c.name || c.dev || c.stage || c.prod ? [{ name: c.name, dev: c.dev, stage: c.stage, prod: c.prod }] : []
}

export function githubLinks(base) {
  return [
    ['Code', base],
    ['README', base + '#readme'],
    ['Compare', base + '/compare'],
    ['Pull requests', base + '/pulls'],
    ['Issues', base + '/issues'],
    ['Actions', base + '/actions'],
  ]
}

export const ENVS = [
  ['dev', 'Dev', 'btn-info'],
  ['stage', 'Stage', 'btn-warning'],
  ['prod', 'Prod', 'btn-error'],
]

/** All searchable strings for a tile. */
export function tileTexts(t) {
  const c = t.config || {}
  const s = [t.title]
  if (t.type === 'bookmarks') for (const l of c.links || []) s.push(l.title, l.url)
  if (t.type === 'dev') for (const v of devServices(c)) s.push(v.name, v.dev, v.stage, v.prod)
  if (t.type === 'github') {
    s.push(c.owner)
    for (const r of c.repos || []) s.push(r.url, parseGithub(r.url, c.owner)?.base)
  }
  if (t.type === 'widget') s.push(c.kind)
  return s.filter(Boolean)
}

export function matches(text, q) {
  return !q || (text || '').toLowerCase().includes(q.toLowerCase())
}

export function tileMatches(t, q) {
  return !q || tileTexts(t).some((x) => matches(x, q))
}

// ---- grid layout ----
export const COLS = 12
export const COLLAPSED_H = 2
export const effH = (t) => (t.collapsed ? COLLAPSED_H : t.h)

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + effH(b) && b.y < a.y + effH(a)

/**
 * Gravity layout: the pinned tile (being dragged) keeps its spot, everything else
 * is placed in (y,x) order at the lowest free row. `cols` is the width of the container (12 for a page,
 * the group's width inside a group). Returns Map(id -> {x,y,w,h}).
 */
export function compact(tiles, pinnedId = null, over = {}, cols = COLS) {
  const items = tiles.map((t) => ({ ...t, ...(over[t.id] || {}) }))
  const placed = []
  const pinned = items.find((t) => t.id === pinnedId)
  if (pinned) {
    pinned.w = Math.min(cols, Math.max(1, pinned.w))
    pinned.x = Math.max(0, Math.min(cols - pinned.w, pinned.x))
    pinned.y = Math.max(0, pinned.y)
    placed.push(pinned)
  }
  const rest = items.filter((t) => t !== pinned).sort((a, b) => a.y - b.y || a.x - b.x || a.id - b.id)
  for (const t of rest) {
    t.w = Math.min(cols, Math.max(1, t.w))
    t.x = Math.max(0, Math.min(cols - t.w, t.x))
    let y = 0
    while (placed.some((p) => hit({ ...t, y }, p))) y++
    t.y = y
    placed.push(t)
  }
  return new Map(placed.map((t) => [t.id, { x: t.x, y: t.y, w: t.w, h: t.h }]))
}
