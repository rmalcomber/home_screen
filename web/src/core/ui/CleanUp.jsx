import { useState, useMemo, useRef } from 'preact/hooks'
import { cleaning, tiles, pages, settings, saveSettings, patchConfig, deleteTile, saveTile, createTileRaw, load } from '../store.js'
import { scan, findFromChecks } from '../cleanup/findings.js'
import { checkUrl, runPool } from '../cleanup/check.js'
import { planApply, applyPlan, undoPlan, summarise } from '../cleanup/apply.js'
import { urlKey, isLocalHost, parseWeb } from '../cleanup/links.js'
import { checkCache, lastCleanup } from '../cleanup/state.js'

const TABS = [
  ['dup', 'Duplicates'],
  ['dead', 'Dead and moved'],
  ['org', 'Organise'],
]

const KIND_STYLE = {
  Moved: 'badge-info',
  Redirects: 'badge-ghost',
  'Not working': 'badge-error',
  'Blocked or needs sign-in': 'badge-warning',
  'Too slow': 'badge-warning',
  'Server error': 'badge-warning',
}

/** Send one request to the server's runner. */
async function send(payload) {
  const r = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (r.status === 403) throw new Error('forbidden')
  if (!r.ok) throw new Error(`The server returned ${r.status}`)
  return r.json()
}

export function CleanUp() {
  if (!cleaning.value) return null
  return <Dialog />
}

function Dialog() {
  const [tab, setTab] = useState('dup')
  const [over, setOver] = useState({}) // finding id -> ticked or not, where the person chose
  const [filter, setFilter] = useState('')
  const [, tick] = useState(0)
  const [progress, setProgress] = useState(null) // { done, total } while checking
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const stopRef = useRef(false)
  const close = () => { stopRef.current = true; cleaning.value = false }

  const ignored = new Set(settings.value.cleanupIgnore || [])
  const { links, dups, organise } = useMemo(() => scan(tiles.value, pages.value), [tiles.value, pages.value])
  const checked = useMemo(() => findFromChecks(links, checkCache, ignored), [links, progress, settings.value.cleanupIgnore, checkCache.size])
  const lists = { dup: dups, dead: checked, org: organise }
  const isOn = (f) => (f.id in over ? over[f.id] : f.on)
  const q = filter.trim().toLowerCase()
  const shown = lists[tab].filter((f) => !q || `${f.title} ${f.detail} ${f.where} ${f.kind}`.toLowerCase().includes(q))

  const all = [...dups, ...checked, ...organise]
  const chosen = all.filter(isOn)
  const plan = useMemo(() => planApply(tiles.value, chosen.flatMap((f) => f.actions)), [tiles.value, over, checked, dups, organise])
  const empty = !plan.patches.length && !plan.deletes.length && !plan.creates.length

  const webLinks = links.filter((l) => parseWeb(l.url))
  const toCheck = [...new Set(webLinks.map((l) => l.url.trim()))].filter((u) => !isLocalHost(parseWeb(u).hostname) && !ignored.has(urlKey(u)))
  const haveChecked = toCheck.length > 0 && toCheck.every((u) => checkCache.has(u))

  const runCheck = async () => {
    stopRef.current = false
    setMsg('')
    const todo = toCheck.filter((u) => !checkCache.has(u))
    setProgress({ done: 0, total: todo.length })
    let denied = false
    await runPool(
      todo,
      async (u) => {
        try {
          return await checkUrl(u, send)
        } catch (e) {
          if (e.message === 'forbidden') { denied = true; stopRef.current = true }
          return { status: 'error', note: e.message }
        }
      },
      {
        limit: 5,
        shouldStop: () => stopRef.current,
        onResult: (u, r, done, total) => {
          if (!denied) checkCache.set(u, r)
          setProgress({ done, total })
        },
      },
    )
    setProgress(null)
    if (denied) setMsg('Link checks only work when this page is opened via localhost or 127.0.0.1 (or a host listed in --allowed-hosts). See the Options page of the docs.')
    else if (stopRef.current) setMsg('Stopped. The links checked so far are shown.')
    else {
      saveSettings({ cleanupLastCheck: Date.now() })
      setTab('dead')
    }
    tick((n) => n + 1)
  }

  const recheck = () => { for (const u of toCheck) checkCache.delete(u); runCheck() }

  const ignore = (f) => saveSettings({ cleanupIgnore: [...new Set([...ignored, f.key])] })
  const clearIgnored = () => saveSettings({ cleanupIgnore: [] })

  const setMany = (list, on) => setOver((o) => ({ ...o, ...Object.fromEntries(list.map((f) => [f.id, on])) }))

  const apply = async () => {
    if (empty || busy) return
    if (!window.confirm(`This will ${summarise(plan)}. You can undo it from this window until you reload the page. Continue?`)) return
    setBusy(true)
    setMsg('')
    try {
      const undo = await applyPlan(plan, { patchConfig, deleteTile, saveTile })
      lastCleanup.value = { undo, summary: summarise(plan), at: Date.now() }
      setOver({})
      setMsg(`Done: ${summarise(plan)}.`)
    } catch (e) {
      setMsg('Clean up stopped part way: ' + e.message + '. Nothing else was changed; use Undo to put back what was.')
    }
    setBusy(false)
  }

  const undo = async () => {
    const last = lastCleanup.value
    if (!last || busy) return
    setBusy(true)
    try {
      await undoPlan(last.undo, { patchConfig, deleteTile, restoreTile: ({ id: _id, ...rest }) => createTileRaw(rest) })
      await load()
      lastCleanup.value = null
      setMsg('Undone: the tiles are back as they were.')
    } catch (e) {
      setMsg('Undo failed: ' + e.message)
    }
    setBusy(false)
  }

  const pageCount = new Set(links.map((l) => l.pageId)).size
  const lastCheck = settings.value.cleanupLastCheck
  const deadNote = !haveChecked && checked.length === 0

  return (
    <dialog class="modal modal-open" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div class="modal-box max-w-4xl h-[88vh] flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <h3 class="font-bold text-lg">Clean up links</h3>
          <span class="text-xs opacity-60">{links.length} links on {new Set(links.map((l) => l.tileId)).size} tiles{pageCount > 1 ? `, ${pageCount} pages` : ''}</span>
          <button class="btn btn-sm btn-ghost ml-auto" onClick={close} aria-label="Close">✕</button>
        </div>
        <p class="text-sm opacity-70">
          Find duplicates, tidy addresses and, if you ask, check which links are dead or have moved. Nothing changes until you press Apply, and you can undo it.
        </p>

        <div class="flex flex-wrap items-center gap-2">
          {progress ? (
            <>
              <progress class="progress w-48" value={progress.done} max={progress.total || 1} />
              <span class="text-sm tabular-nums">{progress.done} / {progress.total}</span>
              <button class="btn btn-sm" onClick={() => { stopRef.current = true }}>Stop</button>
            </>
          ) : (
            <>
              <button class="btn btn-sm btn-outline" disabled={!toCheck.length} onClick={haveChecked ? recheck : runCheck}>{haveChecked ? 'Check again' : 'Check links'}</button>
              <span class="text-xs opacity-60">
                {toCheck.length ? `Asks each of ${toCheck.length} sites from your Home Screen server.` : 'No web links to check.'}
                {lastCheck ? ` Last checked ${new Date(lastCheck).toLocaleString()}.` : ''}
              </span>
            </>
          )}
        </div>

        <div role="tablist" class="tabs tabs-box tabs-sm w-fit">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" class={`tab ${tab === id ? 'tab-active' : ''}`} onClick={() => setTab(id)}>
              {label} <span class="badge badge-sm ml-1">{lists[id].length}</span>
            </button>
          ))}
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <input class="input input-sm input-bordered w-48" placeholder="Filter" aria-label="Filter" value={filter} onInput={(e) => setFilter(e.target.value)} />
          <button class="btn btn-xs btn-ghost" onClick={() => setMany(shown, true)}>Tick shown</button>
          <button class="btn btn-xs btn-ghost" onClick={() => setMany(shown, false)}>Untick shown</button>
          {tab === 'dead' && ignored.size > 0 && <button class="btn btn-xs btn-ghost ml-auto" onClick={clearIgnored}>Stop ignoring {ignored.size} link{ignored.size === 1 ? '' : 's'}</button>}
        </div>

        <div class="flex-1 overflow-auto border border-base-300 rounded">
          {shown.length === 0 ? (
            <p class="p-4 text-sm opacity-70">
              {tab === 'dup' && 'No duplicate links. Links that go to the same place (ignoring http or https, www, a trailing slash and tracking parameters) would be listed here.'}
              {tab === 'dead' && (deadNote ? 'Press Check links to look for dead and moved links.' : lists.dead.length ? 'Nothing matches the filter.' : 'Every link checked answered normally.')}
              {tab === 'org' && 'Nothing to tidy.'}
            </p>
          ) : (
            <ul class="divide-y divide-base-300">
              {shown.map((f) => (
                <li key={f.id} class="flex items-start gap-2 p-2 hover:bg-base-200">
                  <input type="checkbox" class="checkbox checkbox-sm mt-1" aria-label={`Apply: ${f.title}`} checked={isOn(f)} disabled={!f.actions.length} onChange={(e) => setOver((o) => ({ ...o, [f.id]: e.target.checked }))} />
                  <div class="min-w-0 flex-1 grid gap-0.5">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class={`badge badge-sm ${KIND_STYLE[f.kind] || 'badge-ghost'}`}>{f.kind}</span>
                      <span class="font-semibold text-sm truncate">{f.title}</span>
                      {f.warn && <span class="text-warning text-xs">check this one</span>}
                    </div>
                    <div class="text-xs font-mono opacity-80 break-all">{f.detail}</div>
                    {f.note && <div class="text-xs opacity-60">{f.note}</div>}
                    <div class="text-xs opacity-50">{f.where}</div>
                  </div>
                  {tab === 'dead' && f.key && <button class="btn btn-xs btn-ghost shrink-0" title="Stop listing this link" onClick={() => ignore(f)}>Ignore</button>}
                  {!f.actions.length && <span class="text-xs opacity-50 shrink-0">edit the tile</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {msg && <div role="status" class="alert py-2 text-sm">{msg}</div>}

        <div class="modal-action mt-0 flex-wrap">
          <span class="text-sm opacity-70 mr-auto">{empty ? 'Nothing ticked.' : `${chosen.length} ticked: will ${summarise(plan)}.`}</span>
          {lastCleanup.value && <button class="btn btn-sm btn-ghost" disabled={busy} onClick={undo} title={lastCleanup.value.summary}>Undo last clean up</button>}
          <button class="btn btn-sm" onClick={close}>Close</button>
          <button class="btn btn-sm btn-primary" disabled={empty || busy} onClick={apply}>{busy ? 'Working…' : 'Apply'}</button>
        </div>
      </div>
      <div class="modal-backdrop" onClick={close} />
    </dialog>
  )
}
