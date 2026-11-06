import { useState, useEffect } from 'preact/hooks'
import { IconView } from './IconView.jsx'
import { icons } from '../store.js'

const SETS = [
  ['', 'All popular', 'fa6-brands,fa6-solid,fa6-regular,simple-icons,mdi,logos,tabler,lucide'],
  ['fa6-brands', 'FA Brands', 'fa6-brands'],
  ['fa6-solid', 'FA Solid', 'fa6-solid,fa6-regular'],
  ['simple-icons', 'Simple Icons (brands)', 'simple-icons'],
  ['logos', 'Logos (colour)', 'logos'],
  ['mdi', 'Material', 'mdi'],
]

export function IconPicker({ value, onChange }) {
  const [q, setQ] = useState('')
  const [set, setSet] = useState(0)
  const [found, setFound] = useState([])
  const [mine, setMine] = useState([])
  const [err, setErr] = useState('')

  const refresh = () => icons.list().then(setMine).catch(() => {})
  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (q.trim().length < 2) return setFound([])
    const id = setTimeout(() => {
      fetch(`https://api.iconify.design/search?query=${encodeURIComponent(q.trim())}&limit=48&prefixes=${SETS[set][2]}`)
        .then((r) => r.json())
        .then((j) => setFound(j.icons || []))
        .catch(() => setErr('Icon search needs internet access'))
    }, 300)
    return () => clearTimeout(id)
  }, [q, set])

  const upload = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    try {
      const r = await icons.upload(f.name.replace(/\.svg$/i, ''), await f.text())
      await refresh()
      onChange(`upload:${r.id}`)
      setErr('')
    } catch {
      setErr('Upload failed — is that a valid SVG?')
    }
    e.target.value = ''
  }

  const pick = (name) => onChange('iconify:' + name)
  const Btn = ({ icon, title }) => (
    <button type="button" title={title} class={`btn btn-square btn-sm ${value === icon ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onChange(icon)}>
      <IconView icon={icon} size={20} />
    </button>
  )

  return (
    <div class="grid gap-2">
      <div class="flex items-center gap-2">
        <span class="text-xs opacity-70">Current:</span>
        {value ? <IconView icon={value} size={22} /> : <span class="text-xs opacity-50">none</span>}
        {value && <button type="button" class="btn btn-xs btn-ghost" onClick={() => onChange(null)}>Clear</button>}
      </div>
      <div class="join w-full">
        <input class="input input-sm input-bordered join-item flex-1" placeholder="Search icons: github, aws, jira…" value={q} onInput={(e) => setQ(e.target.value)} />
        <select class="select select-sm select-bordered join-item w-44" value={set} onChange={(e) => setSet(+e.target.value)}>
          {SETS.map(([, label], i) => <option value={i}>{label}</option>)}
        </select>
      </div>
      {found.length > 0 && (
        <div class="flex flex-wrap gap-1 max-h-32 overflow-auto">
          {found.map((n) => <Btn key={n} icon={'iconify:' + n} title={n} />)}
        </div>
      )}
      <div class="flex flex-wrap items-center gap-2">
        <input class="input input-xs input-bordered w-56" placeholder="or paste name e.g. fa6-brands:github" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (e.target.value.includes(':')) pick(e.target.value.trim()) } }} />
        <label class="btn btn-xs btn-outline">Upload SVG<input type="file" accept=".svg,image/svg+xml" class="hidden" onChange={upload} /></label>
      </div>
      {mine.length > 0 && (
        <div>
          <div class="text-xs opacity-70 mb-1">Your uploads</div>
          <div class="flex flex-wrap gap-1">{mine.map((i) => <Btn key={i.id} icon={`upload:${i.id}`} title={i.name} />)}</div>
        </div>
      )}
      {err && <p class="text-xs text-error">{err}</p>}
    </div>
  )
}
