import { useState, useEffect, useRef } from 'preact/hooks'
import { patchConfig } from '../../core/extensions/host.js'

const SHORTCUTS = [
  ['n', 'New item'],
  ['↑ ↓ / j k', 'Move selection'],
  ['Space / x', 'Toggle done'],
  ['e / Enter', 'Edit item'],
  ['d / Del', 'Delete item'],
  ['Shift + ↑ ↓', 'Reorder item'],
  ['c', 'Clear completed'],
  ['Esc', 'Leave input / cancel'],
]

const todo = {
  Body({ tile }) {
    const items = tile.config.items || []
    const [sel, setSel] = useState(-1)
    const [edit, setEdit] = useState(null) // index being edited
    const [help, setHelp] = useState(false)
    const input = useRef()
    const root = useRef()
    const save = (next) => patchConfig(tile, { ...tile.config, items: next })
    const clamp = (k) => Math.max(-1, Math.min(items.length - 1, k))

    const add = (text) => {
      text = text.trim()
      if (text) { save([...items, { id: Date.now() + Math.random(), text, done: false }]); setSel(items.length) }
    }

    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return // inputs handle their own keys
      const k = e.key
      const used = () => { e.preventDefault(); e.stopPropagation() }
      if (k === 'n') { used(); input.current.focus() }
      else if (k === 'ArrowDown' || k === 'j') {
        used()
        if (e.shiftKey && sel >= 0 && sel < items.length - 1) { const a = [...items]; [a[sel], a[sel + 1]] = [a[sel + 1], a[sel]]; save(a); setSel(sel + 1) }
        else setSel(clamp(sel + 1))
      } else if (k === 'ArrowUp' || k === 'k') {
        used()
        if (e.shiftKey && sel > 0) { const a = [...items]; [a[sel], a[sel - 1]] = [a[sel - 1], a[sel]]; save(a); setSel(sel - 1) }
        else setSel(clamp(sel - 1))
      } else if ((k === ' ' || k === 'x') && sel >= 0) { used(); save(items.map((t, j) => (j === sel ? { ...t, done: !t.done } : t))) }
      else if ((k === 'e' || k === 'Enter') && sel >= 0) { used(); setEdit(sel) }
      else if ((k === 'd' || k === 'Delete' || k === 'Backspace') && sel >= 0) { used(); save(items.filter((_, j) => j !== sel)); setSel(clamp(Math.min(sel, items.length - 2))) }
      else if (k === 'c') { used(); save(items.filter((t) => !t.done)); setSel(-1) }
      else if (k === '?') { used(); setHelp((h) => !h) }
      else if (k === 'Escape') { setSel(-1); root.current.blur() }
    }

    useEffect(() => {
      if (sel >= 0) root.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
    }, [sel])

    const left = items.filter((t) => !t.done).length
    return (
      <div ref={root} tabIndex={0} class="flex flex-col h-full gap-1 outline-none focus-within:[&_.todo-sel]:ring-1" onKeyDown={onKey} onFocus={(e) => e.target === root.current && sel < 0 && items.length && setSel(0)}>
        <input
          ref={input}
          class="input input-sm input-bordered w-full shrink-0"
          placeholder="Add a task… (Enter)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') { add(e.target.value); e.target.value = '' }
            else if (e.key === 'Escape') { e.target.value = ''; root.current.focus() }
            else if (e.key === 'ArrowDown') { e.preventDefault(); root.current.focus(); setSel(0) }
          }}
        />
        <ul class="flex-1 overflow-auto">
          {items.map((t, i) => (
            <li key={t.id} data-i={i} onClick={() => { setSel(i); root.current.focus() }} class={`todo-sel flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${i === sel ? 'bg-primary/20 ring-1 ring-primary/60' : 'hover:bg-base-300'}`}>
              <input type="checkbox" class="checkbox checkbox-xs" checked={t.done} tabIndex={-1} onClick={(e) => e.stopPropagation()} onChange={() => save(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
              {edit === i ? (
                <input
                  class="input input-xs input-bordered flex-1"
                  value={t.text}
                  autofocus
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { const v = e.target.value.trim(); save(v ? items.map((x, j) => (j === i ? { ...x, text: v } : x)) : items.filter((_, j) => j !== i)); setEdit(null); root.current.focus() }
                    else if (e.key === 'Escape') { setEdit(null); root.current.focus() }
                  }}
                  onBlur={() => setEdit(null)}
                />
              ) : (
                <span class={`flex-1 text-sm break-words min-w-0 ${t.done ? 'line-through opacity-50' : ''}`} onDblClick={() => setEdit(i)}>{t.text}</span>
              )}
            </li>
          ))}
        </ul>
        {help && (
          <div class="text-xs bg-base-200 rounded p-2 grid grid-cols-[auto_1fr] gap-x-3">
            {SHORTCUTS.map(([k, d]) => <><kbd class="kbd kbd-xs justify-self-start">{k}</kbd><span>{d}</span></>)}
          </div>
        )}
        <div class="flex items-center justify-between text-xs opacity-60 shrink-0">
          <span>{left} left</span>
          <button class="link" onClick={() => setHelp(!help)}>shortcuts (?)</button>
        </div>
      </div>
    )
  },
  Options: () => <p class="text-sm opacity-60">Add and manage tasks directly in the tile. Click the list (or Tab to it) and press ? for keyboard shortcuts.</p>,
}

export default todo
