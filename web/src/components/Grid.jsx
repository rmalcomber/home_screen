import { useRef, useState, useEffect } from 'preact/hooks'
import { tiles, query, editing, applyLayout, toggleCollapsed, flashTile } from '../store.js'
import { compact, COLS, COLLAPSED_H, effH, tileMatches } from '../util.js'
import { IconView } from './IconView.jsx'
import { BODIES } from '../tiles/bodies.jsx'

const ROW = 24
const MIN_W = 2
const MIN_H = 4

function overFor(pos, mode, dx, dy, colW) {
  if (mode === 'move') return { x: Math.round(pos.x + dx / colW), y: Math.max(0, Math.round(pos.y + dy / ROW)) }
  return {
    w: Math.max(MIN_W, Math.min(COLS - pos.x, Math.round(pos.w + dx / colW))),
    h: Math.max(MIN_H, Math.round(pos.h + dy / ROW)),
  }
}

export function Grid() {
  const wrap = useRef()
  const [width, setWidth] = useState(1200)
  const [drag, setDrag] = useState(null)

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  const q = query.value.trim()
  const narrow = width < 640
  const colW = width / COLS
  // While searching, tiles with hits open up so the matches are visible.
  const eff = tiles.value.map((t) => ({ ...t, collapsed: t.collapsed && !(q && tileMatches(t, q)) }))

  let layout
  if (narrow) {
    let y = 0
    layout = new Map()
    for (const t of [...eff].sort((a, b) => a.y - b.y || a.x - b.x)) {
      layout.set(t.id, { x: 0, y, w: COLS, h: t.h })
      y += effH(t) + 1
    }
  } else {
    const over = drag ? { [drag.id]: overFor(drag.pos, drag.mode, drag.dx, drag.dy, colW) } : {}
    layout = compact(eff, drag?.id ?? null, over)
  }
  const rows = Math.max(0, ...eff.map((t) => layout.get(t.id).y + effH({ ...t, h: layout.get(t.id).h })))

  const start = (e, t, mode) => {
    if (e.button !== 0) return
    if (mode === 'move' && e.target.closest('button,a,input')) return
    if (narrow) { if (mode === 'move') toggleCollapsed(t); return }
    e.preventDefault()
    const pos = { ...layout.get(t.id) }
    const sx = e.clientX, sy = e.clientY
    let moved = false, last = { dx: 0, dy: 0 }
    const onMove = (ev) => {
      last = { dx: ev.clientX - sx, dy: ev.clientY - sy }
      if (!moved && Math.hypot(last.dx, last.dy) < 4) return
      moved = true
      setDrag({ id: t.id, mode, pos, ...last })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setDrag(null)
      if (!moved) return mode === 'move' ? toggleCollapsed(t) : undefined
      applyLayout({ [t.id]: overFor(pos, mode, last.dx, last.dy, colW) }, t.id)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <div ref={wrap} class="relative w-full" style={{ height: Math.max(rows, 8) * ROW + 16 }}>
      {eff.map((t) => {
        const p = layout.get(t.id)
        const dragging = drag?.id === t.id
        const free = dragging && drag.mode === 'move'
        const left = free ? drag.pos.x * colW + drag.dx : p.x * colW
        const top = free ? drag.pos.y * ROW + drag.dy : p.y * ROW
        const dim = q && !tileMatches(t, q)
        const Body = BODIES[t.type]
        return (
          <div
            key={t.id}
            data-tile-id={t.id}
            class={`absolute p-1 ${dragging ? 'z-30' : 'z-0 transition-[left,top,width,height] duration-150'} ${dim ? 'opacity-30' : ''}`}
            style={{ left, top, width: p.w * colW, height: effH({ ...t, h: p.h }) * ROW }}
          >
            <div class={`card tile-glass border border-base-300 h-full overflow-hidden ${dragging ? 'shadow-2xl ring-2 ring-primary/50' : 'shadow-md'} ${flashTile.value === t.id ? 'ring-4 ring-primary animate-pulse' : ''}`}>
              <div
                class={`flex items-center gap-2 px-3 shrink-0 select-none ${narrow ? '' : 'cursor-grab active:cursor-grabbing'}`}
                style={{ height: COLLAPSED_H * ROW - 8 }}
                onPointerDown={(e) => start(e, t, 'move')}
              >
                <IconView icon={t.icon} size={18} />
                <span class="font-semibold truncate flex-1">{t.title}</span>
                <button class="btn btn-ghost btn-xs btn-square" title="Edit tile" onClick={() => (editing.value = t)}>✎</button>
                <button class="btn btn-ghost btn-xs btn-square" title={t.collapsed ? 'Expand' : 'Collapse'} aria-expanded={!t.collapsed} onClick={() => toggleCollapsed(tiles.value.find((x) => x.id === t.id))}>
                  <span class={`inline-block transition-transform ${t.collapsed ? '' : 'rotate-180'}`}>▾</span>
                </button>
              </div>
              {!t.collapsed && (
                <div class="flex-1 min-h-0 overflow-auto px-2 pb-2">
                  <Body tile={t} q={q} />
                </div>
              )}
            </div>
            {!t.collapsed && !narrow && (
              <div
                class="absolute right-1 bottom-1 w-4 h-4 cursor-nwse-resize opacity-40 hover:opacity-100"
                style={{ background: 'linear-gradient(135deg, transparent 50%, currentColor 50%, currentColor 60%, transparent 60%, transparent 75%, currentColor 75%, currentColor 85%, transparent 85%)' }}
                title="Resize"
                onPointerDown={(e) => start(e, t, 'resize')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
