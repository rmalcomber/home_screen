// Built-in widgets. Add a new one by adding an entry here:
//   { label, defaults, Body({tile}), Options({config, set}) }
import { useState, useEffect, useRef } from 'preact/hooks'
import { patchConfig } from '../store.js'
import { clock, weather } from './widgets_time.jsx'

function useNow(ms) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

const Field = ({ label, children }) => (
  <label class="form-control w-full">
    <span class="label-text text-xs mb-1 block">{label}</span>
    {children}
  </label>
)

// ---- countdown ----
const countdown = {
  label: 'Countdown',
  size: [3, 6],
  defaults: { kind: 'countdown', label: '', date: '' },
  Body({ tile }) {
    const c = tile.config
    const now = useNow(60000)
    if (!c.date) return <p class="text-sm opacity-60 p-2">Edit this tile and set a date.</p>
    const diff = new Date(c.date + 'T00:00:00') - now
    const days = Math.ceil(diff / 86400000)
    return (
      <div class="flex flex-col items-center justify-center h-full">
        <div class="text-5xl font-bold tabular-nums">{Math.abs(days)}</div>
        <div class="text-sm opacity-70">{days === 0 ? 'today' : days > 0 ? `day${days === 1 ? '' : 's'} until` : `day${days === -1 ? '' : 's'} since`}</div>
        <div class="font-semibold text-center">{c.label}</div>
      </div>
    )
  },
  Options({ config, set }) {
    return (
      <div class="grid gap-2">
        <Field label="Label"><input class="input input-sm input-bordered w-full" value={config.label || ''} onInput={(e) => set({ label: e.target.value })} /></Field>
        <Field label="Date"><input type="date" class="input input-sm input-bordered w-full" value={config.date || ''} onInput={(e) => set({ date: e.target.value })} /></Field>
      </div>
    )
  },
}

// ---- notes ----
const notes = {
  label: 'Notes',
  size: [3, 8],
  defaults: { kind: 'notes', text: '' },
  Body({ tile }) {
    const [v, setV] = useState(tile.config.text || '')
    return (
      <textarea
        class="textarea textarea-ghost w-full h-full resize-none text-sm leading-snug"
        placeholder="Scratch notes…"
        value={v}
        onInput={(e) => setV(e.target.value)}
        onBlur={() => v !== (tile.config.text || '') && patchConfig(tile, { ...tile.config, text: v })}
      />
    )
  },
  Options: () => <p class="text-sm opacity-60">Type directly in the tile; it saves when you click away.</p>,
}



import { EXTRA_WIDGETS } from './widgets_extra.jsx'
import { TOOL_WIDGETS } from './widgets_tools.jsx'
import { META } from './catalog.js'

// Every widget, with its picker metadata (category, icon, description) merged in.
const ALL = { clock, weather, countdown, notes, ...EXTRA_WIDGETS, ...TOOL_WIDGETS }
export const WIDGETS = Object.fromEntries(Object.entries(ALL).map(([k, w]) => [k, { ...META[k], ...w }]))
