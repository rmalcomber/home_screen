// Every launcher tool as a dashboard widget. A tool widget hosts the same provider (and result panel) the launcher
// uses: a text box on top, results below. Input is not stored (it can hold tokens, JSON, curl commands…).
import { useState, useEffect, useRef } from 'preact/hooks'
import '../launcher/providers.js' // registers the providers
import { getProviders } from '../launcher/registry.js'
import { HotkeyScope } from '../launcher/hotkeys.js'

const I = (name) => `iconify:fa6-solid:${name}`
const CALC = 'Calculators & converters'
const SEC = 'Security & encoding'
const DEV = 'Developer tools'

/**
 * kind        widget key is `tool-<kind>`
 * provider    launcher provider id
 * prefix      command word added in front of the text (the launcher recognises it); '' = raw text
 * input       'line' | 'multi' | 'none' (none: the result panel has its own fields)
 * allowEmpty  show results with no text (generators)
 * regenerate  show a "Generate again" button
 */
const TOOLS = [
  { kind: 'calc', label: 'Calculator', category: CALC, icon: I('calculator'), description: 'Maths: (2+3)*4, sqrt(16), 2^10, 7%4.', provider: 'calc', input: 'line', placeholder: 'e.g. (2+3)*4', size: [3, 7] },
  { kind: 'units', label: 'Unit converter', category: CALC, icon: I('ruler-combined'), description: 'Length, weight, volume, time, data, speed, area and temperature.', provider: 'calc', input: 'line', placeholder: 'e.g. 10 km to miles, 100f to c', size: [3, 7] },
  { kind: 'currency', label: 'Currency converter', category: CALC, icon: I('coins'), description: 'Convert between ~150 currencies with central-bank rates.', provider: 'calc', input: 'line', placeholder: 'e.g. 100 usd to gbp', size: [3, 7] },
  { kind: 'timestamp', label: 'Timestamp converter', category: 'Time & weather', icon: I('calendar-day'), description: 'Unix time, ISO dates and offsets, in any time zone.', provider: 'ts', prefix: 'ts', input: 'line', placeholder: 'now, 1700000000, 2026-11-06T12:00Z, +3d', default: 'now', size: [4, 14] },
  { kind: 'cron', label: 'Cron explainer', category: 'Time & weather', icon: I('clock-rotate-left'), description: 'Plain-English description and next run times for a cron expression.', provider: 'cron', prefix: 'cron', input: 'line', placeholder: 'e.g. */15 9-17 * * 1-5', default: '*/15 9-17 * * 1-5', size: [4, 20] },
  { kind: 'markdown', label: 'Markdown previewer', category: 'Notes & tasks', icon: 'iconify:fa6-brands:markdown', description: 'Live Markdown preview; copy as rich text or HTML, or download a page.', provider: 'md', prefix: 'md', input: 'multi', rows: 7, placeholder: 'Type or paste Markdown', size: [6, 18], hint: 'Type or paste Markdown above.' },
  { kind: 'qr', label: 'QR code generator', category: 'Media & design', icon: I('qrcode'), description: 'Turn text, a URL or Wi-Fi details into a QR code; copy or download PNG/SVG.', provider: 'qr', prefix: 'qr', input: 'multi', placeholder: 'Text or URL to encode', size: [4, 18], hint: 'Type or paste text or a URL above (or use the Wi-Fi tab once a code shows).' },
  { kind: 'lorem', label: 'Lorem ipsum', category: 'Media & design', icon: I('align-left'), description: 'Placeholder text by words, sentences or paragraphs.', provider: 'lorem', prefix: 'lorem', input: 'line', allowEmpty: true, regenerate: true, placeholder: 'e.g. 3p, 50, 2 sentences (optional)', size: [4, 10] },
  { kind: 'password', label: 'Password generator', category: SEC, icon: I('lock'), description: 'Strong passwords, PINs and tokens with an entropy estimate. Never stored.', provider: 'password', prefix: 'password', input: 'line', allowEmpty: true, regenerate: true, placeholder: 'length and flags, e.g. 24 nosymbols (optional)', size: [4, 12] },
  { kind: 'hash', label: 'Hash generator', category: SEC, icon: I('hashtag'), description: 'MD5, SHA-1, SHA-256, SHA-384 and SHA-512 of any text.', provider: 'hash', prefix: 'hash', input: 'multi', placeholder: 'Text to hash', size: [4, 10], hint: 'Type some text to hash it.' },
  { kind: 'base64', label: 'Base64', category: SEC, icon: I('file-code'), description: 'Encode text to base64 (standard and URL-safe) or decode it.', provider: 'b64', prefix: 'b64', input: 'multi', placeholder: 'Text to encode, or base64 to decode', size: [4, 10], hint: 'Type text to encode, or paste base64 to decode.' },
  { kind: 'uuid', label: 'UUID generator', category: SEC, icon: I('fingerprint'), description: 'v4 and v7 UUIDs; paste one to inspect it.', provider: 'uuid', prefix: 'uuid', input: 'line', allowEmpty: true, regenerate: true, placeholder: 'a count, or a UUID to inspect (optional)', size: [4, 10] },
  { kind: 'jwt', label: 'JWT decoder', category: SEC, icon: I('key'), description: 'Decode a token: claims, times and expiry. Nothing is verified or stored.', provider: 'jwt', input: 'multi', placeholder: 'Paste a JWT (optionally "Bearer …")', size: [5, 16], hint: 'Paste a JWT above.' },
  { kind: 'curl', label: 'Curl runner', category: DEV, icon: I('terminal'), description: 'Paste a curl command to see its parts, then run it.', provider: 'curl', input: 'multi', placeholder: 'Paste a curl command', size: [5, 18], hint: 'Paste a curl command above.' },
  { kind: 'json', label: 'JSON formatter', category: DEV, icon: I('code'), description: 'Pretty-print, minify and sort JSON; fixes comments and trailing commas.', provider: 'json', input: 'multi', placeholder: 'Paste JSON', size: [5, 16], hint: 'Paste JSON above.' },
  { kind: 'regex', label: 'Regex tester', category: DEV, icon: I('asterisk'), description: 'Live matches, groups and replace preview.', provider: 'regex', prefix: 'regex', input: 'none', size: [5, 20] },
  { kind: 'diff', label: 'Text diff', category: DEV, icon: I('code-compare'), description: 'Compare two texts line by line, with word-level highlights.', provider: 'diff', prefix: 'diff', input: 'none', size: [7, 20] },
  { kind: 'csv', label: 'CSV ⇄ JSON', category: DEV, icon: I('table'), description: 'Convert spreadsheet data to JSON and back.', provider: 'csv', prefix: 'csv', input: 'multi', placeholder: 'Paste CSV, TSV or JSON', size: [5, 18], hint: 'Paste CSV, TSV or JSON above.' },
]

/** The launcher text for a given widget input, or null when there is nothing to run yet. */
export function buildQuery(def, text) {
  const t = text.trim()
  if (def.prefix) return t ? `${def.prefix} ${text}` : def.input === 'none' || def.allowEmpty ? def.prefix : null
  return t ? text : null
}

function ToolHost({ def }) {
  const root = useRef()
  const [text, setText] = useState(def.default || '')
  const [items, setItems] = useState([])
  const [nonce, setNonce] = useState(0)
  const [flash, setFlash] = useState('')
  const q = buildQuery(def, text)

  useEffect(() => {
    if (q === null) { setItems([]); return }
    let dead = false
    const t = setTimeout(async () => {
      const provider = getProviders().find((p) => p.id === def.provider)
      try {
        const out = await provider.items(q, {})
        if (!dead) setItems(out || [])
      } catch {
        if (!dead) setItems([])
      }
    }, 150)
    return () => { dead = true; clearTimeout(t) }
  }, [q, nonce])

  const panelItem = items.find((i) => i.panel)
  const Panel = panelItem?.panel
  const run = async (it) => {
    try { await it.run({ newTab: true }) } catch {}
    setFlash(it.key)
    setTimeout(() => setFlash((k) => (k === it.key ? '' : k)), 1200)
  }

  return (
    <HotkeyScope.Provider value={root}>
      <div ref={root} class="tool-host grid grid-cols-[minmax(0,1fr)] gap-2">
        {def.input !== 'none' && (
          <div class="flex gap-1 items-start min-w-0">
            {def.input === 'multi' ? (
              <textarea class="textarea textarea-bordered textarea-sm font-mono w-full leading-snug" rows={def.rows || 3} placeholder={def.placeholder} value={text} onInput={(e) => setText(e.target.value)} spellcheck={false} />
            ) : (
              <input class="input input-sm input-bordered w-full min-w-0 flex-1" placeholder={def.placeholder} value={text} onInput={(e) => setText(e.target.value)} spellcheck={false} autocomplete="off" />
            )}
            {def.regenerate && <button class="btn btn-sm btn-ghost shrink-0" title="Generate again" onClick={() => setNonce((n) => n + 1)}>↻</button>}
          </div>
        )}
        {Panel ? (
          <Panel key={panelItem.key} item={panelItem} input={q} />
        ) : q === null ? (
          <p class="text-sm opacity-60 px-1">{def.hint || def.description}</p>
        ) : items.length === 0 ? (
          <p class="text-sm opacity-60 px-1">Nothing recognised yet. {def.placeholder ? `Try: ${def.placeholder.replace(/^e\.g\. /, '')}` : ''}</p>
        ) : (
          <ul class="grid grid-cols-[minmax(0,1fr)] gap-0.5">
            {items.map((it) => (
              <li key={it.key}>
                <button type="button" class="w-full flex items-start gap-2 px-2 py-1 rounded text-left hover:bg-base-300" onClick={() => run(it)} title="Click to copy">
                  <span class="min-w-0 flex-1">
                    <span class={`block text-sm break-all line-clamp-3 ${it.mono || def.provider !== 'calc' ? 'font-mono' : 'font-semibold'}`}>{it.title}</span>
                    {it.subtitle && <span class="block text-xs opacity-60 truncate">{it.subtitle.replace(/\s*·\s*Enter to copy$/, '')}</span>}
                  </span>
                  <span class="text-xs opacity-60 shrink-0 mt-0.5">{flash === it.key ? 'Copied ✓' : 'Copy'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </HotkeyScope.Provider>
  )
}

function makeTool(def) {
  return {
    label: def.label,
    category: def.category,
    icon: def.icon,
    description: def.description,
    size: def.size,
    tool: true,
    defaults: { kind: `tool-${def.kind}` },
    Body: () => <ToolHost def={def} />,
    Options: () => (
      <p class="text-sm opacity-60">
        {def.description} Use the text box inside the tile{def.input === 'none' ? ' (this tool has its own fields)' : ''}.
        {def.input !== 'none' && ' What you type is not saved.'}
      </p>
    ),
  }
}

export const TOOL_WIDGETS = Object.fromEntries(TOOLS.map((d) => [`tool-${d.kind}`, makeTool(d)]))
