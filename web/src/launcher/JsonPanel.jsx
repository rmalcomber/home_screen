import { useState, useEffect, useMemo } from 'preact/hooks'
import { useHotkeyScope } from './hotkeys.js'
import { formatJson, stats, highlight } from './json.js'
import { csvFill } from './csv.js'
import { remember } from './history.js'

const PK = 'launcher.jsonPrefs'
const loadPrefs = () => {
  try { return { indent: 2, sort: false, minify: false, ...JSON.parse(localStorage.getItem(PK) || '{}') } } catch { return { indent: 2, sort: false, minify: false } }
}
const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)
const HIGHLIGHT_LIMIT = 200_000

export function JsonPanel({ item, setInput }) {
  const r = item.data
  const [prefs, setPrefs] = useState(loadPrefs)
  const [copied, setCopied] = useState(false)
  const set = (p) => setPrefs((x) => {
    const n = { ...x, ...p }
    try { localStorage.setItem(PK, JSON.stringify(n)) } catch {}
    return n
  })

  const text = useMemo(() => (r.ok ? formatJson(r.value, prefs) : ''), [r, prefs.indent, prefs.sort, prefs.minify])
  const info = useMemo(() => (r.ok ? stats(r.value) : null), [r])
  const tokens = useMemo(() => (text.length <= HIGHLIGHT_LIMIT ? highlight(text) : null), [text])

  const copy = async () => {
    if (!r.ok) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      const min = formatJson(r.value, { minify: true })
      if (min.length <= 20000) remember('json', { key: 'json:' + min, title: min.length > 70 ? min.slice(0, 70) + '…' : min, subtitle: info.type, fill: min })
    } catch {}
  }

  const onKeydown = useHotkeyScope()
  useEffect(() => {
    const h = (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); copy() } }
    return onKeydown(h)
  })

  if (!r.ok) {
    const { message, line, col, snippet } = r.error
    const shown = snippet.length > 200 ? snippet.slice(Math.max(0, col - 60), col + 60) : snippet
    const caret = snippet.length > 200 ? Math.min(col - 1, 60) : col - 1
    return (
      <div class="p-3 grid gap-2">
        <div role="alert" class="alert alert-error py-2 text-sm">Invalid JSON: {message} (line {line}, column {col})</div>
        <pre class="bg-base-200 rounded p-2 text-xs font-mono overflow-auto">{shown}{'\n'}{' '.repeat(Math.max(0, caret))}^</pre>
      </div>
    )
  }

  return (
    <div class="p-3 grid gap-2">
      <div class="flex flex-wrap items-center gap-2">
        {r.relaxed ? <span class="badge badge-warning badge-sm" title="Comments, trailing commas, single quotes or bare keys were fixed">relaxed JSON → fixed</span> : <span class="badge badge-success badge-sm">valid JSON</span>}
        {r.unwrapped && <span class="badge badge-info badge-sm">unwrapped encoded string</span>}
        <span class="text-xs opacity-70">{info.type} · depth {info.depth} · {fmtSize(info.bytes)} minified</span>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div role="tablist" class="tabs tabs-box tabs-xs">
          <button role="tab" class={`tab ${!prefs.minify ? 'tab-active' : ''}`} onClick={() => set({ minify: false })}>Pretty</button>
          <button role="tab" class={`tab ${prefs.minify ? 'tab-active' : ''}`} onClick={() => set({ minify: true })}>Minified</button>
        </div>
        {!prefs.minify && (
          <select class="select select-xs select-bordered w-24" value={String(prefs.indent)} onChange={(e) => set({ indent: e.target.value === 'tab' ? 'tab' : +e.target.value })}>
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tabs</option>
          </select>
        )}
        <label class="label cursor-pointer gap-1 p-0"><input type="checkbox" class="checkbox checkbox-xs" checked={prefs.sort} onChange={(e) => set({ sort: e.target.checked })} /><span class="label-text text-xs">Sort keys</span></label>
        {r.ok && (Array.isArray(r.value) || (r.value && typeof r.value === 'object')) && setInput && (
          <button class="btn btn-sm btn-ghost ml-auto" title="Convert this JSON to CSV" onClick={() => setInput(csvFill(formatJson(r.value, { minify: true })))}>→ CSV</button>
        )}
        <button class="btn btn-primary btn-sm" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'} <kbd class="kbd kbd-xs text-base-content">⏎</kbd></button>
      </div>

      <pre class={`bg-base-200 rounded p-2 text-xs font-mono max-h-[50vh] overflow-auto ${prefs.minify ? 'whitespace-pre-wrap break-all' : ''}`}>
        {tokens ? tokens.map((t, i) => (t.cls ? <span key={i} class={t.cls}>{t.text}</span> : t.text)) : text}
      </pre>
    </div>
  )
}
