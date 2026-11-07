import { useState, useEffect, useRef, useMemo } from 'preact/hooks'
import { launcher } from '../store.js'
import { search, getProviders, getRecent, pushRecent, route } from './registry.js'
import { IconView } from '../ui/IconView.jsx'
import './providers.js'

export function Launcher() {
  if (!launcher.value) return null
  return <Palette key={launcher.value.stamp} initial={launcher.value.q || ''} />
}

// Grow the textarea with its content (pasted multi-line curl/JSON), up to max-h-40.
const fit = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }

function Palette({ initial }) {
  const [input, setInput] = useState(initial)
  const [sections, setSections] = useState([])
  const [recent, setRecent] = useState([])
  const [sel, setSel] = useState(0)
  const inputEl = useRef()
  const listEl = useRef()
  const seq = useRef(0)
  const close = () => (launcher.value = null)

  // Flat list used for keyboard navigation (sections keep their order).
  const flat = useMemo(() => {
    if (!input && recent.length) return recent
    return sections.flatMap((s) => s.items.map((it) => ({ ...it, section: s.provider.name })))
  }, [sections, recent, input])

  useEffect(() => {
    const my = ++seq.current
    if (!input) {
      // Empty query: show recents resolved from the full item set.
      search('', {}).then((secs) => {
        if (my !== seq.current) return
        const all = secs.flatMap((s) => s.items)
        const keys = getRecent()
        const items = keys.map((k) => all.find((i) => i.key === k)).filter(Boolean).map((i) => ({ ...i, section: 'Recent' }))
        setRecent(items)
        setSections(items.length ? [] : secs.map((s) => ({ ...s, items: s.items.slice(0, 30) })))
        setSel(0)
      })
      return
    }
    setRecent([])
    search(input, {}).then((secs) => {
      if (my !== seq.current) return
      setSections(secs)
      setSel(0)
    })
  }, [input])

  useEffect(() => {
    listEl.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const run = (item, newTab = true) => {
    if (!item) return
    if (item.fill !== undefined) { setInput(item.fill); setTimeout(() => inputEl.current?.focus()); return } // history entry: reload it into the input
    if (item.recent !== false) pushRecent(item.key) // items that record themselves via history.remember() opt out
    close()
    // Let the dialog unmount before the action (e.g. opening another modal).
    setTimeout(() => item.run({ newTab }), 0)
  }

  const onKey = (e) => {
    const n = flat.length
    if (e.key === 'Escape') { e.preventDefault(); close(); return }
    if (flat.some((i) => i.panel)) return // a panel (curl, JSON…) owns the area: Enter/arrows/Tab behave normally, the panel handles Enter
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); setSel((s) => (n ? (s + 1) % n : 0)) }
    else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); setSel((s) => (n ? (s - 1 + n) % n : 0)) }
    else if (e.key === 'PageDown') { e.preventDefault(); setSel((s) => Math.min(n - 1, s + 8)) }
    else if (e.key === 'PageUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 8)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(flat[sel], !e.shiftKey) }
    else if (e.key === 'Tab') { e.preventDefault() }
  }

  const panelItem = flat.find((i) => i.panel) // e.g. the curl runner takes over the results area
  const Panel = panelItem?.panel
  const { scoped } = route(input)
  const prefixes = getProviders().filter((p) => p.prefix)
  let idx = -1
  const rows = (items) =>
    items.map((it) => {
      idx++
      const i = idx
      return (
        <li key={it.key + i} data-idx={i}>
          <button
            type="button"
            class={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg ${i === sel ? 'bg-primary/20' : 'hover:bg-base-300'}`}
            onMouseMove={() => sel !== i && setSel(i)}
            onClick={(e) => run(it, !e.shiftKey)}
          >
            <span class="w-5 h-5 flex items-center justify-center shrink-0">
              {it.swatch ? <span class="w-4 h-4 rounded border border-base-content/30" style={{ background: it.swatch }} /> : it.iconSrc ? <img src={it.iconSrc} width="16" height="16" alt="" /> : <IconView icon={it.icon} size={16} />}
            </span>
            <span class="min-w-0 flex-1">
              <span class={`block truncate text-sm font-medium ${it.mono ? 'font-mono' : ''}`}>{it.title}</span>
              {(it.subtitle || it.group) && (
                <span class="block truncate text-xs opacity-60">{[it.group, it.subtitle].filter(Boolean).join(' · ')}</span>
              )}
            </span>
            {it.kind && <span class={`badge badge-sm ${it.kindClass || 'badge-ghost'}`}>{it.kind}</span>}
          </button>
        </li>
      )
    })

  return (
    <dialog class="modal modal-open items-start" onKeyDown={onKey}>
      <div class={`modal-box mt-[12vh] p-0 overflow-hidden ${Panel ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <div class="flex items-center gap-2 px-4 border-b border-base-300">
          {scoped && <span class="badge badge-primary badge-sm">{scoped.name}</span>}
          <textarea
            rows={1}
            ref={(el) => {
              inputEl.current = el
              if (!el) return
              fit(el)
              if (!el.dataset.f) { el.dataset.f = 1; el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
            }}
            class="flex-1 bg-transparent outline-none py-3 text-base resize-none leading-snug max-h-40 overflow-auto"
            placeholder="Search links, tiles, URLs…   (> commands · paste a curl command or JSON · 1+1 · 10 km to mi · 100 usd to gbp)"
            value={input}
            onInput={(e) => { fit(e.target); setInput(e.target.value) }}
            spellcheck={false}
            autocomplete="off"
          />
          <kbd class="kbd kbd-sm">Esc</kbd>
        </div>
        {Panel && <Panel key={panelItem.key} item={panelItem} input={input} setInput={setInput} />}
        <ul ref={listEl} class={`max-h-[50vh] overflow-auto p-2 ${Panel ? 'hidden' : ''}`}>
          {!input && recent.length > 0 && <li class="px-3 pt-1 pb-1 text-xs uppercase tracking-wide opacity-50">Recent</li>}
          {!input && recent.length > 0 && rows(recent)}
          {(input || !recent.length) && sections.map((s) => (
            <>
              {(sections.length > 1 || !input) && <li key={'h' + s.provider.id} class="px-3 pt-2 pb-1 text-xs uppercase tracking-wide opacity-50">{s.provider.name}</li>}
              {rows(s.items)}
            </>
          ))}
          {!flat.length && <li class="px-3 py-6 text-center text-sm opacity-60">{input ? 'No matches' : 'Nothing to show yet — add some tiles.'}</li>}
        </ul>
        <div class="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 text-xs opacity-60 border-t border-base-300">
          {Panel ? <span>{panelItem.hint || 'Esc: close'}</span> : <><span><kbd class="kbd kbd-xs">↑↓</kbd> navigate</span>
          <span><kbd class="kbd kbd-xs">Enter</kbd> open in new tab</span>
          <span><kbd class="kbd kbd-xs">Shift</kbd>+<kbd class="kbd kbd-xs">Enter</kbd> same tab</span></>}
          {prefixes.map((p) => <span key={p.id}><kbd class="kbd kbd-xs">{p.prefix}</kbd> {p.name.toLowerCase()}</span>)}
        </div>
      </div>
      <div class="modal-backdrop" onClick={close} />
    </dialog>
  )
}
