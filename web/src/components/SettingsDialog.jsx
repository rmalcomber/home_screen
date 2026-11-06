import { useState } from 'preact/hooks'
import { settings, settingsOpen, saveSettings } from '../store.js'

const SWATCHES = ['#1c2229', '#0f172a', '#1e1b4b', '#14312b', '#3b1d2a', '#2b2b2b', '#000000', '#e2e8f0']

export function SettingsDialog() {
  if (!settingsOpen.value) return null
  return <Dialog />
}

function Dialog() {
  const s = settings.value
  const [err, setErr] = useState('')
  const [url, setUrl] = useState('')
  const glass = Number(s.glass ?? 0)
  const close = () => (settingsOpen.value = false)

  const dropOld = () => {
    if (typeof s.bgImage === 'string' && s.bgImage.startsWith('/api/images/')) fetch(s.bgImage, { method: 'DELETE' }).catch(() => {})
  }
  const setImage = (src) => { dropOld(); saveSettings({ bgImage: src }) }

  const upload = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    try {
      const r = await fetch(`/api/images?name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { 'Content-Type': f.type }, body: f })
      if (!r.ok) throw new Error()
      setImage((await r.json()).src)
      setErr('')
    } catch {
      setErr('Upload failed — use a PNG, JPEG, GIF, WebP or AVIF image.')
    }
    e.target.value = ''
  }

  return (
    <dialog class="modal modal-open" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div class="modal-box max-w-lg grid gap-4">
        <h3 class="font-bold text-lg">Settings</h3>

        <section class="grid gap-2">
          <h4 class="font-semibold text-sm">Background colour</h4>
          <div class="flex flex-wrap items-center gap-2">
            <input type="color" class="w-10 h-8 rounded cursor-pointer bg-transparent" value={s.bgColor || '#1c2229'} onInput={(e) => saveSettings({ bgColor: e.target.value })} />
            {SWATCHES.map((c) => (
              <button key={c} type="button" title={c} class={`w-6 h-6 rounded-full border ${s.bgColor === c ? 'ring-2 ring-primary' : 'border-base-content/30'}`} style={{ background: c }} onClick={() => saveSettings({ bgColor: c })} />
            ))}
            <button type="button" class="btn btn-xs btn-ghost" disabled={!s.bgColor} onClick={() => saveSettings({ bgColor: '' })}>Theme default</button>
          </div>
        </section>

        <section class="grid gap-2">
          <h4 class="font-semibold text-sm">Background image</h4>
          {s.bgImage && (
            <div class="flex items-center gap-3">
              <img src={s.bgImage} alt="" class="w-24 h-14 object-cover rounded" />
              <button type="button" class="btn btn-sm btn-ghost" onClick={() => setImage('')}>Remove</button>
            </div>
          )}
          <label class="btn btn-sm btn-outline self-start">
            {s.bgImage ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" class="hidden" onChange={upload} />
          </label>
          <div class="join w-full">
            <input class="input input-sm input-bordered join-item flex-1" placeholder="…or an image URL (https://…)" value={url} onInput={(e) => setUrl(e.target.value)} />
            <button type="button" class="btn btn-sm join-item" disabled={!/^https?:\/\//i.test(url.trim())} onClick={() => { setImage(url.trim()); setUrl('') }}>Use</button>
          </div>
          {err && <p class="text-xs text-error">{err}</p>}
        </section>

        <section class="grid gap-1">
          <label class="label cursor-pointer justify-start gap-2"><input type="checkbox" class="checkbox checkbox-sm" checked={s.autoHideBar !== false} onChange={(e) => saveSettings({ autoHideBar: e.target.checked })} /><span class="label-text">Auto-hide title bar (move the mouse to the top edge to show it)</span></label>
        </section>

        <section class="grid gap-1">
          <div class="flex justify-between"><h4 class="font-semibold text-sm">Glass</h4><span class="text-xs opacity-70">{glass}%</span></div>
          <input type="range" min="0" max="100" step="1" class="range range-primary range-sm" value={glass} onInput={(e) => saveSettings({ glass: +e.target.value })} />
          <p class="text-xs opacity-60">0% is solid tiles; higher makes tiles and the top bar see-through and blurs the background behind them.</p>
        </section>

        <div class="modal-action mt-0">
          <button type="button" class="btn btn-ghost mr-auto" onClick={() => saveSettings({ bgColor: '', bgImage: '', glass: 0 })}>Reset all</button>
          <button type="button" class="btn btn-primary" onClick={close}>Done</button>
        </div>
      </div>
      <div class="modal-backdrop" onClick={close} />
    </dialog>
  )
}
