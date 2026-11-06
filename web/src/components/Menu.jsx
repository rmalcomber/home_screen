import { useState, useRef, useEffect } from 'preact/hooks'
import { createPortal } from 'preact/compat'

/**
 * Dropdown whose panel is rendered in a portal on <body>. Tiles use backdrop-filter (the "glass" setting) and
 * overflow:hidden, and a filtered ancestor becomes the containing block for position:fixed, so a menu rendered
 * inside the tile would be positioned relative to it and clipped.
 */
export function Menu({ label, items, btnClass = 'btn btn-ghost btn-xs' }) {
  const [pos, setPos] = useState(null)
  const btn = useRef()

  useEffect(() => {
    if (!pos) return
    const close = (e) => { if (!e.target.closest?.('[data-menu]')) setPos(null) }
    const esc = (e) => e.key === 'Escape' && setPos(null)
    const away = () => setPos(null)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    window.addEventListener('scroll', away, { capture: true })
    window.addEventListener('resize', away)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', away, { capture: true })
      window.removeEventListener('resize', away)
    }
  }, [pos])

  const open = () => {
    const r = btn.current.getBoundingClientRect()
    const height = items.length * 32 + 16
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 184))
    const top = r.bottom + 4 + height > window.innerHeight ? Math.max(8, r.top - 4 - height) : r.bottom + 4
    setPos({ left, top })
  }

  return (
    <span data-menu>
      <button ref={btn} class={btnClass} onClick={() => (pos ? setPos(null) : open())} aria-haspopup="menu" aria-expanded={!!pos}>
        {label}
      </button>
      {pos && createPortal(
        <ul data-menu class="menu menu-sm bg-base-100 rounded-box shadow-lg border border-base-300 w-44" style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 60 }}>
          {items.map(([text, href]) => (
            <li key={text}>
              <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => setPos(null)}>{text}</a>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </span>
  )
}
