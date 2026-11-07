import { useState, useEffect, useMemo } from 'preact/hooks'
import { remember, CopyButton } from '../../core/extensions/host.js'
import { getDataset, searchFeatures, featureInfo, caniuseFill } from './engine.js'

const BADGE = { y: 'badge-success', a: 'badge-warning', n: 'badge-error', p: 'badge-info', u: 'badge-ghost' }
const pct = (n) => `${n >= 10 ? n.toFixed(1) : n.toFixed(2)}%`.replace(/\.?0+%$/, '%')

const summaryText = (f) => `${f.title}: ${f.rows.map((r) => `${r.name} ${r.summary}`).join(', ')} (${pct(f.usageFull)} of users fully, ${pct(f.usagePartial)} partly)`

function Detail({ f, text }) {
  const fmt = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  const remembered = () => remember('caniuse', { key: `caniuse:${f.id}`, title: `Can I use · ${f.title}`, subtitle: `${pct(f.usageFull)} full support`, fill: caniuseFill(text) })
  const links = f.links.filter((l) => /^https?:\/\//i.test(l.url))
  const noteKeys = Object.keys(f.noteMap)
  return (
    <div class="grid gap-3">
      <div class="grid gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <h4 class="font-semibold text-base">{f.title}</h4>
          {f.status && <span class="badge badge-ghost badge-sm">{f.status}</span>}
        </div>
        {f.description && <p class="text-sm opacity-80">{f.description}</p>}
      </div>

      <div>
        <div class="flex h-2 rounded overflow-hidden bg-base-300" role="img" aria-label={`${pct(f.usageFull)} of users fully, ${pct(f.usagePartial)} partly`}>
          <div class="bg-success" style={{ width: `${Math.min(100, f.usageFull)}%` }} />
          <div class="bg-warning" style={{ width: `${Math.min(100 - f.usageFull, f.usagePartial)}%` }} />
        </div>
        <div class="text-xs opacity-70 mt-1">{pct(f.usageFull)} of users have full support, {pct(f.usagePartial)} partial (worldwide, by usage)</div>
      </div>

      <table class="table table-xs">
        <thead><tr><th>Browser</th><th>Now</th><th>Since</th></tr></thead>
        <tbody>
          {f.rows.map((r) => (
            <tr key={r.key}>
              <td class="whitespace-nowrap">{r.name} <span class="opacity-50 text-xs">{r.current}</span></td>
              <td><span class={`badge badge-sm ${BADGE[r.code] || 'badge-ghost'}`}>{r.label}{r.prefixed ? ' (prefix)' : ''}{r.disabled ? ' (off by default)' : ''}</span></td>
              <td class="font-mono text-xs">{r.code === 'y' || r.code === 'a' ? r.summary : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {f.notes && <p class="text-xs opacity-80"><span class="font-semibold">Notes:</span> {f.notes}</p>}
      {noteKeys.length > 0 && (
        <details class="text-xs opacity-80">
          <summary class="cursor-pointer">Browser notes ({noteKeys.length})</summary>
          <ol class="mt-1 grid gap-0.5">{noteKeys.map((k) => <li key={k}><span class="font-mono">{k}.</span> {f.noteMap[k]}</li>)}</ol>
        </details>
      )}

      <div class="flex flex-wrap items-center gap-2">
        <CopyButton text={summaryText(f)} label="Copy summary" class="btn btn-primary btn-sm" onCopied={remembered} />
        <a class="btn btn-ghost btn-sm" href={f.url} target="_blank" rel="noopener noreferrer" onClick={remembered}>Open on caniuse.com</a>
        {f.spec && /^https?:\/\//i.test(f.spec) && <a class="btn btn-ghost btn-sm" href={f.spec} target="_blank" rel="noopener noreferrer">Specification</a>}
      </div>
      {links.length > 0 && (
        <ul class="text-xs grid gap-0.5">
          {links.slice(0, 5).map((l) => <li key={l.url}><a class="link" href={l.url} target="_blank" rel="noopener noreferrer">{l.title || l.url}</a></li>)}
        </ul>
      )}
      <p class="text-[11px] opacity-50">Data from <a class="link" href="https://caniuse.com" target="_blank" rel="noopener noreferrer">Can I use</a> (CC BY 4.0){f.updated ? `, updated ${fmt(f.updated)}` : ''}.</p>
    </div>
  )
}

/** Searches the Can I use data, downloading it on first use, and shows browser support for a feature. */
export function CaniusePanel({ item }) {
  const { text } = item.data
  const [load, setLoad] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [sel, setSel] = useState(0)

  useEffect(() => {
    let dead = false
    setLoad({ status: 'loading' })
    getDataset().then(
      (ds) => !dead && setLoad({ status: 'ready', ds }),
      (e) => !dead && setLoad({ status: 'error', error: e.message }),
    )
    return () => { dead = true }
  }, [attempt])

  const matches = useMemo(() => (load.status === 'ready' ? searchFeatures(load.ds.data, text, 8) : []), [load, text])
  const info = useMemo(() => (matches[sel] ? featureInfo(load.ds.data, matches[sel].id) : null), [load, matches, sel])
  useEffect(() => setSel(0), [text])

  if (!text) return <p class="p-4 text-sm opacity-60">Type a web feature after caniuse, for example caniuse grid, caniuse flexbox gap or caniuse webp.</p>
  if (load.status === 'loading') return <p class="p-4 text-sm opacity-60">Loading browser support data… (about 450 KB, downloaded once and kept in your browser)</p>
  if (load.status === 'error') {
    return (
      <div class="p-4 grid gap-2 text-sm">
        <p class="text-error">{load.error}</p>
        <div><button type="button" class="btn btn-sm" onClick={() => setAttempt((n) => n + 1)}>Try again</button></div>
      </div>
    )
  }
  if (!matches.length) return <p class="p-4 text-sm opacity-60">No feature matches “{text}”. Try a shorter word, such as grid, flex, webp or fetch.</p>

  return (
    <div class="p-3 grid gap-3 max-h-[70vh] overflow-auto">
      {load.ds.stale && <p class="text-xs text-warning">You are offline: showing the data saved on {new Date(load.ds.fetchedAt).toLocaleDateString()}.</p>}
      {matches.length > 1 && (
        <div class="flex flex-wrap gap-1">
          {matches.map((m, i) => (
            <button key={m.id} type="button" class={`btn btn-xs ${i === sel ? 'btn-primary' : 'btn-ghost border-base-300'}`} onClick={() => setSel(i)}>{m.title}</button>
          ))}
        </div>
      )}
      {info && <Detail f={info} text={text} />}
    </div>
  )
}
