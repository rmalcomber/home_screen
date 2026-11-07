import { useState, useEffect, useMemo, useRef } from 'preact/hooks'
import { useHotkeyScope } from '../core/launcher/hotkeys.js'
import { FLAGS, createRunner, segments, toLiteral } from './regex.js'
import { remember } from '../core/launcher/history.js'

const MAX = 500
const SHOWN = 100
const vis = (s) => s.replace(/\n/g, '↵').replace(/\t/g, '→').replace(/ /g, '·')
const MARK = ['bg-primary/30', 'bg-secondary/30']

export function RegexPanel({ item }) {
  const init = item.data
  const [pattern, setPattern] = useState(init.pattern)
  const [flags, setFlags] = useState(init.flags)
  const [text, setText] = useState(init.text)
  const [repl, setRepl] = useState('')
  const [showRepl, setShowRepl] = useState(false)
  const [res, setRes] = useState(null)
  const [copied, setCopied] = useState('')
  const runner = useRef(createRunner())
  const patternEl = useRef()

  useEffect(() => { patternEl.current?.focus() }, [])

  // Debounced run in a worker (stale results are dropped, slow patterns time out).
  useEffect(() => {
    if (!pattern) { setRes(null); return }
    const t = setTimeout(async () => {
      const r = await runner.current({ pattern, flags, text: text.slice(0, 200000), replacement: showRepl ? repl : null, max: MAX })
      if (r) setRes(r)
    }, 150)
    return () => clearTimeout(t)
  }, [pattern, flags, text, repl, showRepl])

  const literal = `/${toLiteral(pattern)}/${flags}`
  const copy = async (what, value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(what)
      setTimeout(() => setCopied(''), 1500)
      if (pattern) remember('regex', { key: `regex:${literal}`, title: literal, subtitle: text ? vis(text).slice(0, 60) : 'regex', fill: `re ${literal} ${text}` })
    } catch {}
  }

  const onKeydown = useHotkeyScope()
  useEffect(() => {
    const h = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && pattern) { e.preventDefault(); copy('regex', literal) } }
    return onKeydown(h)
  })

  const toggle = (f) => setFlags((x) => (x.includes(f) ? x.replace(f, '') : x + f))
  const matches = res?.matches || []
  const segs = useMemo(() => (res?.matches ? segments(text, res.matches) : null), [res, text])

  return (
    <div class="p-3 grid gap-3 max-h-[68vh] overflow-auto">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-mono text-lg opacity-60">/</span>
        <input
          ref={patternEl}
          class="input input-sm input-bordered font-mono flex-1 min-w-48"
          placeholder="pattern, e.g. (\d+)-(?<word>\w+)"
          value={pattern}
          onInput={(e) => setPattern(e.target.value)}
          spellcheck={false}
          autocomplete="off"
        />
        <span class="font-mono text-lg opacity-60">/</span>
        <div class="join">
          {FLAGS.map(([f, tip]) => (
            <button key={f} type="button" title={tip} class={`btn btn-xs join-item font-mono ${flags.includes(f) ? 'btn-primary' : 'btn-ghost'}`} onClick={() => toggle(f)}>{f}</button>
          ))}
        </div>
        <button class="btn btn-sm btn-primary" disabled={!pattern} onClick={() => copy('regex', literal)}>
          {copied === 'regex' ? 'Copied ✓' : 'Copy'} <kbd class="kbd kbd-xs text-base-content">Ctrl ⏎</kbd>
        </button>
      </div>

      {res?.error && <div role="alert" class="alert alert-error py-1 text-sm break-all">{res.error}</div>}
      {res?.timeout && <div role="alert" class="alert alert-warning py-1 text-sm">Timed out after 1.5 s: this pattern is probably backtracking catastrophically.</div>}

      <label class="grid gap-1">
        <span class="text-xs font-semibold uppercase tracking-wide opacity-70">Test text</span>
        <textarea class="textarea textarea-bordered textarea-sm font-mono w-full" rows={4} placeholder="Paste text to test against…" value={text} onInput={(e) => setText(e.target.value)} spellcheck={false} />
      </label>

      {res?.matches && (
        <>
          <div class="flex items-center gap-2 text-sm">
            <span class={`badge ${matches.length ? 'badge-success' : 'badge-ghost'}`}>{matches.length}{res.truncated ? '+' : ''} match{matches.length === 1 ? '' : 'es'}</span>
            {res.truncated && <span class="text-xs opacity-60">showing the first {MAX}</span>}
          </div>

          {text && (
            <pre class="bg-base-200 rounded p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-48 overflow-auto">
              {segs.map((s, i) => (s.match === null ? s.text : <mark key={i} class={`${MARK[s.match % 2]} text-inherit rounded-sm`} title={`Match ${s.match + 1}`}>{s.text}</mark>))}
            </pre>
          )}

          {matches.length > 0 && (
            <table class="table table-xs">
              <thead><tr><th>#</th><th>At</th><th>Match</th><th>Groups</th></tr></thead>
              <tbody>
                {matches.slice(0, SHOWN).map((m, i) => (
                  <tr key={i} class="hover">
                    <td class="opacity-60">{i + 1}</td>
                    <td class="font-mono opacity-60">{m.index}</td>
                    <td class="font-mono break-all">{m.text ? vis(m.text) : <i class="opacity-50">(empty)</i>}</td>
                    <td class="font-mono text-xs break-all">
                      {m.groups.map((g, k) => <div key={k}><span class="opacity-50">${k + 1}</span> {g === undefined ? <i class="opacity-50">undefined</i> : vis(g)}</div>)}
                      {m.named && Object.entries(m.named).map(([k, v]) => <div key={k}><span class="opacity-50">&lt;{k}&gt;</span> {v === undefined ? <i class="opacity-50">undefined</i> : vis(v)}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {matches.length > SHOWN && <div class="text-xs opacity-60">…and {matches.length - SHOWN} more</div>}
        </>
      )}

      <div class="grid gap-1">
        <label class="label cursor-pointer justify-start gap-2 p-0"><input type="checkbox" class="checkbox checkbox-xs" checked={showRepl} onChange={(e) => setShowRepl(e.target.checked)} /><span class="label-text text-xs font-semibold uppercase tracking-wide opacity-70">Replace</span></label>
        {showRepl && (
          <>
            <input class="input input-sm input-bordered font-mono w-full" placeholder="replacement, e.g. $2-$1 or $<word>" value={repl} onInput={(e) => setRepl(e.target.value)} spellcheck={false} />
            {res?.replaced != null && (
              <div class="grid gap-1">
                <pre class="bg-base-200 rounded p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-40 overflow-auto">{res.replaced}</pre>
                <button class="btn btn-xs btn-ghost self-start" onClick={() => copy('replaced', res.replaced)}>{copied === 'replaced' ? 'Copied ✓' : 'Copy result'}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
