import { useState, useMemo } from 'preact/hooks'
import { importing, tiles, saveTile } from '../store.js'
import { parseBookmarks, groupByDomain, faviconUrl } from '../util.js'

// target values: 'skip' | 'new:<name>' | 'tile:<id>'
export function ImportBookmarks() {
  if (!importing.value) return null
  return <Dialog />
}

function Dialog() {
  const [groups, setGroups] = useState(null)
  const [target, setTarget] = useState({}) // domain -> target
  const [sel, setSel] = useState(new Set())
  const [filter, setFilter] = useState('')
  const [bulk, setBulk] = useState('new')
  const [bulkName, setBulkName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const existing = tiles.value.filter((t) => t.type === 'bookmarks')
  const close = () => (importing.value = false)

  const onFile = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    const links = parseBookmarks(await f.text())
    const g = groupByDomain(links)
    setGroups(g)
    setMsg(`${links.length} bookmarks across ${g.length} domains`)
  }

  const shown = useMemo(() => (groups || []).filter((g) => !filter || g.domain.includes(filter.toLowerCase())), [groups, filter])
  const tgt = (d) => target[d] || 'skip'
  const toggle = (d) => setSel((s) => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n })
  const selectShown = () => setSel(new Set(shown.map((g) => g.domain)))

  const applyBulk = () => {
    const t = { ...target }
    for (const d of sel) {
      if (bulk === 'each') t[d] = 'new:' + d
      else if (bulk === 'new') t[d] = 'new:' + (bulkName.trim() || 'Imported')
      else t[d] = bulk // tile:<id>
    }
    setTarget(t)
  }

  const plan = useMemo(() => {
    const m = new Map()
    for (const g of groups || []) {
      const k = tgt(g.domain)
      if (k === 'skip') continue
      m.set(k, [...(m.get(k) || []), ...g.links])
    }
    return m
  }, [groups, target])
  const total = [...plan.values()].reduce((n, l) => n + l.length, 0)

  const run = async () => {
    setBusy(true)
    try {
      for (const [k, links] of plan) {
        const seen = new Set()
        const add = (list) => list.filter((l) => !seen.has(l.url) && seen.add(l.url))
        if (k.startsWith('tile:')) {
          const t = tiles.value.find((x) => x.id === +k.slice(5))
          const cur = t.config.links || []
          cur.forEach((l) => seen.add(l.url))
          await saveTile({ ...t, config: { ...t.config, links: [...cur, ...add(links)] } })
        } else {
          const name = k.slice(4)
          // merge into a same-titled tile created earlier in this run or before
          const t = tiles.value.find((x) => x.type === 'bookmarks' && x.title === name)
          if (t) {
            const cur = t.config.links || []
            cur.forEach((l) => seen.add(l.url))
            await saveTile({ ...t, config: { ...t.config, links: [...cur, ...add(links)] } })
          } else {
            await saveTile({ type: 'bookmarks', title: name, icon: null, x: 0, y: 0, w: 4, h: Math.min(16, Math.max(6, links.length * 1 + 4)), collapsed: false, config: { links: add(links) } })
          }
        }
      }
      close()
    } catch (e) {
      setMsg('Import failed: ' + e.message)
      setBusy(false)
    }
  }

  return (
    <dialog class="modal modal-open" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div class="modal-box max-w-3xl h-[85vh] flex flex-col gap-3">
        <h3 class="font-bold text-lg">Import Chrome bookmarks</h3>
        <p class="text-sm opacity-70">In Chrome: Bookmark manager → ⋮ → Export bookmarks. Choose that HTML file here. Links are grouped by domain (subdomains merged).</p>
        <input type="file" accept=".html,.htm" class="file-input file-input-sm file-input-bordered w-full" onChange={onFile} />

        {groups && (
          <>
            <div class="flex flex-wrap items-center gap-2">
              <input class="input input-sm input-bordered w-48" placeholder="Filter domains" value={filter} onInput={(e) => setFilter(e.target.value)} />
              <button class="btn btn-sm btn-ghost" onClick={selectShown}>Select shown</button>
              <button class="btn btn-sm btn-ghost" onClick={() => setSel(new Set())}>Clear</button>
              <span class="text-xs opacity-60">{sel.size} selected</span>
            </div>
            <div class="flex flex-wrap items-center gap-2 bg-base-200 rounded p-2">
              <span class="text-sm">Move selected to</span>
              <select class="select select-sm select-bordered" value={bulk} onChange={(e) => setBulk(e.target.value)}>
                <option value="new">New tile…</option>
                <option value="each">A tile per domain</option>
                {existing.map((t) => <option value={'tile:' + t.id}>{t.title}</option>)}
              </select>
              {bulk === 'new' && <input class="input input-sm input-bordered w-40" placeholder="Tile name" value={bulkName} onInput={(e) => setBulkName(e.target.value)} />}
              <button class="btn btn-sm btn-primary" disabled={!sel.size} onClick={applyBulk}>Apply</button>
            </div>

            <div class="flex-1 overflow-auto border border-base-300 rounded">
              <table class="table table-sm table-pin-rows">
                <thead><tr><th /><th>Domain</th><th>#</th><th>Goes to</th></tr></thead>
                <tbody>
                  {shown.map((g) => (
                    <tr key={g.domain} class="hover">
                      <td><input type="checkbox" class="checkbox checkbox-sm" checked={sel.has(g.domain)} onChange={() => toggle(g.domain)} /></td>
                      <td>
                        <details>
                          <summary class="cursor-pointer flex items-center gap-2 list-none"><img src={faviconUrl('https://' + g.domain)} width="16" height="16" alt="" />{g.domain}</summary>
                          <ul class="text-xs opacity-70 ml-6 mt-1">{g.links.map((l) => <li class="truncate max-w-md" title={l.url}>{l.title}</li>)}</ul>
                        </details>
                      </td>
                      <td>{g.links.length}</td>
                      <td>
                        <select class="select select-xs select-bordered" value={tgt(g.domain).startsWith('new:') && tgt(g.domain) !== 'new:' + g.domain ? 'custom' : tgt(g.domain)} onChange={(e) => setTarget((t) => ({ ...t, [g.domain]: e.target.value === "custom" ? tgt(g.domain) : e.target.value }))}>
                          <option value="skip">Skip</option>
                          <option value={'new:' + g.domain}>New tile “{g.domain}”</option>
                          {tgt(g.domain).startsWith('new:') && tgt(g.domain) !== 'new:' + g.domain && <option value="custom">New tile “{tgt(g.domain).slice(4)}”</option>}
                          {existing.map((t) => <option value={'tile:' + t.id}>{t.title}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div class="modal-action mt-0 items-center">
          <span class="text-xs opacity-70 mr-auto">{msg}{total ? ` · importing ${total} links into ${plan.size} tile(s)` : ''}</span>
          <button class="btn" onClick={close}>Cancel</button>
          <button class="btn btn-primary" disabled={!total || busy} onClick={run}>{busy ? 'Importing…' : 'Import'}</button>
        </div>
      </div>
      <div class="modal-backdrop" onClick={close} />
    </dialog>
  )
}
