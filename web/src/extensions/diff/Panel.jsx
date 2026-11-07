import { useState, useEffect, useMemo } from 'preact/hooks'
import { useHotkeyScope, remember, shortHash } from '../../core/extensions/host.js'
import { computeDiff, toUnifiedDiff, diffFill } from './engine.js'

const CONTEXT = 3
const MAX_ROWS = 4000

const Parts = ({ parts, text, cls }) =>
  parts ? parts.map((p, i) => (p.changed ? <span key={i} class={`${cls} rounded-sm`}>{p.text}</span> : p.text)) : text

/** Hide long runs of unchanged rows (keep CONTEXT around changes); returns [{ rows } | { hidden: n, start }] segments. */
function segmentRows(rows, showAll, expanded) {
  if (showAll) return rows.map((r, i) => ({ row: r, i }))
  const keep = new Array(rows.length).fill(false)
  rows.forEach((r, i) => {
    if (r.kind === 'eq') return
    for (let k = Math.max(0, i - CONTEXT); k <= Math.min(rows.length - 1, i + CONTEXT); k++) keep[k] = true
  })
  const out = []
  for (let i = 0; i < rows.length; i++) {
    if (keep[i] || expanded.has(i)) { out.push({ row: rows[i], i }); continue }
    let j = i
    while (j < rows.length && !keep[j]) j++
    out.push({ hidden: j - i, start: i })
    // expanded segments are keyed by their first row, so expanding shows the whole run
    i = j - 1
  }
  return out
}

const Num = ({ n }) => <span class="w-10 shrink-0 text-right pr-2 opacity-40 select-none">{n ?? ''}</span>

function Unified({ segs, expand }) {
  const line = (key, sign, n1, n2, content, bg) => (
    <div key={key} class={`flex ${bg}`}>
      <Num n={n1} /><Num n={n2} />
      <span class="w-4 shrink-0 select-none opacity-60">{sign}</span>
      <span class="whitespace-pre-wrap break-all flex-1">{content}</span>
    </div>
  )
  return segs.map((s) => {
    if (s.hidden) return <button key={'h' + s.start} class="w-full text-center text-xs opacity-60 hover:opacity-100 bg-base-300/50 py-0.5" onClick={() => expand(s.start, s.hidden)}>⋯ {s.hidden} unchanged line{s.hidden === 1 ? '' : 's'}</button>
    const r = s.row
    if (r.kind === 'eq') return line(s.i, ' ', r.an, r.bn, r.text, '')
    if (r.kind === 'del') return line(s.i, '−', r.an, null, r.text, 'bg-error/15')
    if (r.kind === 'add') return line(s.i, '+', null, r.bn, r.text, 'bg-success/15')
    return [
      line(s.i + 'a', '−', r.an, null, <Parts parts={r.aParts} cls="bg-error/40" />, 'bg-error/15'),
      line(s.i + 'b', '+', null, r.bn, <Parts parts={r.bParts} cls="bg-success/40" />, 'bg-success/15'),
    ]
  })
}

function Split({ segs, expand }) {
  const cell = (n, content, bg) => (
    <div class={`flex min-w-0 ${bg}`}><Num n={n} /><span class="whitespace-pre-wrap break-all flex-1 min-w-0">{content}</span></div>
  )
  return segs.map((s) => {
    if (s.hidden) return <button key={'h' + s.start} class="w-full text-center text-xs opacity-60 hover:opacity-100 bg-base-300/50 py-0.5" onClick={() => expand(s.start, s.hidden)}>⋯ {s.hidden} unchanged line{s.hidden === 1 ? '' : 's'}</button>
    const r = s.row
    return (
      <div key={s.i} class="grid grid-cols-2 gap-px">
        {r.kind === 'eq' && [cell(r.an, r.text, ''), cell(r.bn, r.text, '')]}
        {r.kind === 'del' && [cell(r.an, r.text, 'bg-error/15'), cell(null, '', 'bg-base-300/30')]}
        {r.kind === 'add' && [cell(null, '', 'bg-base-300/30'), cell(r.bn, r.text, 'bg-success/15')]}
        {r.kind === 'mod' && [cell(r.an, <Parts parts={r.aParts} cls="bg-error/40" />, 'bg-error/15'), cell(r.bn, <Parts parts={r.bParts} cls="bg-success/40" />, 'bg-success/15')]}
      </div>
    )
  })
}

export function DiffPanel({ item }) {
  const [a, setA] = useState(item.data.a)
  const [b, setB] = useState(item.data.b)
  const [ignoreWs, setIgnoreWs] = useState(false)
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [split, setSplit] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [expanded, setExpanded] = useState(new Set())
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    const t = setTimeout(() => { setResult(computeDiff(a, b, { ignoreWs, ignoreCase })); setExpanded(new Set()) }, 200)
    return () => clearTimeout(t)
  }, [a, b, ignoreWs, ignoreCase])

  const unified = useMemo(() => (result && !result.stats.identical ? toUnifiedDiff(result.rows) : ''), [result])

  const copy = async () => {
    if (!unified) return
    try {
      await navigator.clipboard.writeText(unified)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      if (a.length + b.length <= 40000) {
        const firstChange = result.rows.find((r) => r.kind !== 'eq')
        const text = firstChange ? (firstChange.kind === 'mod' ? firstChange.bText : firstChange.text) : ''
        remember('diff', { key: `diff:${shortHash(a)}:${shortHash(b)}`, title: `Diff · +${result.stats.added} −${result.stats.removed}`, subtitle: (text || '').slice(0, 60), fill: diffFill(a, b) })
      }
    } catch {}
  }

  const onKeydown = useHotkeyScope()
  useEffect(() => {
    const h = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); copy() } }
    return onKeydown(h)
  })

  const paste = async (set) => {
    try { set(await navigator.clipboard.readText()); setNote('') } catch { setNote('The browser blocked clipboard access. Paste with Ctrl+V into the box instead.') }
  }

  const expand = (start, n) => setExpanded((s) => { const x = new Set(s); for (let i = start; i < start + n; i++) x.add(i); return x })
  const rows = result?.rows || []
  const tooMany = rows.length > MAX_ROWS
  const segs = useMemo(() => segmentRows(tooMany ? rows.slice(0, MAX_ROWS) : rows, showAll, expanded), [result, showAll, expanded])

  const box = (label, value, set) => (
    <div class="grid gap-1 min-w-0">
      <div class="flex items-center gap-1">
        <span class="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
        <button class="btn btn-xs btn-ghost ml-auto" onClick={() => paste(set)}>Paste</button>
        <button class="btn btn-xs btn-ghost" onClick={() => set('')}>Clear</button>
      </div>
      <textarea class="textarea textarea-bordered textarea-sm font-mono w-full leading-snug" rows={6} value={value} onInput={(e) => set(e.target.value)} spellcheck={false} wrap="off" placeholder="Paste text…" />
    </div>
  )

  return (
    <div class="p-3 grid gap-3 max-h-[70vh] overflow-auto">
      <div class="grid grid-cols-2 gap-2">
        {box('Original', a, setA)}
        {box('Changed', b, setB)}
      </div>
      {note && <div role="alert" class="alert alert-warning py-1 text-sm">{note}</div>}

      <div class="flex flex-wrap items-center gap-3">
        {result && (
          result.stats.identical
            ? <span class="badge badge-success">{a || b ? 'Identical' : 'Nothing to compare yet'}</span>
            : <><span class="badge badge-success badge-outline">+{result.stats.added}</span><span class="badge badge-error badge-outline">−{result.stats.removed}</span></>
        )}
        <div role="tablist" class="tabs tabs-box tabs-xs">
          <button role="tab" class={`tab ${!split ? 'tab-active' : ''}`} onClick={() => setSplit(false)}>Unified</button>
          <button role="tab" class={`tab ${split ? 'tab-active' : ''}`} onClick={() => setSplit(true)}>Side by side</button>
        </div>
        <label class="label cursor-pointer gap-1 p-0"><input type="checkbox" class="checkbox checkbox-xs" checked={ignoreWs} onChange={(e) => setIgnoreWs(e.target.checked)} /><span class="label-text text-xs">Ignore whitespace</span></label>
        <label class="label cursor-pointer gap-1 p-0"><input type="checkbox" class="checkbox checkbox-xs" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} /><span class="label-text text-xs">Ignore case</span></label>
        <label class="label cursor-pointer gap-1 p-0"><input type="checkbox" class="checkbox checkbox-xs" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /><span class="label-text text-xs">Show unchanged</span></label>
        <button class="btn btn-sm btn-ghost" onClick={() => { setA(b); setB(a) }} title="Swap the two texts">⇄ Swap</button>
        <button class="btn btn-sm btn-primary ml-auto" disabled={!unified} onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy diff'} <kbd class="kbd kbd-xs text-base-content">Ctrl ⏎</kbd>
        </button>
      </div>

      {result?.tooDifferent && <div role="alert" class="alert alert-warning py-1 text-sm">These texts are too different to align line by line, so the changed section is shown as a full replacement.</div>}

      {result && !result.stats.identical && (
        <div class="font-mono text-xs rounded border border-base-300 overflow-auto max-h-[45vh]">
          {split ? <Split segs={segs} expand={expand} /> : <Unified segs={segs} expand={expand} />}
          {tooMany && <div class="p-2 text-center opacity-60">Showing the first {MAX_ROWS} lines of the diff. Copy the diff to get everything.</div>}
        </div>
      )}
    </div>
  )
}
