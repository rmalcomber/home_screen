import { useState, useMemo, useRef, useEffect } from 'preact/hooks'
import { useHotkeyScope, parseColor, remember, shortHash } from '../../core/extensions/host.js'
import { ECC_LEVELS, buildMatrix, svgPath, toSvg, drawCanvas, wifiString, byteLength } from './engine.js'

const PK = 'launcher.qrPrefs'
const DEFAULTS = { ecc: 'M', px: 512, margin: 4, fg: '#000000', bg: '#ffffff' }
const loadPrefs = () => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PK) || '{}') } } catch { return { ...DEFAULTS } }
}
const avg = (hex) => { const c = parseColor(hex); return c ? (c.r + c.g + c.b) / 3 : 0 }

export function QrPanel({ item }) {
  const text = item.data.text
  const [mode, setMode] = useState('text')
  const [p, setP] = useState(loadPrefs)
  const [wifi, setWifi] = useState({ ssid: '', password: '', security: 'WPA', hidden: false })
  const [note, setNote] = useState('')
  const canvas = useRef()
  const onKeydown = useHotkeyScope()
  const setPref = (patch) => setP((x) => {
    const n = { ...x, ...patch }
    try { localStorage.setItem(PK, JSON.stringify(n)) } catch {}
    return n
  })

  const payload = mode === 'wifi' ? wifiString(wifi) : text
  const built = useMemo(() => {
    if (!payload) return { error: mode === 'wifi' ? 'Enter the network name to make a Wi-Fi code.' : 'Type or paste some text or a URL to encode.' }
    try { return { m: buildMatrix(payload, p.ecc) } } catch (e) { return { error: e.message } }
  }, [payload, p.ecc])
  const m = built.m

  const flash = (msg) => { setNote(msg); setTimeout(() => setNote(''), 1800) }
  // A Wi-Fi payload contains the password, so only plain text/URL codes are added to Recent.
  const record = () => { if (mode === 'text' && text.length <= 2000) remember('qr', { key: `qr:${shortHash(text)}`, title: `QR · ${text.length > 50 ? text.slice(0, 50) + '…' : text}`.replace(/\s+/g, ' '), subtitle: `error correction ${p.ecc}`, fill: `qr ${text}` }) }

  const pngBlob = () => new Promise((resolve) => { drawCanvas(canvas.current, m, p); canvas.current.toBlob(resolve, 'image/png') })
  const copyPng = async () => {
    if (!m) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob() })])
      flash('PNG copied ✓')
      record()
    } catch { flash('Could not copy the image: use Download PNG') }
  }
  const copySvg = async () => {
    if (!m) return
    try { await navigator.clipboard.writeText(toSvg(m, p)); flash('SVG copied ✓'); record() } catch {}
  }
  const save = (blob, name) => {
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: name }).click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    record()
  }
  const downloadPng = async () => m && save(await pngBlob(), 'qrcode.png')
  const downloadSvg = () => m && save(new Blob([toSvg(m, p)], { type: 'image/svg+xml' }), 'qrcode.svg')

  useEffect(() => onKeydown((e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); copyPng() } }))

  const total = m ? m.n + p.margin * 2 : 0
  return (
    <div class="p-3 grid gap-3 max-h-[70vh] overflow-auto">
      <canvas ref={canvas} class="hidden" />
      <div class="flex flex-wrap items-center gap-2">
        <div role="tablist" class="tabs tabs-box tabs-xs">
          <button role="tab" class={`tab ${mode === 'text' ? 'tab-active' : ''}`} onClick={() => setMode('text')}>Text / URL</button>
          <button role="tab" class={`tab ${mode === 'wifi' ? 'tab-active' : ''}`} onClick={() => setMode('wifi')}>Wi-Fi</button>
        </div>
        {m && <span class="text-xs opacity-60">version {m.version} · {m.n}×{m.n} modules · {byteLength(payload)} bytes</span>}
        {note && <span class="text-xs text-success ml-auto">{note}</span>}
      </div>

      {mode === 'wifi' && (
        <div class="grid gap-2 sm:grid-cols-2">
          <input class="input input-sm input-bordered" placeholder="Network name (SSID)" value={wifi.ssid} onInput={(e) => setWifi((w) => ({ ...w, ssid: e.target.value }))} />
          <input class="input input-sm input-bordered" placeholder="Password" disabled={wifi.security === 'nopass'} value={wifi.password} onInput={(e) => setWifi((w) => ({ ...w, password: e.target.value }))} />
          <select class="select select-sm select-bordered" value={wifi.security} onChange={(e) => setWifi((w) => ({ ...w, security: e.target.value }))}>
            <option value="WPA">WPA / WPA2 / WPA3</option>
            <option value="WEP">WEP</option>
            <option value="nopass">No password</option>
          </select>
          <label class="label cursor-pointer justify-start gap-2"><input type="checkbox" class="checkbox checkbox-sm" checked={wifi.hidden} onChange={(e) => setWifi((w) => ({ ...w, hidden: e.target.checked }))} /><span class="label-text text-sm">Hidden network</span></label>
          <p class="text-xs opacity-60 sm:col-span-2">Scanning the code with a phone camera offers to join the network. The password is in the code, so share it as carefully as the password itself. Wi-Fi codes are never added to Recent.</p>
        </div>
      )}

      {built.error && <div role="alert" class="alert alert-warning py-1 text-sm">{built.error}</div>}

      {m && (
        <div class="flex flex-wrap gap-4 items-start">
          <svg viewBox={`0 0 ${total} ${total}`} class="w-56 h-56 rounded shrink-0 border border-base-300" shape-rendering="crispEdges" role="img" aria-label="QR code preview">
            <rect width={total} height={total} fill={p.bg} />
            <path d={svgPath(m, p.margin)} fill={p.fg} />
          </svg>
          <div class="grid gap-2 min-w-48 flex-1">
            <div class="grid grid-cols-2 gap-2">
              <label class="grid gap-1 text-xs">Error correction
                <select class="select select-xs select-bordered" value={p.ecc} onChange={(e) => setPref({ ecc: e.target.value })}>
                  {ECC_LEVELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label class="grid gap-1 text-xs">PNG size
                <select class="select select-xs select-bordered" value={p.px} onChange={(e) => setPref({ px: +e.target.value })}>
                  {[256, 512, 1024, 2048].map((s) => <option key={s} value={s}>{s} px</option>)}
                </select>
              </label>
              <label class="grid gap-1 text-xs">Quiet zone
                <select class="select select-xs select-bordered" value={p.margin} onChange={(e) => setPref({ margin: +e.target.value })}>
                  {[0, 1, 2, 4, 6, 8].map((s) => <option key={s} value={s}>{s} module{s === 1 ? '' : 's'}</option>)}
                </select>
              </label>
              <div class="grid gap-1 text-xs">Colours
                <div class="flex items-center gap-1">
                  <input type="color" class="w-8 h-6 rounded bg-transparent cursor-pointer" value={p.fg} title="Code colour" onInput={(e) => setPref({ fg: e.target.value })} />
                  <span class="opacity-60">on</span>
                  <input type="color" class="w-8 h-6 rounded bg-transparent cursor-pointer" value={p.bg} title="Background colour" onInput={(e) => setPref({ bg: e.target.value })} />
                  <button class="btn btn-xs btn-ghost" onClick={() => setPref({ fg: DEFAULTS.fg, bg: DEFAULTS.bg })}>Reset</button>
                </div>
              </div>
            </div>
            {avg(p.fg) > avg(p.bg) && <div class="text-xs text-warning">Light-on-dark codes don't scan with every reader; dark on light is safest.</div>}
            <div class="flex flex-wrap gap-1">
              <button class="btn btn-primary btn-sm" onClick={copyPng}>Copy PNG <kbd class="kbd kbd-xs text-base-content">Ctrl ⏎</kbd></button>
              <button class="btn btn-sm" onClick={copySvg}>Copy SVG</button>
              <button class="btn btn-sm btn-ghost" onClick={downloadPng}>Download PNG</button>
              <button class="btn btn-sm btn-ghost" onClick={downloadSvg}>Download SVG</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
