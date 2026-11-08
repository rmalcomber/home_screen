// Ping, traceroute and DNS lookups for the launcher: parse the command, build the request for the server, and turn the answer into
// text and rows. Pure; unit tested in engine.test.js.
//
//   ping example.com           trace example.com           dns example.com MX @1.1.1.1
//   mx example.com             txt example.com             ptr 8.8.8.8

export const DNS_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'SRV', 'CAA', 'PTR']

const TYPE_WORDS = new Set(DNS_TYPES.map((t) => t.toLowerCase()))
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/
const isIp = (s) => IPV4.test(s) || (s.includes(':') && /^[0-9a-f:.]+$/i.test(s))

/**
 * { op:'ping'|'trace'|'dns', host?, name?, type?, resolver? } for a command, or null. An empty host/name is allowed (the panel
 * explains what to type). `dns` reads a type and an @resolver in any order; an IP address with no type is a PTR lookup.
 */
export function parseNetCommand(q) {
  const m = /^\s*(ping|trace|traceroute|tracert|dns|dig|nslookup|aaaa|mx|txt|ns|cname|soa|srv|caa|ptr)(?:\s+([\s\S]*))?$/i.exec(q || '')
  if (!m) return null
  const word = m[1].toLowerCase()
  const rest = (m[2] || '').trim()
  if (word === 'ping') return { op: 'ping', host: cleanHost(rest) }
  if (word === 'trace' || word === 'traceroute' || word === 'tracert') return { op: 'trace', host: cleanHost(rest) }

  const tokens = rest.split(/\s+/).filter(Boolean)
  const resolver = (tokens.find((t) => t.startsWith('@')) || '').slice(1)
  const others = tokens.filter((t) => !t.startsWith('@'))
  const isType = (t) => TYPE_WORDS.has(t.toLowerCase())
  const bad = (why) => ({ op: 'dns', name: '', type: '', resolver: '', bad: why })
  let type = ''
  let name = ''
  if (['dns', 'dig', 'nslookup'].includes(word)) {
    if (others.length > 2) return bad(`Unexpected "${others[2]}"`)
    if (others.length === 2) {
      if (isType(others[1])) [name, type] = [others[0], others[1].toUpperCase()]
      else if (isType(others[0])) [type, name] = [others[0].toUpperCase(), others[1]]
      else return bad(`"${others[1]}" is not a record type. Try A, AAAA, MX, TXT, NS, CNAME, SOA, SRV, CAA or PTR`)
    } else name = others[0] || ''
  } else {
    // "mx example.com" and friends: the word is the type. Without a host-like name after it, it is just a word.
    if (others.length !== 1 || !/^(?:[\w-]+\.)+[\w-]+\.?$|^[0-9a-f:.]*:[0-9a-f:.]*$|^localhost$/i.test(cleanHost(others[0]))) return null
    type = word.toUpperCase()
    name = others[0]
  }
  name = cleanHost(name)
  if (!type) type = isIp(name) ? 'PTR' : 'A'
  return { op: 'dns', name, type, resolver }
}

/** A host typed or pasted as a URL becomes the bare host name. */
export function cleanHost(s) {
  let t = String(s || '').trim()
  if (!t) return ''
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(t)
  if (m) t = m[1]
  t = t.replace(/^[^@]*@/, '')
  if (t.startsWith('[')) return t.replace(/^\[|\](:\d+)?$/g, '')
  if (/^[^:]+:\d+$/.test(t)) t = t.replace(/:\d+$/, '')
  return t
}

export const describeCommand = (c) =>
  c.op === 'ping' ? `Ping${c.host ? ' ' + c.host : ''}` : c.op === 'trace' ? `Traceroute${c.host ? ' to ' + c.host : ''}` : `DNS${c.name ? ` ${c.type} for ${c.name}` : ' records'}`

/** The command text that reproduces a lookup (what Recent puts back in the box). */
export function fillText(c) {
  if (c.op === 'ping') return `ping ${c.host}`
  if (c.op === 'trace') return `trace ${c.host}`
  return `dns ${c.name} ${c.type}${c.resolver ? ' @' + c.resolver : ''}`
}

/** What is missing from a command, or '' when it can run. */
export function problem(c) {
  if (c.bad) return c.bad
  if (c.op === 'dns') {
    if (!c.name) return 'Type a domain after "dns", for example dns example.com MX'
    if (!/^[A-Za-z0-9_.-]+$|^[0-9a-f:.]+$/i.test(c.name)) return `"${c.name}" is not a domain name or IP address`
    return ''
  }
  if (!c.host) return `Type a host name or IP address after "${c.op}", for example ${c.op} example.com`
  if (!/^[A-Za-z0-9.-]+$|^[0-9a-f:.]+$/i.test(c.host)) return `"${c.host}" is not a host name or IP address`
  return ''
}

/** [path, body] for POST to the server. */
export function request(c) {
  if (c.op === 'ping') return ['/api/net/ping', { host: c.host, count: 4, timeout: 2000 }]
  if (c.op === 'trace') return ['/api/net/trace', { host: c.host, max_hops: 20, timeout: 1500 }]
  return ['/api/net/dns', { name: c.name, type: c.type, ...(c.resolver ? { resolver: c.resolver } : {}) }]
}

const f1 = (n) => (n === null || n === undefined ? '*' : Number(n).toFixed(1).replace(/\.0$/, ''))

/** A ping result as plain text. */
export function pingText(r) {
  const head = `Ping ${r.host}${r.addr && r.addr !== r.host ? ` [${r.addr}]` : ''} (${r.mode === 'tcp' ? 'TCP connect time' : 'ICMP'})`
  const lines = (r.results || []).map((x) => (x.error ? `#${x.seq}: ${x.error}` : `#${x.seq}: ${f1(x.ms)} ms`))
  const stats = `${r.sent} sent, ${r.received} received, ${r.loss}% loss` + (r.received ? `; min/avg/max ${f1(r.min)}/${f1(r.avg)}/${f1(r.max)} ms` : '')
  return [head, ...lines, stats].join('\n')
}

/** A traceroute result as plain text, like the system tool prints it. */
export function traceText(r) {
  const head = `Traceroute to ${r.host}${r.addr && r.addr !== r.host ? ` [${r.addr}]` : ''}, ${r.max_hops} hops max`
  const lines = (r.hops || []).map((h) => `${String(h.hop).padStart(2)}  ${(h.addr || '*').padEnd(15)}  ${(h.ms || []).map((m) => (m === null ? '*' : f1(m) + ' ms')).join('  ')}${h.note ? '  ' + h.note : ''}`)
  return [head, ...lines].join('\n')
}

/** DNS answers as `name  ttl  type  data` lines. */
export function dnsText(r) {
  return (r.answers || []).map((a) => `${a.name}\t${a.ttl}\t${a.type}\t${a.data}`).join('\n')
}

/** "1h", "5m", "30s" for a TTL. */
export function ttlText(s) {
  if (s >= 86400 && s % 86400 === 0) return `${s / 86400}d`
  if (s >= 3600 && s % 3600 === 0) return `${s / 3600}h`
  if (s >= 60 && s % 60 === 0) return `${s / 60}m`
  return `${s}s`
}

/** Reads the server's JSON. → { ok:true, data } | { ok:false, error } */
export function readResult(status, json) {
  if (status === 403) return { ok: false, error: 'Network tools only work when this page is opened via localhost or 127.0.0.1 (or a host listed in --allowed-hosts).' }
  if (status === 404 || status === 405) return { ok: false, error: 'This server does not have network tools (it is older than this page). Update Home Screen.' }
  if (status < 200 || status >= 300) return { ok: false, error: `The server returned ${status}.` }
  if (json?.error) return { ok: false, error: json.error }
  return { ok: true, data: json }
}
