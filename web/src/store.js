import { signal } from '@preact/signals'
import { compact } from './util.js'

const j = async (method, url, body) => {
  const r = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${method} ${url}: ${r.status}`)
  return r.status === 204 ? null : r.json()
}

export const tiles = signal([])
export const query = signal('')
export const editing = signal(null) // null | tile object | {id:null,...} for new
export const importing = signal(false)
export const loaded = signal(false)
export const error = signal('')
export const settings = signal({})
export const settingsOpen = signal(false)

const guard = (p) => p.catch((e) => { error.value = e.message; throw e })

export async function load() {
  j('GET', '/api/settings').then((v) => (settings.value = v || {})).catch(() => {})
  const list = await guard(j('GET', '/api/tiles'))
  const m = compact(list)
  tiles.value = list.map((t) => ({ ...t, ...m.get(t.id) }))
  loaded.value = true
}

/** Persist the (already compacted) layout of all tiles in one call. */
function persistLayout() {
  return guard(j('PUT', '/api/layout', tiles.value.map(({ id, x, y, w, h, collapsed }) => ({ id, x, y, w, h, collapsed }))))
}

export function applyLayout(over, pinnedId = null) {
  const m = compact(tiles.value, pinnedId, over)
  tiles.value = tiles.value.map((t) => ({ ...t, ...m.get(t.id), collapsed: over[t.id]?.collapsed ?? t.collapsed }))
  return persistLayout()
}

export function toggleCollapsed(t) {
  return applyLayout({ [t.id]: { collapsed: !t.collapsed } })
}

export async function saveTile(t) {
  if (t.id) {
    const r = await guard(j('PUT', `/api/tiles/${t.id}`, t))
    tiles.value = tiles.value.map((x) => (x.id === r.id ? r : x))
  } else {
    const { id: _omit, ...body } = t
    const r = await guard(j('POST', '/api/tiles', body))
    tiles.value = [...tiles.value, r]
  }
  const m = compact(tiles.value)
  tiles.value = tiles.value.map((x) => ({ ...x, ...m.get(x.id) }))
  await persistLayout()
}

/** Save only config of a tile (e.g. notes text) without touching layout. */
export async function patchConfig(t, config) {
  const next = { ...t, config }
  tiles.value = tiles.value.map((x) => (x.id === t.id ? next : x))
  await guard(j('PUT', `/api/tiles/${t.id}`, next))
}

export async function deleteTile(id) {
  await guard(j('DELETE', `/api/tiles/${id}`))
  tiles.value = tiles.value.filter((t) => t.id !== id)
  await applyLayout({})
}

export const icons = {
  list: () => j('GET', '/api/icons'),
  upload: (name, svg) => j('POST', '/api/icons', { name, svg }),
  remove: (id) => j('DELETE', `/api/icons/${id}`),
}

/** Merge into settings: applied immediately, persisted in the background. */
export function saveSettings(patch) {
  settings.value = { ...settings.value, ...patch }
  return guard(j('PUT', '/api/settings', patch))
}

// ---- launcher / navigation helpers ----
export const launcher = signal(null) // null (closed) | { q: initial query }
export const flashTile = signal(null)

/** Scroll to a tile, open it if collapsed and flash it briefly. */
export function focusTile(id) {
  const t = tiles.value.find((x) => x.id === id)
  if (!t) return
  query.value = ''
  if (t.collapsed) toggleCollapsed(t)
  flashTile.value = id
  setTimeout(() => document.querySelector(`[data-tile-id="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80)
  setTimeout(() => flashTile.value === id && (flashTile.value = null), 1800)
}

export function setAllCollapsed(collapsed) {
  return applyLayout(Object.fromEntries(tiles.value.map((t) => [t.id, { collapsed }])))
}
