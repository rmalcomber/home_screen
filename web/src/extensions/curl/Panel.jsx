import { useState, useEffect, useRef } from 'preact/hooks'
import { useHotkeyScope, remember } from '../../core/extensions/host.js'
import { runPayload } from './engine.js'

const METHOD_CLASS = { GET: 'badge-info', POST: 'badge-success', PUT: 'badge-warning', PATCH: 'badge-warning', DELETE: 'badge-error' }
const statusClass = (s) => (s >= 500 ? 'badge-error' : s >= 400 ? 'badge-warning' : s >= 300 ? 'badge-info' : 'badge-success')
const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)

function Section({ title, count, children, open = true }) {
  return (
    <details open={open} class="group">
      <summary class="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide opacity-70 flex items-center gap-2">
        {title}
        {count != null && <span class="badge badge-ghost badge-xs">{count}</span>}
      </summary>
      <div class="mt-1">{children}</div>
    </details>
  )
}

const KV = ({ rows, implied = [] }) => (
  <table class="table table-xs">
    <tbody>
      {rows.map(([k, v], i) => (
        <tr key={i} class="hover">
          <td class="font-mono font-semibold w-1/3 align-top whitespace-nowrap">{k}{implied.includes(k) && <span class="ml-1 text-[10px] font-normal opacity-50">(implied)</span>}</td>
          <td class="font-mono break-all">{v}</td>
        </tr>
      ))}
    </tbody>
  </table>
)

export function CurlPanel({ item, input }) {
  const p = item.data
  const [state, setState] = useState(null) // null | {loading} | {res} | {error}
  const [tab, setTab] = useState('body')
  const busy = useRef(false)

  const run = async () => {
    if (!p.ok || p.unsupported || busy.current) return
    busy.current = true
    remember('curl', { key: 'curl:' + input.trim(), title: `${p.method} ${p.url}`, subtitle: 'curl command', fill: input.trim() })
    setState({ loading: true })
    setTab('body')
    try {
      const r = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(runPayload(p)) })
      if (!r.ok) throw new Error(r.status === 403 ? 'The runner only works when this page is opened via localhost or 127.0.0.1' : `Server returned ${r.status}`)
      const j = await r.json()
      setState(j.error ? { error: j.error, ms: j.ms } : { res: j })
    } catch (e) {
      setState({ error: e.message })
    }
    busy.current = false
  }

  const onKeydown = useHotkeyScope()
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Enter' && !e.isComposing && !e.shiftKey) { e.preventDefault(); run() }
    }
    return onKeydown(h)
  })

  if (!p.ok) return <div class="p-4 text-sm text-error">{p.error}</div>

  const res = state?.res
  let pretty = res?.body || ''
  if (res && /json/i.test(res.headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] || '')) {
    try { pretty = JSON.stringify(JSON.parse(res.body), null, 2) } catch {}
  }

  return (
    <div class="p-3 grid gap-3 max-h-[65vh] overflow-auto">
      <div class="flex items-center gap-2">
        <span class={`badge font-mono font-bold ${METHOD_CLASS[p.method] || 'badge-neutral'}`}>{p.method}</span>
        <span class="font-mono text-sm break-all min-w-0"><span class="opacity-60">{p.origin}</span><span class="font-semibold">{p.path}</span></span>
        <button class={`btn btn-primary btn-sm ml-auto shrink-0 ${p.unsupported || state?.loading ? 'btn-disabled' : ''}`} onClick={run}>
          {state?.loading ? <span class="loading loading-spinner loading-xs" /> : 'Run'} <kbd class="kbd kbd-xs text-base-content">⏎</kbd>
        </button>
      </div>

      <div class="flex flex-wrap gap-1">
        {p.follow && <span class="badge badge-outline badge-sm">follow redirects</span>}
        {p.insecure && <span class="badge badge-outline badge-warning badge-sm">insecure TLS</span>}
        {p.user && <span class="badge badge-outline badge-sm">basic auth: {p.user}</span>}
        {p.timeout && <span class="badge badge-outline badge-sm">timeout {p.timeout}s</span>}
      </div>
      {p.warnings.map((w) => <div key={w} role="alert" class="alert alert-warning py-1 text-sm">{w}</div>)}

      {p.params.length > 0 && <Section title="Query params" count={p.params.length}><KV rows={p.params} /></Section>}
      {p.headers.length > 0 && <Section title="Headers" count={p.headers.length}><KV rows={p.headers} implied={p.implied} /></Section>}
      {p.body !== null && (
        <Section title={`Body · ${p.bodyKind}`}>
          {p.bodyKind === 'form' ? <KV rows={p.bodyParams} /> : <pre class="bg-base-200 rounded p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-60 overflow-auto">{p.bodyPretty ?? p.body}</pre>}
        </Section>
      )}

      {state && (
        <div class="border-t border-base-300 pt-3 grid gap-2">
          {state.loading && <div class="text-sm opacity-70">Running…</div>}
          {state.error && <div role="alert" class="alert alert-error py-2 text-sm break-all">{state.error}</div>}
          {res && (
            <>
              <div class="flex flex-wrap items-center gap-2">
                <span class={`badge font-mono font-bold ${statusClass(res.status)}`}>{res.status} {res.status_text}</span>
                <span class="text-xs opacity-70">{res.ms} ms · {fmtSize(res.size)}{res.truncated ? ' (truncated at 2 MB)' : ''}</span>
                <div role="tablist" class="tabs tabs-box tabs-xs ml-auto">
                  <button role="tab" class={`tab ${tab === 'body' ? 'tab-active' : ''}`} onClick={() => setTab('body')}>Body</button>
                  <button role="tab" class={`tab ${tab === 'headers' ? 'tab-active' : ''}`} onClick={() => setTab('headers')}>Headers ({res.headers.length})</button>
                </div>
                {tab === 'body' && !res.binary && <button class="btn btn-xs btn-ghost" onClick={() => navigator.clipboard?.writeText(pretty)}>Copy</button>}
              </div>
              {tab === 'headers' ? (
                <KV rows={res.headers} />
              ) : res.binary ? (
                <div class="text-sm opacity-70">Binary response ({fmtSize(res.size)}) — not displayed.</div>
              ) : (
                <pre class="bg-base-200 rounded p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-96 overflow-auto">{pretty || '(empty body)'}</pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
