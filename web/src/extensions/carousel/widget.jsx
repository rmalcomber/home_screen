import { useState, useEffect, useRef } from 'preact/hooks'
import { patchConfig, Field } from '../../core/extensions/host.js'

const carousel = {
  Body({ tile }) {
    const c = tile.config
    const imgs = c.images || []
    const [i, setI] = useState(0)
    const [hover, setHover] = useState(false)
    const n = imgs.length
    const idx = n ? i % n : 0

    useEffect(() => {
      if (n < 2 || hover || !c.seconds) return
      const id = setInterval(() => setI((x) => x + 1), c.seconds * 1000)
      return () => clearInterval(id)
    }, [n, hover, c.seconds])

    if (!n) return <p class="text-sm opacity-60 p-2">Edit this tile to add images (upload or paste URLs).</p>
    const go = (d) => setI((x) => (x + d + n * 1000) % n)
    return (
      <div class="relative h-full w-full group" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <img key={imgs[idx]} src={imgs[idx]} alt="" class={`absolute inset-0 w-full h-full rounded-box ${c.fit === 'contain' ? 'object-contain' : 'object-cover'}`} />
        {n > 1 && (
          <>
            <button class="btn btn-circle btn-sm absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-80" onClick={() => go(-1)}>‹</button>
            <button class="btn btn-circle btn-sm absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-80" onClick={() => go(1)}>›</button>
            <div class="absolute bottom-1 inset-x-0 flex justify-center gap-1">
              {imgs.map((_, k) => <button key={k} aria-label={`Image ${k + 1}`} class={`w-2 h-2 rounded-full ${k === idx ? 'bg-primary' : 'bg-base-content/40'}`} onClick={() => setI(k)} />)}
            </div>
          </>
        )}
      </div>
    )
  },
  Options({ config, set }) {
    const imgs = config.images || []
    const [err, setErr] = useState('')
    const upload = async (e) => {
      const out = []
      for (const f of e.target.files) {
        try {
          const r = await fetch(`/api/images?name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { 'Content-Type': f.type }, body: f })
          if (!r.ok) throw new Error()
          out.push((await r.json()).src)
        } catch {
          setErr(`Couldn't upload ${f.name} (PNG, JPEG, GIF, WebP or AVIF only)`)
        }
      }
      if (out.length) set({ images: [...imgs, ...out] })
      e.target.value = ''
    }
    const remove = (k) => {
      const src = imgs[k]
      if (src.startsWith('/api/images/')) fetch(src, { method: 'DELETE' }).catch(() => {})
      set({ images: imgs.filter((_, j) => j !== k) })
    }
    return (
      <div class="grid gap-2">
        <div class="flex flex-wrap gap-2">
          {imgs.map((src, k) => (
            <div key={k} class="relative w-16 h-16">
              <img src={src} class="w-full h-full object-cover rounded" alt="" />
              <button type="button" class="btn btn-circle btn-xs absolute -top-1 -right-1" onClick={() => remove(k)}>✕</button>
            </div>
          ))}
        </div>
        <label class="btn btn-sm btn-outline self-start">Upload images<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" multiple class="hidden" onChange={upload} /></label>
        <Field label="Or add image URLs (one per line)">
          <textarea class="textarea textarea-bordered textarea-sm w-full" rows="3" placeholder="https://…/photo.jpg" onChange={(e) => {
            const urls = e.target.value.split(/\s+/).filter((u) => /^https?:\/\//i.test(u))
            if (urls.length) { set({ images: [...imgs, ...urls] }); e.target.value = '' }
          }} />
        </Field>
        <div class="grid grid-cols-2 gap-2">
          <Num label="Seconds per image (0 = manual)" min={0} max={600} value={config.seconds ?? 6} onChange={(v) => set({ seconds: v })} />
          <Field label="Fit">
            <select class="select select-sm select-bordered" value={config.fit || 'cover'} onChange={(e) => set({ fit: e.target.value })}>
              <option value="cover">Fill (crop)</option>
              <option value="contain">Fit (whole image)</option>
            </select>
          </Field>
        </div>
        {err && <p class="text-xs text-error">{err}</p>}
      </div>
    )
  },
}

export default carousel
