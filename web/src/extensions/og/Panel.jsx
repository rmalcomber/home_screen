import { useState, useEffect, useRef } from 'preact/hooks'
import { useHotkeyScope, remember, CopyButton } from '../../core/extensions/host.js'
import { ogRequest, readResponse, checks, ogFill } from './engine.js'

const LEVEL = { ok: ['✓', 'text-success'], warn: ['!', 'text-warning'], info: ['i', 'opacity-60'] }

const Table = ({ rows, empty }) =>
  rows.length ? (
    <table class="table table-xs">
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={i} class="hover">
            <td class="font-mono font-semibold w-1/3 align-top whitespace-nowrap">{k}</td>
            <td class="font-mono break-all">{v === '' ? <span class="opacity-40">(empty)</span> : v}</td>
            <td class="w-12 text-right align-top"><CopyButton text={v} class="btn btn-ghost btn-xs" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p class="text-sm opacity-60 px-1">{empty}</p>
  )

function Preview({ data }) {
  const s = data.summary
  const [broken, setBroken] = useState(false)
  let host = ''
  try {
    host = new URL(s.url).hostname
  } catch {}
  return (
    <div class="grid gap-3">
      <div class="rounded-lg border border-base-300 overflow-hidden max-w-md bg-base-200">
        {s.image && !broken && (
          <img src={s.image} alt={s.imageAlt || ''} referrerpolicy="no-referrer" loading="lazy" class="w-full max-h-56 object-cover bg-base-300" onError={() => setBroken(true)} />
        )}
        {s.image && broken && <div class="p-3 text-xs opacity-60">The picture could not be loaded: {s.image}</div>}
        <div class="p-3 grid gap-1">
          <div class="text-[11px] uppercase tracking-wide opacity-60">{s.site || host}</div>
          <div class="font-semibold leading-snug">{s.title || <span class="opacity-50">(no title)</span>}</div>
          {s.description && <div class="text-sm opacity-80 line-clamp-3">{s.description}</div>}
        </div>
      </div>
      <Table rows={[['Title', s.title], ['Description', s.description], ['Image', s.image], ['URL', s.url], ['Site', s.site], ['Type', s.type]].filter(([, v]) => v)} empty="" />
    </div>
  )
}

/** Fetches a page through the server and shows how it looks when shared, with every Open Graph and Twitter tag. */
export function OgPanel({ item }) {
  const { norm } = item.data
  const [state, setState] = useState(null) // null | { loading } | { error } | { data, notes }
  const [tab, setTab] = useState('preview')
  const busy = useRef(false)

  const run = async () => {
    if (!norm.ok || busy.current) return
    busy.current = true
    setState({ loading: true })
    setTab('preview')
    try {
      const r = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ogRequest(norm.url)) })
      if (!r.ok) throw new Error(r.status === 403 ? 'The fetcher only works when this page is opened via localhost or 127.0.0.1' : `The server returned ${r.status}`)
      const res = readResponse(await r.json(), norm.url)
      if (res.ok) {
        remember('og', { key: `og:${norm.url}`, title: `Open Graph · ${new URL(norm.url).hostname}`, subtitle: res.data.summary.title.slice(0, 60), fill: ogFill(norm.url) })
        setState({ data: res.data, notes: res.notes, checks: checks(res.data) })
      } else setState({ error: res.error })
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

  if (!norm.ok) return <div class="p-4 text-sm text-error">{norm.error}</div>

  const d = state?.data
  const warns = state?.checks?.filter((c) => c.level === 'warn').length || 0
  const tabs = d
    ? [['preview', 'Preview'], ['og', `Open Graph ${d.og.length}`], ['twitter', `Twitter ${d.twitter.length}`], ['other', 'Other'], ['checks', warns ? `Checks · ${warns}` : 'Checks']]
    : []

  return (
    <div class="p-3 grid gap-3 max-h-[70vh] overflow-auto">
      <div class="flex flex-wrap items-center gap-2">
        <code class="font-mono text-sm break-all flex-1 min-w-0">{norm.url}</code>
        <button type="button" class="btn btn-primary btn-sm" disabled={state?.loading} onClick={run}>
          {state?.loading ? 'Fetching…' : d ? 'Fetch again' : 'Fetch'} <kbd class="kbd kbd-xs text-base-content">⏎</kbd>
        </button>
      </div>
      {!state && <p class="text-sm opacity-60">Press Enter to fetch the page. Your Home Screen server downloads it (browsers are not allowed to), and the tags are read here.</p>}
      {state?.error && <p class="text-sm text-error">{state.error}</p>}
      {state?.notes?.map((n) => <p key={n} class="text-xs text-warning">{n}</p>)}
      {d && (
        <>
          <div role="tablist" class="tabs tabs-box tabs-xs w-fit">
            {tabs.map(([k, label]) => <button key={k} type="button" role="tab" class={`tab ${tab === k ? 'tab-active' : ''}`} onClick={() => setTab(k)}>{label}</button>)}
          </div>
          {tab === 'preview' && <Preview data={d} />}
          {tab === 'og' && <Table rows={d.og} empty="No Open Graph tags (og:title, og:image...) on this page." />}
          {tab === 'twitter' && <Table rows={d.twitter} empty="No Twitter card tags on this page." />}
          {tab === 'other' && (
            <div class="grid gap-3">
              <Table rows={[['title', d.pageTitle], ['canonical', d.canonical], ...d.basic].filter(([, v]) => v)} empty="No other tags found." />
              {d.icons.length > 0 && <Table rows={d.icons.map((i) => [i.rel + (i.sizes ? ` ${i.sizes}` : ''), i.href])} empty="" />}
              {d.feeds.length > 0 && <Table rows={d.feeds.map((f) => [f.title || f.type, f.href])} empty="" />}
            </div>
          )}
          {tab === 'checks' && (
            <ul class="grid gap-1 text-sm">
              {state.checks.map((c, i) => (
                <li key={i} class="flex gap-2">
                  <span class={`w-4 shrink-0 text-center font-bold ${LEVEL[c.level][1]}`}>{LEVEL[c.level][0]}</span>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
