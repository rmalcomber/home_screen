// Can I use for the launcher: download the public caniuse dataset once, keep it in the browser's cache, and search it.
// Pure apart from fetch and the Cache API (both injectable); unit tested in engine.test.js.
//
//   caniuse grid | ciu flexbox gap

export const DATA_URL = 'https://raw.githubusercontent.com/Fyrd/caniuse/main/fulldata-json/data-2.0.json'
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** { text } for "caniuse …" or "ciu …" (text may be empty), or null. */
export function parseCaniuseCommand(q) {
  const m = /^\s*(?:caniuse|ciu)(?:[ \t]+([\s\S]*))?$/i.exec(q || '')
  return m ? { text: (m[1] || '').trim() } : null
}

// ---- getting the data

/** A store in the browser's Cache API, or null where it is not available (it needs a secure context such as localhost). */
export function browserStore(name = 'home-screen-caniuse', key = DATA_URL) {
  if (typeof caches === 'undefined') return null
  return {
    async get() {
      const r = await (await caches.open(name)).match(key)
      return r ? { text: await r.text(), fetchedAt: Number(r.headers.get('x-hs-fetched')) || 0 } : null
    },
    async put(text, at) {
      await (await caches.open(name)).put(key, new Response(text, { headers: { 'content-type': 'application/json', 'x-hs-fetched': String(at) } }))
    },
  }
}

const valid = (d) => d && typeof d === 'object' && d.data && d.agents

/**
 * Loads the dataset: from the store when it is under a week old, otherwise from the network (and stores it). When the network
 * fails an older stored copy is used and marked `stale`. Resolves to { data, fetchedAt, stale, source } or rejects.
 */
export async function loadDataset({ fetchFn = (...a) => fetch(...a), store = browserStore(), now = Date.now(), url = DATA_URL } = {}) {
  let stored = null
  try {
    stored = await store?.get()
  } catch {}
  const fromStore = (stale) => {
    try {
      const data = JSON.parse(stored.text)
      return valid(data) ? { data, fetchedAt: stored.fetchedAt, stale, source: 'cache' } : null
    } catch {
      return null
    }
  }
  if (stored && now - stored.fetchedAt < MAX_AGE_MS) {
    const hit = fromStore(false)
    if (hit) return hit
  }
  try {
    const res = await fetchFn(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const data = JSON.parse(text)
    if (!valid(data)) throw new Error('unexpected data')
    try {
      await store?.put(text, now)
    } catch {}
    return { data, fetchedAt: now, stale: false, source: 'network' }
  } catch (e) {
    const old = stored && fromStore(true)
    if (old) return old
    throw new Error(`Could not download the Can I use data (${e.message}). It is kept in the browser after the first download, so it works offline from then on.`)
  }
}

let memo = null
/** The dataset, loaded once per page. A failure is not remembered, so the next call tries again. */
export function getDataset(options) {
  memo ||= loadDataset(options).catch((e) => {
    memo = null
    throw e
  })
  return memo
}
/** Tests only. */
export const _reset = () => { memo = null }

// ---- searching

const norm = (s) => String(s || '').toLowerCase()

/** Features matching the words in `text` (every word must appear somewhere), best first. Returns [{ id, title, usage }]. */
export function searchFeatures(data, text, limit = 8) {
  const words = norm(text).split(/[\s,]+/).filter(Boolean)
  if (!words.length) return []
  const out = []
  for (const [id, f] of Object.entries(data.data)) {
    const title = norm(f.title)
    const keywords = norm(f.keywords)
    const description = norm(f.description)
    const slug = id.toLowerCase()
    let score = 0
    for (const w of words) {
      let s = 0
      if (slug === w || title === w) s = 100
      else if (slug.startsWith(w) || title.startsWith(w)) s = 60
      else if (title.split(/[^a-z0-9]+/).includes(w) || slug.split('-').includes(w)) s = 50
      else if (title.includes(w) || slug.includes(w)) s = 40
      else if (keywords.split(',').some((k) => k.trim() === w)) s = 35
      else if (keywords.includes(w)) s = 30
      else if (description.includes(w)) s = 8
      if (!s) { score = 0; break }
      score += s
    }
    if (score) out.push({ id, title: f.title, score, usage: (f.usage_perc_y || 0) + (f.usage_perc_a || 0) })
  }
  return out.sort((a, b) => b.score - a.score || b.usage - a.usage || (a.id < b.id ? -1 : 1)).slice(0, limit).map(({ id, title, usage }) => ({ id, title, usage }))
}

// ---- one feature

/** The browsers shown, in this order. */
export const BROWSERS = ['chrome', 'edge', 'firefox', 'safari', 'ios_saf', 'and_chr', 'samsung', 'opera']

const SUPPORT = { y: 'Supported', a: 'Partial', n: 'Not supported', p: 'Polyfill needed', u: 'Unknown' }

/** Markdown and HTML in the dataset text, reduced to plain text. */
export function plain(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1$2')
    .split(String.fromCharCode(96)).join('') // the audit script reads backticks as quotes, so none is written here
    .replace(/\s+/g, ' ')
    .trim()
}

/** Splits a stats flag such as "a x #2" into { code, prefixed, disabled, notes }. */
export function parseFlag(flag) {
  const parts = String(flag || 'u').split(/\s+/)
  return { code: parts[0] || 'u', prefixed: parts.includes('x'), disabled: parts.includes('d'), notes: parts.filter((p) => /^#\d+$/.test(p)).map((p) => p.slice(1)) }
}

/** Everything the panel shows for one feature, or null. */
export function featureInfo(data, id) {
  const f = data.data[id]
  if (!f) return null
  const rows = []
  for (const key of BROWSERS) {
    const agent = data.agents[key]
    const stats = f.stats?.[key]
    if (!agent || !stats) continue
    const list = agent.version_list || []
    const current = agent.current_version || list.find((v) => v.era === 0)?.version || list[list.length - 1]?.version
    const now = parseFlag(stats[current])
    const released = list.filter((v) => v.era <= 0).map((v) => v.version)
    const firstWith = (code) => released.find((v) => parseFlag(stats[v]).code === code)
    const firstFull = firstWith('y')
    const firstPartial = firstWith('a')
    let summary
    if (now.code === 'y') summary = `${firstFull}+`
    else if (now.code === 'a') summary = firstFull ? `${firstFull}+` : `partial since ${firstPartial}`
    else if (now.code === 'p') summary = 'polyfill needed'
    else summary = now.code === 'u' ? 'unknown' : 'not supported'
    rows.push({
      key,
      name: agent.long_name || agent.browser,
      type: agent.type,
      current,
      code: now.code,
      label: SUPPORT[now.code] || 'Unknown',
      prefixed: now.prefixed,
      disabled: now.disabled,
      firstFull,
      firstPartial,
      summary,
      notes: now.notes,
    })
  }
  const noteMap = {}
  for (const [k, v] of Object.entries(f.notes_by_num || {})) noteMap[k] = plain(v)
  return {
    id,
    title: f.title,
    description: plain(f.description),
    spec: f.spec,
    status: data.statuses?.[f.status] || f.status || '',
    usageFull: f.usage_perc_y || 0,
    usagePartial: f.usage_perc_a || 0,
    notes: plain(f.notes),
    noteMap,
    links: (f.links || []).map((l) => ({ url: l.url, title: l.title })),
    categories: f.categories || [],
    rows,
    url: `https://caniuse.com/${id}`,
    updated: data.updated ? new Date(data.updated * 1000) : null,
  }
}

export const caniuseFill = (text) => `caniuse ${text}`
