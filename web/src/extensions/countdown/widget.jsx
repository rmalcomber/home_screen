// Countdown widget: one or several dates in a tile, as a list or as mini tiles.
import { useState, useEffect } from 'preact/hooks'
import { Field, ListRows } from '../../core/extensions/host.js'
import { countdownsOf, layoutOf, daysUntil, describe, sortCountdowns, normalise } from './timeutil.js'

function useNow(ms) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

const countdown = {
  Body({ tile }) {
    const c = tile.config
    const now = useNow(60000)
    let list = countdownsOf(c).filter((x) => x.label || x.date)
    if (!list.length) return <p class="text-sm opacity-60 p-2">Edit this tile and set a date.</p>
    if (c.sorted) list = sortCountdowns(list, now)
    const items = list.map((x) => ({ ...x, ...describe(daysUntil(x.date, now)) }))

    if (items.length === 1) {
      const i = items[0]
      return (
        <div class="flex flex-col items-center justify-center h-full">
          <div class="text-5xl font-bold tabular-nums">{i.n}</div>
          <div class="text-sm opacity-70">{i.word}</div>
          <div class="font-semibold text-center">{i.label}</div>
        </div>
      )
    }

    if (layoutOf(c) === 'tiles') {
      return (
        <div class="flex flex-wrap gap-2">
          {items.map((i, k) => (
            <div key={k} class="flex-1 basis-24 min-w-0 rounded-lg bg-base-200 border border-base-300 px-2 py-1.5 text-center">
              <div class="text-2xl font-bold tabular-nums leading-tight">{i.n}</div>
              <div class="text-[11px] opacity-60">{i.word}</div>
              <div class="text-xs font-semibold truncate" title={i.label}>{i.label}</div>
            </div>
          ))}
        </div>
      )
    }

    return (
      <ul class="flex flex-col divide-y divide-base-300">
        {items.map((i, k) => (
          <li key={k} class="flex items-center gap-2 py-1.5 px-1">
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-sm truncate">{i.label || i.date}</div>
              <div class="text-xs opacity-60">{i.date}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-xl font-bold tabular-nums leading-tight">{i.n}</div>
              <div class="text-xs opacity-60">{i.word}</div>
            </div>
          </li>
        ))}
      </ul>
    )
  },
  Options({ config, set }) {
    const rows = countdownsOf(config)
    const layout = layoutOf(config)
    return (
      <div class="grid gap-3">
        <ListRows
          rows={rows.length ? rows : [{ label: '', date: '' }]}
          onChange={(countdowns) => set({ countdowns })}
          blank={{ label: '', date: '' }}
          addLabel="+ Add countdown"
          render={(r, setRow) => (
            <div class="flex gap-1 flex-wrap">
              <input class="input input-sm input-bordered flex-1 min-w-32" placeholder="Label" aria-label="Label" value={r.label || ''} onInput={(e) => setRow({ label: e.target.value })} />
              <input type="date" class="input input-sm input-bordered" aria-label="Date" value={r.date || ''} onInput={(e) => setRow({ date: e.target.value })} />
            </div>
          )}
        />
        <Field label="Layout when there is more than one">
          <div role="tablist" class="tabs tabs-box tabs-xs w-fit">
            <button type="button" role="tab" class={`tab ${layout === 'list' ? 'tab-active' : ''}`} onClick={() => set({ layout: 'list' })}>List</button>
            <button type="button" role="tab" class={`tab ${layout === 'tiles' ? 'tab-active' : ''}`} onClick={() => set({ layout: 'tiles' })}>Mini tiles</button>
          </div>
        </Field>
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" class="checkbox checkbox-sm" checked={!!config.sorted} onChange={(e) => set({ sorted: e.target.checked })} />
          Sort by date, soonest first
        </label>
      </div>
    )
  },
  async prepare(config) {
    return normalise(config)
  },
}

export default countdown
