import { useState, useEffect } from 'preact/hooks'
import { useHotkeyScope, formatJson, highlight, remember } from '../../core/extensions/host.js'
import { extractToken } from './engine.js'

const STATUS = {
  valid: ['badge-success', 'Valid (not expired)'],
  expired: ['badge-error', 'Expired'],
  'not-yet': ['badge-warning', 'Not valid yet'],
  'no-exp': ['badge-info', 'No expiry'],
}

const Json = ({ value }) => {
  const text = formatJson(value)
  return (
    <pre class="bg-base-200 rounded p-2 text-xs font-mono max-h-56 overflow-auto">
      {highlight(text).map((t, i) => (t.cls ? <span key={i} class={t.cls}>{t.text}</span> : t.text))}
    </pre>
  )
}

const Section = ({ title, action, children }) => (
  <section class="grid gap-1">
    <div class="flex items-center gap-2">
      <h4 class="text-xs font-semibold uppercase tracking-wide opacity-70">{title}</h4>
      {action}
    </div>
    {children}
  </section>
)

export function JwtPanel({ item, input }) {
  const r = item.data
  const [copied, setCopied] = useState('')

  const copy = async (what, value) => {
    try {
      await navigator.clipboard.writeText(formatJson(value))
      setCopied(what)
      setTimeout(() => setCopied(''), 1500)
      const token = extractToken(input)
      if (token) {
        const who = r.payload?.name || r.payload?.email || r.payload?.sub || r.payload?.iss || ''
        remember('jwt', { key: 'jwt:' + token, title: `JWT${who ? ' · ' + String(who) : ''}`, subtitle: `${r.alg || 'no alg'} · ${r.status}`, fill: token })
      }
    } catch {}
  }

  const onKeydown = useHotkeyScope()
  useEffect(() => {
    const h = (e) => { if (e.key === 'Enter' && !e.isComposing && r.ok) { e.preventDefault(); copy('payload', r.payload) } }
    return onKeydown(h)
  })

  if (!r.ok) return <div class="p-4 text-sm text-error">{r.error}</div>

  const [cls, label] = STATUS[r.status]
  const btn = (what, value, text) => <button class="btn btn-xs btn-ghost" onClick={() => copy(what, value)}>{copied === what ? 'Copied ✓' : text}</button>

  return (
    <div class="p-3 grid gap-3 max-h-[65vh] overflow-auto">
      <div class="flex flex-wrap items-center gap-2">
        <span class={`badge font-bold ${cls}`}>{label}</span>
        <span class="badge badge-outline font-mono">{r.alg || 'no alg'}</span>
        {r.header.typ && <span class="badge badge-outline font-mono">{r.header.typ}</span>}
        {r.header.kid && <span class="badge badge-ghost font-mono" title="Key ID">kid: {String(r.header.kid)}</span>}
        <button class="btn btn-primary btn-sm ml-auto" onClick={() => copy('payload', r.payload)}>
          {copied === 'payload' ? 'Copied ✓' : 'Copy payload'} <kbd class="kbd kbd-xs text-base-content">⏎</kbd>
        </button>
      </div>

      {r.warnings.map((w) => <div key={w} role="alert" class="alert alert-warning py-1 text-sm">{w}</div>)}

      {r.claims.some((c) => c.time) && (
        <Section title="Times">
          <table class="table table-xs">
            <tbody>
              {r.claims.filter((c) => c.time).map((c) => (
                <tr key={c.key} class="hover">
                  <td class="font-semibold whitespace-nowrap">{c.label} <span class="font-mono text-[10px] font-normal opacity-50">{c.key}</span></td>
                  <td class="font-mono text-xs">{c.time.local}</td>
                  <td class="text-xs opacity-70">{c.time.relative}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Payload" action={btn('payload', r.payload, 'Copy')}>
        <Json value={r.payload} />
      </Section>

      {r.claims.some((c) => c.label && !c.time) && (
        <Section title="Known claims">
          <table class="table table-xs">
            <tbody>
              {r.claims.filter((c) => c.label && !c.time).map((c) => (
                <tr key={c.key} class="hover">
                  <td class="font-semibold whitespace-nowrap">{c.label} <span class="font-mono text-[10px] font-normal opacity-50">{c.key}</span></td>
                  <td class="font-mono text-xs break-all">{typeof c.value === 'string' ? c.value : JSON.stringify(c.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Header" action={btn('header', r.header, 'Copy')}>
        <Json value={r.header} />
      </Section>

      <Section title="Signature">
        <div class="font-mono text-xs break-all opacity-70">{r.signature || '(empty)'}</div>
        <div class="text-xs opacity-60">Decoded only: the signature is not verified, so don't treat these claims as trusted.</div>
      </Section>
    </div>
  )
}
