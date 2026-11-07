import { useState, useEffect, useMemo } from 'preact/hooks'
import { useHotkeyScope, remember, shortHash, CopyButton, copyText } from '../../core/extensions/host.js'
import { convert, FORMATS, FORMAT_NAME, yamlFill } from './engine.js'

// The last choice of source and target, kept while the launcher box changes (the panel is rebuilt on every keystroke).
let sticky = { word: '', from: null, to: null }

const Tabs = ({ label, value, onChange, options }) => (
  <div class="flex items-center gap-1.5">
    <span class="text-xs opacity-60">{label}</span>
    <div role="tablist" class="tabs tabs-box tabs-xs">
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" role="tab" class={`tab ${value === v ? 'tab-active' : ''}`} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  </div>
)

/** Converts between JSON, YAML and TOML: pick the source and the target, then copy. */
export function YamlPanel({ item }) {
  const { word, text, from: fromWord, to: toWord } = item.data
  const keep = sticky.word === word
  const [from, setFrom] = useState(fromWord || (keep && sticky.from) || 'auto')
  const [to, setTo] = useState(toWord || (keep ? sticky.to : null))
  const choose = (f, t) => {
    sticky = { word, from: f, to: t }
    setFrom(f)
    setTo(t)
  }
  const result = useMemo(() => convert(text, { from, to, word }), [text, from, to, word])
  const out = result.ok ? result.output : ''
  const lines = out ? out.split('\n').length - (out.endsWith('\n') ? 1 : 0) : 0

  const remembered = () => {
    if (text.length > 40000) return
    remember('yaml', { key: `yaml:${shortHash(text)}`, title: `${FORMAT_NAME[result.format]} → ${FORMAT_NAME[result.to]} · ${lines} line${lines === 1 ? '' : 's'}`, subtitle: text.replace(/\s+/g, ' ').slice(0, 60), fill: yamlFill(word, text) })
  }
  const onKeydown = useHotkeyScope()
  useEffect(() => {
    const h = async (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && out) {
        e.preventDefault()
        if (await copyText(out)) remembered()
      }
    }
    return onKeydown(h)
  })

  return (
    <div class="p-3 grid gap-3 max-h-[70vh] overflow-auto">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Tabs label="From" value={from} onChange={(v) => choose(v, to)} options={[['auto', 'Auto'], ...FORMATS.map((f) => [f, FORMAT_NAME[f]])]} />
        <Tabs label="To" value={to} onChange={(v) => choose(from, v)} options={[[null, 'Auto'], ...FORMATS.map((f) => [f, FORMAT_NAME[f]])]} />
        {result.ok && from === 'auto' && <span class="badge badge-ghost badge-sm">Read as {FORMAT_NAME[result.format]}</span>}
        <div class="ml-auto flex items-center gap-2">
          {result.ok && <span class="text-xs opacity-60">{lines} line{lines === 1 ? '' : 's'}</span>}
          <CopyButton text={out} label="Copy" class="btn btn-primary btn-sm" disabled={!out} onCopied={remembered} />
          <kbd class="kbd kbd-xs">Ctrl ⏎</kbd>
        </div>
      </div>

      {result.ok ? (
        <>
          {result.warnings.map((w) => <p key={w} class="text-xs text-warning">{w}</p>)}
          <pre class="rounded bg-base-300/60 p-2 text-xs font-mono overflow-auto max-h-[45vh] whitespace-pre">{out || '(empty)'}</pre>
        </>
      ) : (
        <p class="text-sm text-error whitespace-pre-wrap">{result.error}</p>
      )}
    </div>
  )
}
