import { useState, useEffect, useMemo } from 'preact/hooks'
import { useHotkeyScope, highlight, parseJson, remember, shortHash } from '../../core/extensions/host.js'
import { csvToJson, jsonToCsv, csvFill } from './engine.js'

const PK = 'launcher.csvPrefs'
const DEFAULTS = { delimiter: 'auto', header: true, infer: true, emptyNull: true, trim: true, shape: 'objects', outFmt: 'pretty', indent: 2, csvDelim: ',', flatten: true, quoteAll: false }
const loadPrefs = () => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PK) || '{}') } } catch { return { ...DEFAULTS } }
}
const DELIM_NAME = { ',': 'comma', '\t': 'tab', ';': 'semicolon', '|': 'pipe' }
const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)
const HIGHLIGHT_LIMIT = 200_000

const Check = ({ label, checked, onChange }) => (
  <label class="label cursor-pointer gap-1 p-0"><input type="checkbox" class="checkbox checkbox-xs" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span class="label-text text-xs">{label}</span></label>
)
const Select = ({ value, onChange, options, width = 'w-32' }) => (
  <select class={`select select-xs select-bordered ${width}`} value={String(value)} onChange={(e) => onChange(e.target.value)}>
    {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select>
)

export function CsvPanel({ item, setInput }) {
  const text = item.data.text
  const jsonLike = useMemo(() => /^\s*[[{]/.test(text) && parseJson(text).ok, [text])
  const [mode, setMode] = useState(jsonLike ? 'json2csv' : 'csv2json')
  const [p, setP] = useState(loadPrefs)
  const [copied, setCopied] = useState(false)
  const set = (patch) => setP((x) => {
    const n = { ...x, ...patch }
    try { localStorage.setItem(PK, JSON.stringify(n)) } catch {}
    return n
  })

  const result = useMemo(() => {
    if (!text.trim()) return { error: 'Paste CSV or TSV (or a JSON array) into the box above.' }
    return mode === 'csv2json' ? csvToJson(text, p) : jsonToCsv(text, { delimiter: p.csvDelim, quoteAll: p.quoteAll, includeHeader: p.header, flatten: p.flatten })
  }, [text, mode, p])

  const out = result.output || ''
  const copy = async () => {
    if (!out) return
    try {
      await navigator.clipboard.writeText(out)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      if (text.length <= 40000) {
        const label = mode === 'csv2json' ? 'CSV → JSON' : 'JSON → CSV'
        remember('csv', { key: `csv:${shortHash(text)}`, title: `${label} · ${result.count} row${result.count === 1 ? '' : 's'}`, subtitle: (result.columns || []).slice(0, 6).join(', '), fill: csvFill(text) })
      }
    } catch {}
  }
  const download = () => {
    const ext = result.json ? (p.outFmt === 'lines' ? 'jsonl' : 'json') : 'csv'
    const url = URL.createObjectURL(new Blob([out], { type: result.json ? 'application/json' : 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `data.${ext}` })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const onKeydown = useHotkeyScope()
  useEffect(() => {
    const h = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); copy() } }
    return onKeydown(h)
  })

  const tokens = useMemo(() => (result.json && out.length <= HIGHLIGHT_LIMIT ? highlight(out) : null), [result, out])

  return (
    <div class="p-3 grid gap-3 max-h-[70vh] overflow-auto">
      <div class="flex flex-wrap items-center gap-2">
        <div role="tablist" class="tabs tabs-box tabs-xs">
          <button role="tab" class={`tab ${mode === 'csv2json' ? 'tab-active' : ''}`} onClick={() => setMode('csv2json')}>CSV → JSON</button>
          <button role="tab" class={`tab ${mode === 'json2csv' ? 'tab-active' : ''}`} onClick={() => setMode('json2csv')}>JSON → CSV</button>
        </div>
        {mode === 'json2csv' && jsonLike && setInput && <button class="btn btn-xs btn-ghost" onClick={() => setInput?.(text)}>Open in JSON formatter</button>}
        <div class="ml-auto flex gap-1">
          <button class="btn btn-xs btn-ghost" disabled={!out} onClick={download}>Download</button>
          <button class="btn btn-primary btn-sm" disabled={!out} onClick={copy}>{copied ? 'Copied ✓' : 'Copy'} <kbd class="kbd kbd-xs text-base-content">Ctrl ⏎</kbd></button>
        </div>
      </div>

      {mode === 'csv2json' ? (
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Select value={p.delimiter} onChange={(v) => set({ delimiter: v })} options={[['auto', `Auto${result.delimiter ? ` (${DELIM_NAME[result.delimiter]})` : ''}`], [',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab'], ['|', 'Pipe']]} />
          <Check label="First row is a header" checked={p.header} onChange={(v) => set({ header: v })} />
          <Check label="Detect numbers and booleans" checked={p.infer} onChange={(v) => set({ infer: v })} />
          <Check label="Empty cells as null" checked={p.emptyNull} onChange={(v) => set({ emptyNull: v })} />
          <Check label="Trim spaces" checked={p.trim} onChange={(v) => set({ trim: v })} />
          <Select value={p.shape} onChange={(v) => set({ shape: v })} width="w-40" options={[['objects', 'Array of objects'], ['arrays', 'Array of arrays'], ['keyed', 'Keyed by first column']]} />
          <Select value={p.outFmt} onChange={(v) => set({ outFmt: v })} options={[['pretty', 'Pretty'], ['min', 'Minified'], ['lines', 'JSON Lines']]} />
          {p.outFmt === 'pretty' && <Select value={p.indent} onChange={(v) => set({ indent: v === 'tab' ? 'tab' : +v })} width="w-24" options={[['2', '2 spaces'], ['4', '4 spaces'], ['tab', 'Tabs']]} />}
        </div>
      ) : (
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Select value={p.csvDelim} onChange={(v) => set({ csvDelim: v })} options={[[',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab'], ['|', 'Pipe']]} />
          <Check label="Header row" checked={p.header} onChange={(v) => set({ header: v })} />
          <Check label="Flatten nested objects (a.b)" checked={p.flatten} onChange={(v) => set({ flatten: v })} />
          <Check label="Quote every field" checked={p.quoteAll} onChange={(v) => set({ quoteAll: v })} />
        </div>
      )}

      {result.error && <div role="alert" class="alert alert-warning py-1 text-sm">{result.error}</div>}
      {(result.warnings || []).map((w) => <div key={w} role="alert" class="alert alert-info py-1 text-sm">{w}</div>)}

      {out && (
        <>
          <div class="text-xs opacity-70">
            {result.count} {mode === 'csv2json' && p.shape === 'keyed' ? 'key' : 'row'}{result.count === 1 ? '' : 's'} · {(result.columns || []).length || result.cols || 0} column{((result.columns || []).length || result.cols || 0) === 1 ? '' : 's'}
            {result.delimiter ? ` · ${DELIM_NAME[result.delimiter]}-separated` : ''} · {fmtSize(new TextEncoder().encode(out).length)} output
          </div>

          {mode === 'csv2json' && result.preview && (
            <details>
              <summary class="cursor-pointer text-xs font-semibold uppercase tracking-wide opacity-70 select-none">How the CSV was read</summary>
              <div class="overflow-auto mt-1 max-h-40">
                <table class="table table-xs">
                  <tbody>
                    {result.preview.map((r, i) => (
                      <tr key={i} class={i === 0 && p.header ? 'font-semibold bg-base-200' : ''}>
                        {r.map((c, k) => <td key={k} class="font-mono whitespace-pre-wrap break-all max-w-48">{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <pre class="bg-base-200 rounded p-2 text-xs font-mono max-h-[40vh] overflow-auto whitespace-pre">
            {tokens ? tokens.map((t, i) => (t.cls ? <span key={i} class={t.cls}>{t.text}</span> : t.text)) : out}
          </pre>
        </>
      )}
    </div>
  )
}
