import { useState, useMemo } from 'preact/hooks'
import { WIDGETS } from '../tiles/widgets.jsx'
import { CATEGORIES } from '../tiles/catalog.js'
import { IconView } from './IconView.jsx'

/** Browse widgets by category (or search them all) and pick one. */
export function WidgetPicker({ value, onPick }) {
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const entries = useMemo(() => Object.entries(WIDGETS), [])
  const needle = q.trim().toLowerCase()
  const shown = entries.filter(([, w]) => (needle ? `${w.label} ${w.description} ${w.category}`.toLowerCase().includes(needle) : cat === 'All' || w.category === cat))
  const count = (c) => entries.filter(([, w]) => w.category === c).length

  return (
    <div class="grid gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <input class="input input-sm input-bordered flex-1 min-w-40" placeholder="Search widgets…" value={q} onInput={(e) => setQ(e.target.value)} />
        <span class="text-xs opacity-60">{entries.length} widgets</span>
      </div>
      {!needle && (
        <div role="tablist" class="tabs tabs-box tabs-xs flex-wrap">
          {['All', ...CATEGORIES].map((c) => (
            <button key={c} type="button" role="tab" class={`tab ${cat === c ? 'tab-active' : ''}`} onClick={() => setCat(c)}>
              {c} <span class="ml-1 opacity-50">{c === 'All' ? entries.length : count(c)}</span>
            </button>
          ))}
        </div>
      )}
      <div class="grid grid-cols-2 gap-2 max-h-72 overflow-auto pr-1" role="listbox" aria-label="Widgets">
        {shown.map(([k, w]) => (
          <button
            key={k}
            type="button"
            role="option"
            aria-selected={value === k}
            class={`text-left rounded-lg border p-2 flex gap-2 items-start transition-colors ${value === k ? 'border-primary bg-primary/15' : 'border-base-300 hover:border-primary/50 hover:bg-base-200'}`}
            onClick={() => onPick(k)}
          >
            <span class="w-6 h-6 flex items-center justify-center shrink-0 mt-0.5"><IconView icon={w.icon} size={18} /></span>
            <span class="min-w-0">
              <span class="block text-sm font-semibold leading-tight">{w.label}</span>
              {(needle || cat === 'All') && <span class="block text-[10px] uppercase tracking-wide opacity-50">{w.category}</span>}
              <span class="block text-xs opacity-70 leading-snug line-clamp-2">{w.description}</span>
            </span>
          </button>
        ))}
        {!shown.length && <p class="col-span-2 text-sm opacity-60 p-2">No widgets match “{q}”.</p>}
      </div>
    </div>
  )
}
