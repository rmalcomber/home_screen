import { useState, useEffect, useMemo } from 'preact/hooks'
import { useHotkeyScope, remember, relativeTime } from '../../core/extensions/host.js'
import { parseCron, describe, nextRuns, fieldMeaning, FIELD_LABELS } from './engine.js'

const DIALECTS = [
  ['seconds', 'Seconds first · Spring', 'Day of week 0–7, where 0 and 7 are Sunday'],
  ['quartz6', 'Seconds first · Quartz', 'Day of week 1–7, where 1 is Sunday'],
  ['aws', 'Year last · AWS', 'Day of week 1–7, where 1 is Sunday'],
]
const DIALECT_LABEL = { standard: 'Standard 5-field', seconds: 'Seconds first (Spring)', quartz6: 'Seconds first (Quartz)', aws: 'Year last (AWS EventBridge)', quartz: 'Quartz 7-field' }

const EXAMPLES = [
  ['*/15 9-17 * * 1-5', 'every 15 minutes during office hours'],
  ['0 0 1 * *', 'midnight on the 1st of every month'],
  ['0 0 12 ? * MON-FRI', 'Quartz style, noon on weekdays'],
  ['@daily', 'macros work too'],
]

export function CronPanel({ item }) {
  const expr = item.data.expr
  const [dialect, setDialect] = useState('seconds')
  const [utc, setUtc] = useState(false)
  const [count, setCount] = useState(10)
  const [copied, setCopied] = useState('')
  const parsed = useMemo(() => parseCron(expr, dialect), [expr, dialect])
  const text = parsed.ok ? describe(parsed) : ''
  const runs = useMemo(() => (parsed.ok ? nextRuns(parsed, Date.now(), count, { utc }) : []), [parsed, count, utc])
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const copy = async (what, value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(what)
      setTimeout(() => setCopied(''), 1500)
      if (parsed.ok) remember('cron', { key: `cron:${expr}`, title: `cron ${expr}`, subtitle: text, fill: `cron ${expr}` })
    } catch {}
  }
  const runsText = () => runs.map((t) => new Date(t).toISOString()).join('\n')

  const onKeydown = useHotkeyScope()
  useEffect(() => {
    const h = (e) => { if (e.key === 'Enter' && !e.isComposing && !e.target.closest?.('input,button,select') && text) { e.preventDefault(); copy('description', text) } }
    return onKeydown(h)
  })

  const fmt = useMemo(
    () => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: parsed.ok && parsed.hasSeconds ? '2-digit' : undefined, hour12: false, timeZone: utc ? 'UTC' : undefined }),
    [parsed, utc],
  )

  if (!expr) {
    return (
      <div class="p-4 grid gap-2 text-sm">
        <div>Type a cron expression after <code class="font-mono">cron</code>, or just paste one. For example:</div>
        <ul class="grid gap-1">
          {EXAMPLES.map(([e, d]) => <li key={e}><code class="font-mono bg-base-200 rounded px-1">cron {e}</code> <span class="opacity-70">{d}</span></li>)}
        </ul>
      </div>
    )
  }

  if (!parsed.ok) {
    return (
      <div class="p-3 grid gap-2">
        {parsed.errors.map((e, i) => (
          <div key={i} role="alert" class="alert alert-error py-1 text-sm">{e.field ? <b>{FIELD_LABELS[e.field]}: </b> : null}{e.message}</div>
        ))}
        <div class="text-xs opacity-60">Format: <code class="font-mono">minute hour day-of-month month day-of-week</code>, optionally with seconds first and/or a year last.</div>
      </div>
    )
  }

  const both = !parsed.fields.dom?.any && !parsed.fields.dow?.any && parsed.fields.dom && parsed.fields.dow

  return (
    <div class="p-3 grid gap-3 max-h-[68vh] overflow-auto">
      <div class="grid gap-1">
        <div class="text-lg font-medium leading-snug">{text}</div>
        <div class="flex flex-wrap items-center gap-2">
          {!parsed.reboot && <span class="badge badge-outline badge-sm">{DIALECT_LABEL[parsed.dialect]}</span>}
          <button class="btn btn-primary btn-xs ml-auto" onClick={() => copy('description', text)}>{copied === 'description' ? 'Copied ✓' : 'Copy description'} <kbd class="kbd kbd-xs text-base-content">⏎</kbd></button>
        </div>
      </div>

      {parsed.count === 6 && (
        <div class="grid gap-1">
          <div role="tablist" class="tabs tabs-box tabs-xs w-fit">
            {DIALECTS.map(([id, label]) => <button key={id} role="tab" class={`tab ${dialect === id ? 'tab-active' : ''}`} onClick={() => setDialect(id)}>{label}</button>)}
          </div>
          <div class="text-xs opacity-60">Six fields are ambiguous, so choose the flavour your scheduler uses. {DIALECTS.find((d) => d[0] === dialect)[2]}.</div>
        </div>
      )}
      {both && <div role="alert" class="alert alert-info py-1 text-sm">Day-of-month and day-of-week are both set: classic cron runs when <b>either</b> one matches.</div>}

      {!parsed.reboot && (
        <table class="table table-xs">
          <thead><tr><th>Field</th><th>Value</th><th>Meaning</th></tr></thead>
          <tbody>
            {parsed.order.map((k) => (
              <tr key={k} class="hover">
                <td class="font-semibold whitespace-nowrap">{FIELD_LABELS[k]}</td>
                <td class="font-mono">{parsed.fields[k].raw}</td>
                <td>{fieldMeaning(parsed, k)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!parsed.reboot && (
        <div class="grid gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide opacity-70">Next runs</span>
            <div role="tablist" class="tabs tabs-box tabs-xs">
              <button role="tab" class={`tab ${!utc ? 'tab-active' : ''}`} onClick={() => setUtc(false)} title={localZone}>Local</button>
              <button role="tab" class={`tab ${utc ? 'tab-active' : ''}`} onClick={() => setUtc(true)}>UTC</button>
            </div>
            <select class="select select-xs select-bordered w-20" value={count} onChange={(e) => setCount(+e.target.value)}>
              {[5, 10, 25].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button class="btn btn-xs btn-ghost ml-auto" disabled={!runs.length} onClick={() => copy('runs', runsText())}>{copied === 'runs' ? 'Copied ✓' : 'Copy as ISO list'}</button>
          </div>
          {runs.length ? (
            <ul class="grid gap-0.5">
              {runs.map((t, i) => (
                <li key={t} class="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-base-300 text-sm">
                  <span class="w-5 text-right opacity-40 text-xs">{i + 1}</span>
                  <span class="font-mono text-xs">{fmt.format(t)}{utc ? ' UTC' : ''}</span>
                  <span class="ml-auto text-xs opacity-60">{relativeTime(t)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div class="text-sm opacity-70">No upcoming runs in the next 9 years: the schedule has ended or can never match (for example 31 February).</div>
          )}
        </div>
      )}
    </div>
  )
}
