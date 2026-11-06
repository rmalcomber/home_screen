import { useState } from 'preact/hooks'
import { editing, saveTile, deleteTile } from '../store.js'
import { IconPicker } from './IconPicker.jsx'
import { WidgetPicker } from './WidgetPicker.jsx'
import { WIDGETS } from '../tiles/widgets.jsx'
import { devServices } from '../util.js'

const TYPES = [
  ['bookmarks', 'Bookmarks', 'A titled list of links with favicons'],
  ['dev', 'Developer', 'Dev / Stage / Prod URLs with colour codes'],
  ['github', 'GitHub repos', 'Repo links with a quick-links dropdown'],
  ['widget', 'Widget', 'Clocks, weather, calculators, generators and developer tools'],
]

const DEFAULT_CONFIG = {
  bookmarks: { links: [] },
  dev: { services: [{ name: '', dev: '', stage: '', prod: '' }] },
  github: { owner: '', repos: [] },
  widget: {}, // chosen from the widget picker
}
const DEFAULT_SIZE = { bookmarks: [4, 12], dev: [4, 7], github: [4, 10], widget: [3, 8] }

const Input = (p) => <input class="input input-sm input-bordered w-full" {...p} />

function ListEditor({ rows, onChange, fields, addLabel }) {
  const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  return (
    <div class="grid gap-1">
      {rows.map((r, i) => (
        <div key={i} class="flex gap-1">
          {fields.map(([k, ph, cls]) => <input key={k} class={`input input-sm input-bordered ${cls}`} placeholder={ph} value={r[k] || ''} onInput={(e) => set(i, k, e.target.value)} />)}
          <button type="button" class="btn btn-sm btn-ghost btn-square" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" class="btn btn-sm btn-outline self-start" onClick={() => onChange([...rows, {}])}>+ {addLabel}</button>
    </div>
  )
}

export function TileEditor() {
  const t = editing.value
  if (!t) return null
  return <Form key={t.id ?? 'new'} initial={t} />
}

function Form({ initial }) {
  const isNew = !initial.id
  const [type, setType] = useState(initial.type || 'bookmarks')
  const [title, setTitle] = useState(initial.title || '')
  const [icon, setIcon] = useState(initial.icon || null)
  const [config, setConfig] = useState(() => {
    const c = initial.config || DEFAULT_CONFIG[type]
    return type === 'dev' ? { services: devServices(c) } : c
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // Title and icon fill themselves in from the chosen widget until you type/pick your own.
  const [titleTouched, setTitleTouched] = useState(!isNew)
  const [iconTouched, setIconTouched] = useState(!isNew)
  const merge = (p) => setConfig((c) => ({ ...c, ...p }))

  const changeType = (k) => {
    setType(k)
    setConfig(DEFAULT_CONFIG[k])
    if (!titleTouched) setTitle('')
    if (!iconTouched) setIcon(null)
  }
  const pickWidget = (kind) => {
    const w = WIDGETS[kind]
    setConfig(w.defaults)
    if (!titleTouched) setTitle(w.label)
    if (!iconTouched) setIcon(w.icon)
  }

  const close = () => (editing.value = null)
  const save = async (e) => {
    e.preventDefault()
    if (type === 'widget' && !WIDGETS[config.kind]) { setErr('Choose a widget first.'); return }
    setBusy(true)
    setErr('')
    try {
      let cfg = config
      if (type === 'widget') cfg = (await WIDGETS[config.kind]?.prepare?.(config)) || config
      const [w, h] = (type === 'widget' && WIDGETS[config.kind]?.size) || DEFAULT_SIZE[type]
      const finalTitle = title.trim() || (type === 'widget' ? WIDGETS[config.kind]?.label : TYPES.find((x) => x[0] === type)[1])
      await saveTile({ ...initial, type, title: finalTitle, icon, config: cfg, ...(isNew ? { w, h, x: 0, y: 0 } : {}) })
      close()
    } catch (ex) {
      setErr(ex.message)
      setBusy(false)
    }
  }
  const del = async () => {
    if (confirm(`Delete tile "${initial.title}"?`)) { await deleteTile(initial.id); close() }
  }

  const W = type === 'widget' ? WIDGETS[config.kind] : null

  return (
    <dialog class="modal modal-open" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <form class="modal-box max-w-xl grid gap-3" onSubmit={save}>
        <h3 class="font-bold text-lg">{isNew ? 'Add tile' : 'Edit tile'}</h3>

        {isNew && (
          <div class="grid grid-cols-2 gap-2">
            {TYPES.map(([k, label, desc]) => (
              <button type="button" key={k} class={`btn h-auto py-2 flex-col items-start text-left ${type === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => changeType(k)}>
                <span>{label}</span><span class="text-xs font-normal opacity-70 whitespace-normal">{desc}</span>
              </button>
            ))}
          </div>
        )}

        {type === 'widget' && isNew && (
          <div class="grid gap-1">
            <span class="text-xs font-semibold">Choose a widget</span>
            <WidgetPicker value={config.kind} onPick={pickWidget} />
          </div>
        )}
        {type === 'widget' && !isNew && (
          <div class="flex items-center gap-2 text-sm">
            <span class="text-xs">Widget:</span>
            <span class="badge badge-outline">{W?.label || config.kind || 'unknown'}</span>
            {W?.category && <span class="text-xs opacity-60">{W.category}</span>}
          </div>
        )}

        <label class="grid gap-1"><span class="text-xs">Title</span>
          <Input value={title} onInput={(e) => { setTitle(e.target.value); setTitleTouched(e.target.value !== '') }} placeholder={W?.label || TYPES.find((x) => x[0] === type)[1]} autofocus={type !== 'widget'} />
        </label>

        <div class="grid gap-1"><span class="text-xs">Icon (optional)</span><IconPicker value={icon} onChange={(v) => { setIcon(v); setIconTouched(true) }} /></div>

        {type === 'bookmarks' && (
          <div class="grid gap-1"><span class="text-xs">Links</span>
            <ListEditor rows={config.links || []} onChange={(links) => merge({ links })} addLabel="Add link" fields={[['title', 'Title', 'w-40'], ['url', 'https://…', 'flex-1']]} />
          </div>
        )}

        {type === 'dev' && (
          <div class="grid gap-3">
            {(config.services || []).map((v, i) => {
              const setV = (p) => merge({ services: config.services.map((x, j) => (j === i ? { ...x, ...p } : x)) })
              return (
                <div key={i} class="grid gap-2 p-3 rounded-box border border-base-300 bg-base-200/50">
                  <div class="flex gap-1">
                    <Input value={v.name || ''} onInput={(e) => setV({ name: e.target.value })} placeholder="Service name" />
                    <button type="button" class="btn btn-sm btn-ghost btn-square" title="Remove service" onClick={() => merge({ services: config.services.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                  {[['dev', 'Dev', 'badge-info'], ['stage', 'Stage', 'badge-warning'], ['prod', 'Prod', 'badge-error']].map(([k, l, b]) => (
                    <label key={k} class="flex items-center gap-2"><span class={`badge ${b} w-16 shrink-0`}>{l}</span><Input value={v[k] || ''} onInput={(e) => setV({ [k]: e.target.value.trim() })} placeholder={`https://… (optional)`} /></label>
                  ))}
                </div>
              )
            })}
            <button type="button" class="btn btn-sm btn-outline self-start" onClick={() => merge({ services: [...(config.services || []), {}] })}>+ Add service</button>
          </div>
        )}

        {type === 'github' && (
          <div class="grid gap-2">
            <label class="grid gap-1"><span class="text-xs">Default owner (optional) — then just enter repo names below</span>
              <Input value={config.owner || ''} onInput={(e) => merge({ owner: e.target.value.trim() })} placeholder="e.g. rmalcomber" />
            </label>
            <span class="text-xs -mb-1">Repositories</span>
            <ListEditor rows={config.repos || []} onChange={(repos) => merge({ repos })} addLabel="Add repo" fields={[['url', config.owner ? 'repo-name (or owner/repo, or full URL)' : 'owner/repo or https://github.com/owner/repo', 'flex-1']]} />
          </div>
        )}

        {type === 'widget' && W && (
          <div class="grid gap-2">
            <span class="text-xs font-semibold">{W.label} settings</span>
            <W.Options config={config} set={merge} />
          </div>
        )}

        {err && <p class="text-error text-sm">{err}</p>}
        <div class="modal-action mt-0">
          {!isNew && <button type="button" class="btn btn-error btn-outline mr-auto" onClick={del}>Delete</button>}
          <button type="button" class="btn" onClick={close}>Cancel</button>
          <button type="submit" class={`btn btn-primary ${busy || (type === 'widget' && !W) ? 'btn-disabled' : ''}`}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
      <div class="modal-backdrop" onClick={close} />
    </dialog>
  )
}
