import { signal, computed } from '@preact/signals'
import { layoutAll, placeNew, arrange as arrangeItems, isGroup } from './layout.js'

const j = async (method, url, body) => {
  const r = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${method} ${url}: ${r.status}`)
  return r.status === 204 ? null : r.json()
}

export const tiles = signal([]) // every tile on every page
export const pages = signal([])
export const pageId = signal(null)
export const query = signal('')
export const editing = signal(null) // null | tile object | {id:null,...} for new
export const importing = signal(false)
export const cleaning = signal(false)
export const loaded = signal(false)
export const error = signal('')
export const settings = signal({})
export const settingsOpen = signal(false)
export const templatesOpen = signal(false)

/** The page being shown (the first page until one is chosen). */
export const currentPage = computed(() => pages.value.find((p) => p.id === pageId.value) || pages.value[0] || null)
/** Tiles of the page being shown, top level and inside groups. */
export const pageTiles = computed(() => tiles.value.filter((t) => t.page_id === currentPage.value?.id))

const guard = (p) => p.catch((e) => { error.value = e.message; throw e })

const store = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode: the choice just isn't remembered */ } },
}

/** Re-run the layout for the given pages over the whole tile list. */
function reflow(list, pageIds) {
  let next = list
  for (const id of pageIds) {
    const page = pages.value.find((p) => p.id === id)
    const mine = next.filter((t) => t.page_id === id)
    const m = layoutAll(mine, page)
    next = next.map((t) => (t.page_id === id && m.has(t.id) ? { ...t, ...m.get(t.id) } : t))
  }
  return next
}

export async function load() {
  j('GET', '/api/settings').then((v) => (settings.value = v || {})).catch(() => {})
  const [pg, list] = await guard(Promise.all([j('GET', '/api/pages'), j('GET', '/api/tiles')]))
  pages.value = pg
  const saved = Number(store.get('hs.page'))
  pageId.value = pg.some((p) => p.id === saved) ? saved : pg[0]?.id ?? null
  tiles.value = reflow(list, pg.map((p) => p.id))
  loaded.value = true
}

/** Persist the (already laid out) tiles in one call. */
function persistLayout() {
  return guard(j('PUT', '/api/layout', tiles.value.map(({ id, x, y, w, h, collapsed, parent_id, page_id }) => ({ id, x, y, w, h, collapsed, parent_id: parent_id ?? null, page_id }))))
}

/**
 * Apply changes to tiles of the current page (x, y, w, h, collapsed, parent_id) and re-flow it.
 * `over` is keyed by tile id; `pinnedId` is the tile that keeps its spot while others make room.
 */
export function applyLayout(over, pinnedId = null) {
  const page = currentPage.value
  const mine = pageTiles.value
  const m = layoutAll(mine, page, pinnedId, over)
  tiles.value = tiles.value.map((t) => {
    if (t.page_id !== page?.id) return t
    const o = over[t.id] || {}
    return {
      ...t,
      collapsed: o.collapsed ?? t.collapsed,
      parent_id: o.parent_id !== undefined ? o.parent_id : t.parent_id,
      ...m.get(t.id),
    }
  })
  return persistLayout()
}

export function toggleCollapsed(t) {
  return applyLayout({ [t.id]: { collapsed: !t.collapsed } })
}

export function setAllCollapsed(collapsed) {
  return applyLayout(Object.fromEntries(pageTiles.value.map((t) => [t.id, { collapsed }])))
}

export async function saveTile(t) {
  const old = t.id ? tiles.value.find((x) => x.id === t.id) : null
  const page_id = t.page_id || currentPage.value?.id
  const parent_id = t.parent_id ?? null
  const moved = !old || old.page_id !== page_id || (old.parent_id ?? null) !== parent_id
  // New tiles, and tiles moved to another page or group, go where the target container wants them.
  let spot = {}
  if (moved) {
    const target = pages.value.find((p) => p.id === page_id)
    spot = placeNew(tiles.value.filter((x) => x.page_id === page_id && x.id !== t.id), target, parent_id, t.w || 4)
  }
  const body = { ...t, page_id, parent_id, ...spot }
  let r
  if (t.id) {
    r = await guard(j('PUT', `/api/tiles/${t.id}`, body))
    tiles.value = tiles.value.map((x) => (x.id === r.id ? r : x))
    if (old && old.page_id !== r.page_id && isGroup(r)) {
      // a group takes its children with it
      tiles.value = tiles.value.map((x) => (x.parent_id === r.id ? { ...x, page_id: r.page_id } : x))
    }
  } else {
    const { id: _omit, ...rest } = body
    r = await guard(j('POST', '/api/tiles', rest))
    tiles.value = [...tiles.value, r]
  }
  tiles.value = reflow(tiles.value, [...new Set([r.page_id, old?.page_id].filter((x) => x != null))])
  await persistLayout()
  return r
}

/** Save only config of a tile (e.g. notes text) without touching layout. */
export async function patchConfig(t, config) {
  const next = { ...t, config }
  tiles.value = tiles.value.map((x) => (x.id === t.id ? next : x))
  await guard(j('PUT', `/api/tiles/${t.id}`, next))
}

export async function deleteTile(id) {
  const victim = tiles.value.find((t) => t.id === id)
  await guard(j('DELETE', `/api/tiles/${id}`))
  tiles.value = tiles.value.filter((t) => t.id !== id && t.parent_id !== id)
  if (victim) tiles.value = reflow(tiles.value, [victim.page_id])
  await persistLayout()
}

/** Make a group out of nothing: used by "Group these…" style actions and templates. */
export const createTileRaw = (body) => guard(j('POST', '/api/tiles', body))

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

// ---- pages ----

export function setPage(id) {
  if (!pages.value.some((p) => p.id === id)) return
  pageId.value = id
  store.set('hs.page', String(id))
  query.value = ''
}

export async function addPage(name, mode = 'free', cols = 3) {
  const p = await guard(j('POST', '/api/pages', { name, mode, cols }))
  pages.value = [...pages.value, p]
  setPage(p.id)
  return p
}

export async function updatePage(p) {
  const r = await guard(j('PUT', `/api/pages/${p.id}`, p))
  pages.value = pages.value.map((x) => (x.id === r.id ? r : x))
  // a new mode or column count changes the layout
  tiles.value = reflow(tiles.value, [r.id])
  await persistLayout()
  return r
}

export async function removePage(id) {
  await guard(j('DELETE', `/api/pages/${id}`))
  pages.value = pages.value.filter((p) => p.id !== id)
  tiles.value = tiles.value.filter((t) => t.page_id !== id)
  if (pageId.value === id) setPage(pages.value[0].id)
}

/** Switch the current page between the free grid and n equal columns (columns mode spreads the tiles out first). */
export async function setPageMode(mode, cols = 3) {
  const page = currentPage.value
  await updatePage({ ...page, mode, cols })
  if (mode === 'columns') await arrangePage(`balance:${cols}`)
}

/** Move a page one place left (-1) or right (1). */
export async function movePage(id, dir) {
  const list = [...pages.value]
  const i = list.findIndex((p) => p.id === id)
  const k = i + dir
  if (i < 0 || k < 0 || k >= list.length) return
  ;[list[i], list[k]] = [list[k], list[i]]
  const ordered = list.map((p, n) => ({ ...p, position: n }))
  pages.value = ordered
  await guard(Promise.all(ordered.map((p) => j('PUT', `/api/pages/${p.id}`, p))))
}

/** One-shot re-arrangement of the current page's top-level tiles (see layout.js ARRANGE). */
export function arrangePage(kind, sizeOf) {
  const items = pageTiles.value.filter((t) => t.parent_id == null)
  const m = arrangeItems(items, kind, { sizeOf })
  return applyLayout(Object.fromEntries(m))
}

// ---- launcher / navigation helpers ----
export const launcher = signal(null) // null (closed) | { q: initial query }
export const flashTile = signal(null)

/** Show a tile: switch to its page, open its group, scroll to it and flash it briefly. */
export function focusTile(id) {
  const t = tiles.value.find((x) => x.id === id)
  if (!t) return
  query.value = ''
  if (t.page_id !== currentPage.value?.id) setPage(t.page_id)
  const parent = t.parent_id != null ? tiles.value.find((x) => x.id === t.parent_id) : null
  const over = {}
  if (t.collapsed) over[t.id] = { collapsed: false }
  if (parent?.collapsed) over[parent.id] = { collapsed: false }
  if (Object.keys(over).length) applyLayout(over)
  flashTile.value = id
  setTimeout(() => document.querySelector(`[data-tile-id="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120)
  setTimeout(() => flashTile.value === id && (flashTile.value = null), 1800)
}
