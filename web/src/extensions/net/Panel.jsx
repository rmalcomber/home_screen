import { useState, useEffect, useRef } from 'preact/hooks'
import { useHotkeyScope, remember, CopyButton } from '../../core/extensions/host.js'
import { DNS_TYPES, problem, request, readResult, pingText, traceText, dnsText, ttlText, fillText, describeCommand } from './engine.js'

const f1 = (n) => (n === null || n === undefined ? '*' : Number(n).toFixed(1).replace(/\.0$/, ''))

function Ping({ r }) {
  return (
    <div class="grid gap-2">
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span class="text-lg font-semibold tabular-nums">{r.received} of {r.sent} replied</span>
        <span class={`text-sm ${r.loss > 0 ? 'text-warning' : 'text-success'}`}>{r.loss}% loss</span>
        {r.received > 0 && <span class="text-sm tabular-nums opacity-80">min {f1(r.min)} · avg {f1(r.avg)} · max {f1(r.max)} ms</span>}
        <span class="text-xs opacity-60 font-mono">{r.addr}{r.mode === 'tcp' ? ' · TCP connect time' : ' · ICMP'}</span>
      </div>
      {r.note && <div role="alert" class="alert alert-warning py-1 text-sm">{r.note}</div>}
      <table class="table table-xs w-auto">
        <tbody>
          {(r.results || []).map((x) => (
            <tr key={x.seq}>
              <td class="opacity-60">#{x.seq}</td>
              <td class={`font-mono tabular-nums ${x.error ? 'text-error' : ''}`}>{x.error ? x.error : `${f1(x.ms)} ms`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Trace({ r }) {
  return (
    <div class="grid gap-2">
      <div class="text-sm opacity-80">
        {r.reached ? `Reached ${r.addr} in ${r.hops.length} hop${r.hops.length === 1 ? '' : 's'}.` : `Did not reach ${r.addr} within ${r.max_hops} hops.`}
      </div>
      {r.note && <div role="alert" class="alert alert-warning py-1 text-sm">{r.note}</div>}
      <table class="table table-xs">
        <thead>
          <tr><th>Hop</th><th>Address</th><th class="text-right">Times (ms)</th></tr>
        </thead>
        <tbody>
          {(r.hops || []).map((h) => (
            <tr key={h.hop} class="hover">
              <td class="opacity-60">{h.hop}</td>
              <td class="font-mono">{h.addr || <span class="opacity-40">no answer</span>}{h.note && <span class="opacity-60 text-xs"> · {h.note}</span>}</td>
              <td class="font-mono tabular-nums text-right whitespace-nowrap">{(h.ms || []).map((m) => (m === null ? '*' : f1(m))).join('   ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Dns({ r }) {
  const ok = r.status === 'NOERROR'
  return (
    <div class="grid gap-2">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span class={`badge badge-sm ${ok ? 'badge-success' : 'badge-warning'}`}>{r.status}</span>
        <span class="opacity-70">{(r.answers || []).length} record{(r.answers || []).length === 1 ? '' : 's'} · {r.ms} ms · asked {r.resolver}</span>
        {r.truncated && <span class="text-warning">The answer was cut short.</span>}
      </div>
      {r.answers?.length > 0 ? (
        <table class="table table-xs">
          <thead>
            <tr><th>Name</th><th>Type</th><th>TTL</th><th>Data</th><th></th></tr>
          </thead>
          <tbody>
            {r.answers.map((a, i) => (
              <tr key={i} class="hover">
                <td class="font-mono align-top break-all">{a.name}</td>
                <td class="align-top font-semibold">{a.type}</td>
                <td class="align-top tabular-nums opacity-70 whitespace-nowrap" title={`${a.ttl} seconds`}>{ttlText(a.ttl)}</td>
                <td class="font-mono break-all">{a.data}</td>
                <td class="align-top text-right"><CopyButton text={a.data} class="btn btn-ghost btn-xs" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p class="text-sm opacity-70">{ok ? 'The name exists, but has no records of this type.' : r.status === 'NXDOMAIN' ? 'That name does not exist.' : 'No records came back.'}</p>
      )}
      {r.answers?.length === 0 && r.authority?.length > 0 && (
        <p class="text-xs opacity-60 font-mono break-all">Authority: {r.authority.map((a) => `${a.type} ${a.data}`).join(' · ')}</p>
      )}
    </div>
  )
}

/** Runs ping, traceroute or a DNS lookup on the server (when asked: Enter or the button) and shows the result. */
export function NetPanel({ item }) {
  const [cmd, setCmd] = useState(item.data.cmd)
  const [state, setState] = useState(null) // null | { loading } | { error } | { data }
  const busy = useRef(false)
  const why = problem(cmd)

  const run = async (c = cmd) => {
    if (problem(c) || busy.current) return
    busy.current = true
    setState({ loading: true })
    try {
      const [path, body] = request(c)
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await r.json().catch(() => null)
      const res = readResult(r.status, json)
      if (res.ok) {
        remember('net', { key: `net:${fillText(c)}`, title: describeCommand(c), subtitle: c.op === 'dns' ? c.resolver || '' : '', fill: fillText(c) })
        setState({ data: res.data, op: c.op })
      } else setState({ error: res.error })
    } catch (e) {
      setState({ error: `Could not reach the server: ${e.message}` })
    }
    busy.current = false
  }

  const onKeydown = useHotkeyScope()
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Enter' && !e.isComposing && !e.shiftKey) { e.preventDefault(); run() }
    }
    return onKeydown(h)
  })

  const switchType = (type) => {
    const c = { ...cmd, type }
    setCmd(c)
    run(c)
  }

  const text = state?.data ? (state.op === 'ping' ? pingText(state.data) : state.op === 'trace' ? traceText(state.data) : dnsText(state.data)) : ''
  const label = cmd.op === 'ping' ? 'Ping' : cmd.op === 'trace' ? 'Trace' : 'Look up'

  return (
    <div class="p-3 grid gap-3 max-h-[70vh] overflow-auto">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-semibold">{describeCommand(cmd)}</span>
        <button class="btn btn-sm btn-primary ml-auto" disabled={!!why || state?.loading} onClick={() => run()}>{state?.loading ? 'Working…' : label}</button>
        {text && <CopyButton text={text} label="Copy result" class="btn btn-sm btn-ghost" />}
      </div>
      {cmd.op === 'dns' && cmd.name && !why && (
        <div class="flex flex-wrap gap-1" role="group" aria-label="Record type">
          {DNS_TYPES.map((t) => (
            <button key={t} class={`btn btn-xs ${cmd.type === t ? 'btn-primary' : 'btn-ghost'}`} disabled={state?.loading} onClick={() => switchType(t)}>{t}</button>
          ))}
        </div>
      )}
      {why && <p class="text-sm opacity-70">{why}</p>}
      {!why && !state && <p class="text-sm opacity-60">Press Enter to run it. It runs from the machine that runs Home Screen, only when you ask.</p>}
      {state?.loading && <p class="text-sm opacity-70">{cmd.op === 'trace' ? 'Tracing the route. This can take up to a minute…' : 'Working…'}</p>}
      {state?.error && <div role="alert" class="alert alert-warning py-2 text-sm">{state.error}</div>}
      {state?.data && !state.loading && (state.op === 'ping' ? <Ping r={state.data} /> : state.op === 'trace' ? <Trace r={state.data} /> : <Dns r={state.data} />)}
    </div>
  )
}
