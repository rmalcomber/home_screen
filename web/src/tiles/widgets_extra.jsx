// Tabata timer, image carousel and keyboard-driven todo list.
import { useState, useEffect, useRef } from 'preact/hooks'
import { patchConfig } from '../store.js'
import { ColorTool } from '../components/ColorTool.jsx'
import { parseColor, toHex } from '../launcher/color.js'

const Field = ({ label, children }) => (
  <label class="grid gap-1">
    <span class="text-xs">{label}</span>
    {children}
  </label>
)
const Num = ({ label, value, onChange, min = 1, max = 3600 }) => (
  <Field label={label}>
    <input type="number" min={min} max={max} class="input input-sm input-bordered w-full" value={value} onInput={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))} />
  </Field>
)

// ---------------------------------------------------------------- tabata
function beep(freq = 880, ms = 150) {
  try {
    const ctx = (beep.ctx ||= new (window.AudioContext || window.webkitAudioContext)())
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = freq
    g.gain.value = 0.15
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + ms / 1000)
  } catch {}
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const tabata = {
  label: 'Tabata timer',
  size: [3, 10],
  defaults: { kind: 'tabata', prepare: 10, work: 20, rest: 10, rounds: 8, sound: true },
  Body({ tile }) {
    const c = tile.config
    const prep = c.prepare ?? 10
    // phase: idle | prep | work | rest | done
    const [s, setS] = useState({ phase: 'idle', left: 0, round: 1, running: false })
    const cfg = useRef(c)
    cfg.current = c

    const begin = (phase, round) => ({ phase, round, left: phase === 'prep' ? prep : phase === 'work' ? cfg.current.work : cfg.current.rest, running: true })

    useEffect(() => {
      if (!s.running) return
      const id = setInterval(() => {
        setS((p) => {
          if (p.left > 1) {
            if (p.left <= 4 && cfg.current.sound) beep(660, 80)
            return { ...p, left: p.left - 1 }
          }
          const snd = cfg.current.sound
          if (p.phase === 'prep') { snd && beep(1100, 300); return begin('work', 1) }
          if (p.phase === 'work') {
            if (p.round >= cfg.current.rounds) { snd && beep(520, 700); return { ...p, phase: 'done', left: 0, running: false } }
            snd && beep(520, 300)
            return cfg.current.rest > 0 ? begin('rest', p.round) : begin('work', p.round + 1)
          }
          snd && beep(1100, 300)
          return begin('work', p.round + 1)
        })
      }, 1000)
      return () => clearInterval(id)
    }, [s.running])

    const start = () => {
      beep(880, 60) // unlock audio on user gesture
      setS(s.phase === 'idle' || s.phase === 'done' ? begin(prep > 0 ? 'prep' : 'work', 1) : { ...s, running: true })
    }
    const reset = () => setS({ phase: 'idle', left: 0, round: 1, running: false })

    const total = c.rounds * (c.work + c.rest) - c.rest
    const style = {
      idle: ['bg-base-200', 'Ready'],
      prep: ['bg-warning/30', 'Get ready'],
      work: ['bg-success/30', 'WORK'],
      rest: ['bg-info/30', 'REST'],
      done: ['bg-primary/30', 'Done!'],
    }[s.phase]

    return (
      <div class={`flex flex-col items-center justify-center h-full gap-2 rounded-box p-2 transition-colors ${style[0]}`}>
        <div class="text-lg font-bold tracking-widest">{style[1]}</div>
        <div class="text-5xl font-mono font-bold tabular-nums">{s.phase === 'idle' ? mmss(c.work) : s.phase === 'done' ? '✓' : mmss(s.left)}</div>
        <div class="text-sm opacity-70">Round {Math.min(s.round, c.rounds)} / {c.rounds}</div>
        <div class="flex gap-2">
          {s.running ? (
            <button class="btn btn-sm btn-warning" onClick={() => setS({ ...s, running: false })}>Pause</button>
          ) : (
            <button class="btn btn-sm btn-primary" onClick={start}>{s.phase === 'idle' || s.phase === 'done' ? 'Start' : 'Resume'}</button>
          )}
          <button class="btn btn-sm btn-ghost" onClick={reset}>Reset</button>
        </div>
        <div class="text-xs opacity-50">{c.work}s on / {c.rest}s off · {mmss(Math.max(0, total))} total</div>
      </div>
    )
  },
  Options({ config, set }) {
    return (
      <div class="grid grid-cols-2 gap-2">
        <Num label="Get-ready (s)" min={0} value={config.prepare ?? 10} onChange={(v) => set({ prepare: v })} />
        <Num label="Rounds" max={99} value={config.rounds} onChange={(v) => set({ rounds: v })} />
        <Num label="Work (s)" value={config.work} onChange={(v) => set({ work: v })} />
        <Num label="Rest (s)" min={0} value={config.rest} onChange={(v) => set({ rest: v })} />
        <label class="label cursor-pointer justify-start gap-2 col-span-2"><input type="checkbox" class="checkbox checkbox-sm" checked={!!config.sound} onChange={(e) => set({ sound: e.target.checked })} /><span class="label-text">Beeps</span></label>
      </div>
    )
  },
}

// -------------------------------------------------------------- carousel
const carousel = {
  label: 'Image carousel',
  size: [4, 11],
  defaults: { kind: 'carousel', images: [], seconds: 6, fit: 'cover' },
  Body({ tile }) {
    const c = tile.config
    const imgs = c.images || []
    const [i, setI] = useState(0)
    const [hover, setHover] = useState(false)
    const n = imgs.length
    const idx = n ? i % n : 0

    useEffect(() => {
      if (n < 2 || hover || !c.seconds) return
      const id = setInterval(() => setI((x) => x + 1), c.seconds * 1000)
      return () => clearInterval(id)
    }, [n, hover, c.seconds])

    if (!n) return <p class="text-sm opacity-60 p-2">Edit this tile to add images (upload or paste URLs).</p>
    const go = (d) => setI((x) => (x + d + n * 1000) % n)
    return (
      <div class="relative h-full w-full group" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <img key={imgs[idx]} src={imgs[idx]} alt="" class={`absolute inset-0 w-full h-full rounded-box ${c.fit === 'contain' ? 'object-contain' : 'object-cover'}`} />
        {n > 1 && (
          <>
            <button class="btn btn-circle btn-sm absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-80" onClick={() => go(-1)}>‹</button>
            <button class="btn btn-circle btn-sm absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-80" onClick={() => go(1)}>›</button>
            <div class="absolute bottom-1 inset-x-0 flex justify-center gap-1">
              {imgs.map((_, k) => <button key={k} aria-label={`Image ${k + 1}`} class={`w-2 h-2 rounded-full ${k === idx ? 'bg-primary' : 'bg-base-content/40'}`} onClick={() => setI(k)} />)}
            </div>
          </>
        )}
      </div>
    )
  },
  Options({ config, set }) {
    const imgs = config.images || []
    const [err, setErr] = useState('')
    const upload = async (e) => {
      const out = []
      for (const f of e.target.files) {
        try {
          const r = await fetch(`/api/images?name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { 'Content-Type': f.type }, body: f })
          if (!r.ok) throw new Error()
          out.push((await r.json()).src)
        } catch {
          setErr(`Couldn't upload ${f.name} (PNG, JPEG, GIF, WebP or AVIF only)`)
        }
      }
      if (out.length) set({ images: [...imgs, ...out] })
      e.target.value = ''
    }
    const remove = (k) => {
      const src = imgs[k]
      if (src.startsWith('/api/images/')) fetch(src, { method: 'DELETE' }).catch(() => {})
      set({ images: imgs.filter((_, j) => j !== k) })
    }
    return (
      <div class="grid gap-2">
        <div class="flex flex-wrap gap-2">
          {imgs.map((src, k) => (
            <div key={k} class="relative w-16 h-16">
              <img src={src} class="w-full h-full object-cover rounded" alt="" />
              <button type="button" class="btn btn-circle btn-xs absolute -top-1 -right-1" onClick={() => remove(k)}>✕</button>
            </div>
          ))}
        </div>
        <label class="btn btn-sm btn-outline self-start">Upload images<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" multiple class="hidden" onChange={upload} /></label>
        <Field label="Or add image URLs (one per line)">
          <textarea class="textarea textarea-bordered textarea-sm w-full" rows="3" placeholder="https://…/photo.jpg" onChange={(e) => {
            const urls = e.target.value.split(/\s+/).filter((u) => /^https?:\/\//i.test(u))
            if (urls.length) { set({ images: [...imgs, ...urls] }); e.target.value = '' }
          }} />
        </Field>
        <div class="grid grid-cols-2 gap-2">
          <Num label="Seconds per image (0 = manual)" min={0} max={600} value={config.seconds ?? 6} onChange={(v) => set({ seconds: v })} />
          <Field label="Fit">
            <select class="select select-sm select-bordered" value={config.fit || 'cover'} onChange={(e) => set({ fit: e.target.value })}>
              <option value="cover">Fill (crop)</option>
              <option value="contain">Fit (whole image)</option>
            </select>
          </Field>
        </div>
        {err && <p class="text-xs text-error">{err}</p>}
      </div>
    )
  },
}

// ------------------------------------------------------------------ todo
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
  label: 'Todo list',
  size: [3, 12],
  defaults: { kind: 'todo', items: [] },
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

// ------------------------------------------------------------ colour picker
const DEFAULT_COLOR = '#3b82f6'
const colorpicker = {
  label: 'Colour picker',
  size: [4, 16],
  defaults: { kind: 'colorpicker', color: DEFAULT_COLOR, alpha: 1, history: [] },
  Body({ tile }) {
    const c = tile.config
    const [color, setColor] = useState(() => ({ ...(parseColor(c.color || DEFAULT_COLOR) || parseColor(DEFAULT_COLOR)), a: c.alpha ?? 1 }))
    const timer = useRef()
    const latest = useRef(tile)
    latest.current = tile

    // Save the working colour shortly after it stops changing.
    const change = (next) => {
      setColor(next)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => patchConfig(latest.current, { ...latest.current.config, color: toHex(next), alpha: next.a }), 600)
    }
    // Copying a value adds the colour to this tile's recent list.
    const copied = (_, col) => {
      const hex = toHex(col, true)
      const history = [hex, ...(latest.current.config.history || []).filter((h) => h !== hex)].slice(0, 12)
      patchConfig(latest.current, { ...latest.current.config, color: toHex(col), alpha: col.a, history })
    }
    const history = c.history || []
    return (
      <div class="grid gap-2">
        <ColorTool color={color} onChange={change} onCopy={copied} compact />
        {history.length > 0 && (
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Recent</div>
            <div class="flex flex-wrap gap-1">
              {history.map((h) => (
                <button key={h} type="button" title={h} class="w-6 h-6 rounded border border-base-content/20 hover:scale-110 transition-transform" style={{ background: h }} onClick={() => change(parseColor(h))} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  },
  Options: () => <p class="text-sm opacity-60">Pick a colour, then click any format to copy it. Copied colours are kept under Recent.</p>,
}

export const EXTRA_WIDGETS = { tabata, carousel, todo, colorpicker }
