import { useRef, useState, useEffect } from 'preact/hooks'
import { query, editing, applyLayout, toggleCollapsed, flashTile, pageTiles, currentPage } from '../store.js'
import { COLS, COLLAPSED_H, effH, tileMatches } from '../util.js'
import { layoutAll, stackLayout, isGroup, GROUP_INSET } from '../layout.js'
import { colorValue } from '../colors.js'
import { IconView } from './IconView.jsx'
import { BODIES } from '../tiles/bodies.jsx'

const ROW = 24
const MIN_W = 2
const MIN_H = 4
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export function Grid() {
  const wrap = useRef()
  const [width, setWidth] = useState(1200)
  const [drag, setDrag] = useState(null)
  const page = currentPage.value

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  const q = query.value.trim()
  const narrow = width < 640
  const colW = width / COLS
  const all = pageTiles.value

  // While searching, tiles (and groups holding a match) open up so the matches are visible.
  const hitSelf = new Set(q ? all.filter((t) => tileMatches(t, q)).map((t) => t.id) : [])
  const hasHit = (t) => hitSelf.has(t.id) || (isGroup(t) && all.some((k) => k.parent_id === t.id && hitSelf.has(k.id)))
  const eff = all.map((t) => ({ ...t, collapsed: t.collapsed && !(q && hasHit(t)) }))

  // What the drag would do, previewed through the layout engine.
  let over = {}
  if (drag?.mode === 'move') over = { [drag.id]: { parent_id: drag.target === 'root' ? null : drag.target, x: drag.gx, y: drag.gy } }
  if (drag?.mode === 'resize') over = { [drag.id]: drag.size }
  const layout = narrow ? stackLayout(eff) : layoutAll(eff, page, drag?.id ?? null, over)
  const posOf = (t) => layout.get(t.id) || { x: 0, y: 0, w: t.w, h: t.h }

  const top = eff.filter((t) => t.parent_id == null)
  const rows = Math.max(0, ...top.map((t) => posOf(t).y + effH({ ...t, h: posOf(t).h })))
  /** px per grid column in the page ('root') or inside a group */
  const unitFor = (key) => {
    if (key === 'root') return colW
    const gw = layout.get(key)?.w || 1
    return Math.max(1, (gw * colW - GROUP_INSET) / gw)
  }
  const colsFor = (key) => (key === 'root' ? COLS : layout.get(key)?.w || COLS)

  /** Which container (page or open group) is under the pointer, ignoring the tile being dragged. */
  const findTarget = (ev, t) => {
    const root = { key: 'root', rect: wrap.current.getBoundingClientRect() }
    if (isGroup(t)) return root // groups sit on the page, not in other groups
    for (const el of document.elementsFromPoint(ev.clientX, ev.clientY)) {
      if (el.closest(`[data-tile-id="${t.id}"]`)) continue
      const c = el.closest('[data-container]')
      if (c) return c.dataset.container === 'root' ? root : { key: Number(c.dataset.container), rect: c.getBoundingClientRect() }
    }
    return root
  }

  const start = (e, t, mode) => {
    if (e.button !== 0) return
    if (mode === 'move' && e.target.closest('button,a,input')) return
    if (narrow) { if (mode === 'move') toggleCollapsed(t); return }
    e.preventDefault()
    const pos = { ...posOf(t) }
    const originKey = t.parent_id ?? 'root'
    const unit0 = unitFor(originKey)
    const cols0 = colsFor(originKey)
    const rect0 = e.currentTarget.closest('[data-tile-id]').getBoundingClientRect()
    const sx = e.clientX, sy = e.clientY
    const base = { id: t.id, mode, px0: pos.x * unit0, py0: pos.y * ROW }
    let moved = false
    let last = null
    const onMove = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy
      if (!moved && Math.hypot(dx, dy) < 4) return
      moved = true
      if (mode === 'resize') {
        const lockedWidth = page?.mode === 'columns' && originKey === 'root'
        last = { size: { w: lockedWidth ? pos.w : clamp(Math.round(pos.w + dx / unit0), MIN_W, cols0 - pos.x), h: Math.max(MIN_H, Math.round(pos.h + dy / ROW)) } }
        setDrag({ ...base, dx, dy, ...last })
      } else {
        const tgt = findTarget(ev, t)
        const u = unitFor(tgt.key)
        last = {
          target: tgt.key,
          gx: Math.max(0, Math.round((rect0.left + dx - tgt.rect.left) / u)),
          gy: Math.max(0, Math.round((rect0.top + dy - tgt.rect.top) / ROW)),
        }
        setDrag({ ...base, dx, dy, ...last })
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setDrag(null)
      if (!moved) return mode === 'move' ? toggleCollapsed(t) : undefined
      if (mode === 'resize') applyLayout({ [t.id]: last.size }, t.id)
      else applyLayout({ [t.id]: { x: last.gx, y: last.gy, parent_id: last.target === 'root' ? null : last.target } }, t.id)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // The page-level tile that contains the dragged one: it must stack above its neighbours while dragging.
  const dragged = drag ? all.find((t) => t.id === drag.id) : null
  const liftId = dragged ? (dragged.parent_id ?? dragged.id) : null

  const placeholder = (key) => {
    if (drag?.mode !== 'move' || drag.target !== key) return null
    const t = all.find((x) => x.id === drag.id)
    const p = posOf(t)
    const u = unitFor(key)
    return <div class="absolute p-1 pointer-events-none z-10" style={{ left: p.x * u, top: p.y * ROW, width: p.w * u, height: effH({ ...t, h: p.h }) * ROW }}><div class="h-full rounded-box border-2 border-dashed border-primary/70 bg-primary/10" /></div>
  }

  const renderTile = (t, unit, depth) => {
    const p = posOf(t)
    const isDrag = drag?.id === t.id
    const free = isDrag && drag.mode === 'move'
    const left = free ? drag.px0 + drag.dx : p.x * unit
    const topPx = free ? drag.py0 + drag.dy : p.y * ROW
    const dim = q && !hasHit(t)
    const group = isGroup(t)
    const color = colorValue(t.color)
    const Body = BODIES[t.type]
    const kids = group ? eff.filter((k) => k.parent_id === t.id) : []
    const lifted = depth === 0 && liftId === t.id
    const containsDrag = group && dragged?.parent_id === t.id && drag.mode === 'move'
    return (
      <div
        key={t.id}
        data-tile-id={t.id}
        class={`absolute p-1 ${isDrag ? 'z-30 pointer-events-none' : lifted ? 'z-30 transition-[left,top,width,height] duration-150' : 'z-0 transition-[left,top,width,height] duration-150'} ${dim ? 'opacity-30' : ''}`}
        style={{ left, top: topPx, width: p.w * unit, height: effH({ ...t, h: p.h }) * ROW }}
      >
        <div
          class={`card tile-glass border border-base-300 h-full ${containsDrag ? 'overflow-visible' : 'overflow-hidden'} ${group ? 'tile-group' : ''} ${color ? 'tile-colored' : ''} ${isDrag ? 'shadow-2xl ring-2 ring-primary/50' : 'shadow-md'} ${flashTile.value === t.id ? 'ring-4 ring-primary animate-pulse' : ''}`}
          style={color ? { '--tc': color } : undefined}
        >
          <div
            class={`tile-head flex items-center gap-2 px-3 shrink-0 select-none ${narrow ? '' : 'cursor-grab active:cursor-grabbing'}`}
            style={{ height: COLLAPSED_H * ROW - 8 }}
            onPointerDown={(e) => start(e, t, 'move')}
          >
            <IconView icon={t.icon} size={18} />
            <span class="font-semibold truncate flex-1">{t.title}</span>
            {group && <button class="btn btn-ghost btn-xs btn-square edit-btn" title="Add a tile to this group" aria-label="Add a tile to this group" onClick={() => (editing.value = { id: null, parent_id: t.id, page_id: t.page_id })}>＋</button>}
            <button class="btn btn-ghost btn-xs btn-square edit-btn" title={group ? 'Edit group' : 'Edit tile'} aria-label={group ? 'Edit group' : 'Edit tile'} onClick={() => (editing.value = all.find((x) => x.id === t.id))}>✎</button>
            <button class="btn btn-ghost btn-xs btn-square" title={t.collapsed ? 'Expand' : 'Collapse'} aria-expanded={!t.collapsed} onClick={() => toggleCollapsed(all.find((x) => x.id === t.id))}>
              <span class={`inline-block transition-transform ${t.collapsed ? '' : 'rotate-180'}`}>▾</span>
            </button>
          </div>
          {!t.collapsed && group && (
            <div class={`flex-1 min-h-0 relative ${containsDrag ? 'overflow-visible' : ''}`} data-container={t.id}>
              {kids.length === 0 && drag?.target !== t.id && <p class="absolute inset-0 grid place-items-center text-sm opacity-50 text-center p-4 pointer-events-none">Empty group: drag tiles in, or use ＋ on the title bar.</p>}
              {kids.map((k) => renderTile(k, unitFor(t.id), depth + 1))}
              {placeholder(t.id)}
            </div>
          )}
          {!t.collapsed && !group && (
            <div class="flex-1 min-h-0 overflow-auto px-2 pb-2">
              <Body tile={t} q={q} />
            </div>
          )}
        </div>
        {!t.collapsed && !narrow && (
          <div
            class="absolute right-1 bottom-1 w-4 h-4 cursor-nwse-resize opacity-40 hover:opacity-100 z-20"
            style={{ background: 'linear-gradient(135deg, transparent 50%, currentColor 50%, currentColor 60%, transparent 60%, transparent 75%, currentColor 75%, currentColor 85%, transparent 85%)' }}
            title="Resize"
            onPointerDown={(e) => start(e, t, 'resize')}
          />
        )}
      </div>
    )
  }

  return (
    <div ref={wrap} data-container="root" class="relative w-full" style={{ height: Math.max(rows, 8) * ROW + 16 }}>
      {top.map((t) => renderTile(t, colW, 0))}
      {placeholder('root')}
    </div>
  )
}
