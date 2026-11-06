// Layout engine: pages with groups. Pure functions, no DOM.
//
// A page is a 12-column grid. A group tile owns a sub-grid as wide as the group itself (children use the
// group's columns), one level deep. Everything here returns Maps of id -> {x, y, w, h}.
import { COLS, COLLAPSED_H, effH, compact } from './util.js'

export const GROUP_PAD_ROWS = 3 // rows a group needs below its last child (header + padding)
export const GROUP_INSET = 10 // px of border + outer padding around a group's child area
export const COLUMN_CHOICES = [2, 3, 4, 6]

export const isGroup = (t) => t.type === 'group'

/** Width in grid columns of one column when a page is split into n equal columns. */
export const columnWidth = (n) => Math.floor(COLS / n)

/** Columns mode: every top-level tile is as wide as a column and snaps to the nearest one. */
export function columnize(items, n) {
  const w = columnWidth(n)
  return items.map((t) => ({ ...t, w, x: Math.max(0, Math.min(n - 1, Math.round(t.x / w))) * w }))
}

/**
 * Positions for every tile of a page (top level and inside groups).
 * `over` patches tiles first (x, y, w, h, collapsed, parent_id): this is how drags and drops are previewed.
 * Groups grow (never shrink) to contain their children.
 */
export function layoutAll(items, page, pinnedId = null, over = {}) {
  const all = items.map((t) => ({ ...t, ...(over[t.id] || {}) }))
  const top = all.filter((t) => t.parent_id == null)
  const top1 = page?.mode === 'columns' ? columnize(top, page.cols || 3) : top
  let root = compact(top1, pinnedId, {}, COLS)
  const out = new Map(root)
  const grow = new Map()
  for (const g of top1.filter(isGroup)) {
    const kids = all.filter((t) => t.parent_id === g.id)
    const pos = root.get(g.id)
    const m = compact(kids, pinnedId, {}, pos.w)
    for (const [id, p] of m) out.set(id, p)
    if (!g.collapsed && kids.length) {
      const bottom = Math.max(...kids.map((k) => m.get(k.id).y + effH({ ...k, h: m.get(k.id).h })))
      if (bottom + GROUP_PAD_ROWS > pos.h) grow.set(g.id, bottom + GROUP_PAD_ROWS)
    }
  }
  if (grow.size) {
    root = compact(top1.map((t) => (grow.has(t.id) ? { ...t, h: grow.get(t.id) } : t)), pinnedId, {}, COLS)
    for (const [id, p] of root) out.set(id, p)
  }
  return out
}

/** Phone-width layout: one column, groups stack their children too. */
export function stackLayout(items, over = {}) {
  const all = items.map((t) => ({ ...t, ...(over[t.id] || {}) }))
  const byPos = (a, b) => a.y - b.y || a.x - b.x || a.id - b.id
  const out = new Map()
  let y = 0
  for (const t of all.filter((t) => t.parent_id == null).sort(byPos)) {
    let h = t.h
    if (isGroup(t)) {
      let ky = 0
      for (const k of all.filter((k) => k.parent_id === t.id).sort(byPos)) {
        out.set(k.id, { x: 0, y: ky, w: COLS, h: k.h })
        ky += effH(k) + 1
      }
      h = ky ? ky + GROUP_PAD_ROWS : t.h
    }
    out.set(t.id, { x: 0, y, w: COLS, h })
    y += effH({ ...t, h }) + 1
  }
  return out
}

// ---- auto-arrange ----

const reading = (a, b) => a.y - b.y || a.x - b.x || a.id - b.id
const byTitle = (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }) || a.id - b.id

/** Left-to-right rows that wrap at `cols`; the grid's gravity then pulls them together. */
function flowRows(sorted, cols = COLS) {
  const out = new Map()
  let x = 0, y = 0, rowH = 0
  for (const t of sorted) {
    const w = Math.min(cols, Math.max(1, t.w))
    if (x + w > cols) { x = 0; y += rowH; rowH = 0 }
    out.set(t.id, { x, y, w, h: t.h })
    x += w
    rowH = Math.max(rowH, effH(t))
  }
  return out
}

/** Masonry: reading order, each tile into the currently shortest of n equal columns. */
export function balance(items, n) {
  const w = columnWidth(n)
  const heights = Array(n).fill(0)
  const out = new Map()
  for (const t of [...items].sort(reading)) {
    const c = heights.indexOf(Math.min(...heights))
    out.set(t.id, { x: c * w, y: heights[c], w, h: t.h })
    heights[c] += effH(t)
  }
  return out
}

export const ARRANGE = [
  { id: 'alpha', label: 'Sort A–Z', hint: 'Tiles in title order, left to right' },
  { id: 'type', label: 'Group by type', hint: 'Bookmarks, developer, GitHub, then widgets' },
  { id: 'balance:2', label: 'Balance into 2 columns', hint: 'Fills the shortest column first' },
  { id: 'balance:3', label: 'Balance into 3 columns', hint: 'Fills the shortest column first' },
  { id: 'balance:4', label: 'Balance into 4 columns', hint: 'Fills the shortest column first' },
  { id: 'reset', label: 'Reset tile sizes', hint: 'Back to each tile type’s default size' },
]

const TYPE_ORDER = ['group', 'dev', 'github', 'bookmarks', 'widget']

/**
 * Re-arrange the tiles of one container. Returns Map(id -> {x,y,w,h}) to apply (the grid then compacts it).
 * `sizeOf(tile) -> [w, h]` supplies default sizes for 'reset'.
 */
export function arrange(items, kind, { sizeOf = (t) => [t.w, t.h], cols = COLS } = {}) {
  if (kind === 'alpha') return flowRows([...items].sort(byTitle), cols)
  if (kind === 'type') {
    const rank = (t) => { const i = TYPE_ORDER.indexOf(t.type); return i < 0 ? TYPE_ORDER.length : i }
    return flowRows([...items].sort((a, b) => rank(a) - rank(b) || byTitle(a, b)), cols)
  }
  if (kind.startsWith('balance:')) return balance(items, Number(kind.split(':')[1]) || 3)
  if (kind === 'reset') {
    const sized = [...items].sort(reading).map((t) => { const [w, h] = sizeOf(t); return { ...t, w, h } })
    return flowRows(sized, cols)
  }
  throw new Error(`Unknown arrangement: ${kind}`)
}

/** Where a new tile should go: the shortest column in columns mode, else below everything. */
export function placeNew(items, page, parentId = null, w = 4) {
  const mine = items.filter((t) => (t.parent_id ?? null) === parentId)
  const bottom = (list) => Math.max(0, ...list.map((t) => t.y + effH(t)))
  if (parentId == null && page?.mode === 'columns') {
    const n = page.cols || 3
    const cw = columnWidth(n)
    const heights = Array.from({ length: n }, (_, c) => bottom(mine.filter((t) => Math.round(t.x / cw) === c)))
    const c = heights.indexOf(Math.min(...heights))
    return { x: c * cw, y: heights[c], w: cw }
  }
  return { x: 0, y: bottom(mine), w }
}

export { COLLAPSED_H }
