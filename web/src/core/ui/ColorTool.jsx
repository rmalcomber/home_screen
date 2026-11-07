import { useState } from 'preact/hooks'
import { parseColor, toHex, formats, contrast, shades, harmonies } from '../../launcher/color.js'

const Swatch = ({ c, onPick, size = 'w-7 h-7', title }) => (
  <button type="button" title={title || toHex(c)} class={`${size} rounded border border-base-content/20 shrink-0 hover:scale-110 transition-transform`} style={{ background: toHex(c, true) }} onClick={() => onPick(c)} />
)

const Badge = ({ ok, children }) => <span class={`badge badge-xs ${ok ? 'badge-success' : 'badge-ghost opacity-60'}`}>{children}</span>

/**
 * Shared colour tool (launcher panel + dashboard widget).
 *   color     { r, g, b, a }
 *   onChange  (color) => void   called on every change
 *   onCopy    (value, color) => void   called after a value is copied
 *   compact   hide contrast and harmonies (used in the narrow widget)
 */
export function ColorTool({ color, onChange, onCopy, compact }) {
  const [text, setText] = useState(toHex(color, color.a < 1))
  const [bad, setBad] = useState(false)
  const [copied, setCopied] = useState('')

  const set = (c, fromText) => {
    onChange(c)
    if (!fromText) { setText(toHex(c, c.a < 1)); setBad(false) }
  }
  const copy = async (id, value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(id)
      setTimeout(() => setCopied(''), 1200)
      onCopy?.(value, color)
    } catch {}
  }
  const eyedrop = async () => {
    try {
      const r = await new window.EyeDropper().open()
      const c = parseColor(r.sRGBHex)
      if (c) set({ ...c, a: color.a })
    } catch { /* cancelled */ }
  }
  const pick = (c) => set({ ...c, a: color.a })

  const rows = formats(color)
  const ct = compact ? null : contrast(color)

  return (
    <div class="grid gap-3">
      <div class="flex items-center gap-2">
        <input
          type="color"
          class="w-16 h-12 rounded cursor-pointer bg-transparent border border-base-content/20 p-0 shrink-0"
          value={toHex(color)}
          onInput={(e) => set({ ...parseColor(e.target.value), a: color.a })}
          title="Pick a colour"
        />
        <div class="grid gap-1 flex-1 min-w-0">
          <input
            class={`input input-sm input-bordered font-mono w-full ${bad ? 'input-error' : ''}`}
            value={text}
            placeholder="#ff8800, rgb(…), hsl(…), red…"
            spellcheck={false}
            onInput={(e) => {
              setText(e.target.value)
              const c = parseColor(e.target.value)
              setBad(!c)
              if (c) set(c, true)
            }}
          />
          <label class="flex items-center gap-2 text-xs opacity-80">
            Alpha
            <input type="range" class="range range-xs flex-1" min="0" max="100" value={Math.round(color.a * 100)} onInput={(e) => set({ ...color, a: +e.target.value / 100 })} />
            <span class="w-9 text-right font-mono">{Math.round(color.a * 100)}%</span>
          </label>
        </div>
        {typeof window !== 'undefined' && window.EyeDropper && (
          <button type="button" class="btn btn-sm btn-square" title="Pick a colour from anywhere on screen" onClick={eyedrop}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></svg>
          </button>
        )}
      </div>

      <div class="rounded-lg h-10 border border-base-content/20" style={{ background: `linear-gradient(${toHex(color, true)}, ${toHex(color, true)}), repeating-conic-gradient(#8884 0% 25%, transparent 0% 50%) 50% / 12px 12px` }} />

      <ul class="grid gap-0.5">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" class="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-base-300 text-left" onClick={() => copy(r.id, r.value)} title="Click to copy">
              <span class="w-20 shrink-0 text-xs font-semibold opacity-70">{r.label}</span>
              <span class="font-mono text-xs flex-1 truncate">{r.value}</span>
              <span class="text-xs opacity-60 shrink-0">{copied === r.id ? 'Copied ✓' : 'Copy'}</span>
            </button>
          </li>
        ))}
      </ul>

      <div>
        <div class="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Shades</div>
        <div class="flex flex-wrap gap-1">{shades(color).map((c, i) => <Swatch key={i} c={c} onPick={pick} />)}</div>
      </div>

      {!compact && (
        <>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Harmonies</div>
            <div class="grid grid-cols-2 gap-2">
              {harmonies(color).map((h) => (
                <div key={h.label} class="flex items-center gap-2">
                  <div class="flex gap-1">{h.colors.map((c, i) => <Swatch key={i} c={c} onPick={pick} />)}</div>
                  <span class="text-xs opacity-70">{h.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Contrast as text colour (WCAG)</div>
            <div class="grid grid-cols-2 gap-2">
              {[['white', 'On white', '#ffffff', '#000000'], ['black', 'On black', '#000000', '#ffffff']].map(([k, label, bg]) => (
                <div key={k} class="rounded p-2 flex items-center gap-2" style={{ background: bg }}>
                  <span class="font-bold text-sm" style={{ color: toHex(color) }}>Aa</span>
                  <span class="text-xs" style={{ color: k === 'white' ? '#000' : '#fff' }}>{ct[k].ratio}:1</span>
                  <span class="ml-auto flex gap-1"><Badge ok={ct[k].aa}>AA</Badge><Badge ok={ct[k].aaa}>AAA</Badge><Badge ok={ct[k].aaLarge}>Large</Badge></span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
