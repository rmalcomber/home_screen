// IP address and CIDR maths for the launcher, IPv4 and IPv6. Pure (BigInt); unit tested in engine.test.js.
//
//   cidr 10.0.0.0/24            network, mask, hosts...        (also bare:  10.0.0.0/24  or  192.168.1.5  or  2001:db8::/32)
//   cidr 10.0.0.5 in 10.0.0.0/24
//   cidr 10.0.0.0/24 overlaps 10.0.0.128/25
//   cidr 10.0.0.0/24 split 26

const BITS = { 4: 32n, 6: 128n }

/** IPv4 text -> BigInt, or null. Leading zeros are refused (some tools read them as octal). */
export function parseV4(s) {
  const m = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.exec(String(s).trim())
  if (!m) return null
  let v = 0n
  for (let i = 1; i <= 4; i++) {
    const n = Number(m[i])
    if (n > 255) return null
    v = (v << 8n) | BigInt(n)
  }
  return v
}

/** IPv6 text (compressed, expanded, or with a trailing IPv4 part) -> BigInt, or null. A %zone is ignored. */
export function parseV6(text) {
  let s = String(text).trim().split('%')[0]
  if (!s.includes(':')) return null
  const lastColon = s.lastIndexOf(':')
  const tail = s.slice(lastColon + 1)
  if (tail.includes('.')) {
    const v4 = parseV4(tail)
    if (v4 === null) return null
    s = `${s.slice(0, lastColon + 1)}${(v4 >> 16n).toString(16)}:${(v4 & 0xffffn).toString(16)}`
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const list = (p) => (p === '' ? [] : p.split(':'))
  const head = list(halves[0])
  const rest = halves.length === 2 ? list(halves[1]) : []
  let groups
  if (halves.length === 1) {
    if (head.length !== 8) return null
    groups = head
  } else {
    if (head.length + rest.length > 7) return null
    groups = [...head, ...Array(8 - head.length - rest.length).fill('0'), ...rest]
  }
  let v = 0n
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null
    v = (v << 16n) | BigInt(parseInt(g, 16))
  }
  return v
}

/** Text -> { v: 4 | 6, value } or null. */
export function parseIp(text) {
  const t = String(text).trim()
  const a = parseV4(t)
  if (a !== null) return { v: 4, value: a }
  const b = parseV6(t)
  return b === null ? null : { v: 6, value: b }
}

export function formatV4(value) {
  return [24n, 16n, 8n, 0n].map((s) => String((value >> s) & 0xffn)).join('.')
}

/** IPv6 in its shortest form (RFC 5952), or fully expanded when `expand` is set. */
export function formatV6(value, { expand = false } = {}) {
  const groups = []
  for (let i = 7n; i >= 0n; i--) groups.push(Number((value >> (i * 16n)) & 0xffffn))
  if (expand) return groups.map((g) => g.toString(16).padStart(4, '0')).join(':')
  let best = { at: -1, len: 0 }
  for (let i = 0; i < 8; ) {
    if (groups[i] !== 0) { i++; continue }
    let j = i
    while (j < 8 && groups[j] === 0) j++
    if (j - i > best.len) best = { at: i, len: j - i }
    i = j
  }
  const hex = groups.map((g) => g.toString(16))
  if (best.len < 2) return hex.join(':')
  return `${hex.slice(0, best.at).join(':')}::${hex.slice(best.at + best.len).join(':')}`
}

export const formatIp = (v, value) => (v === 4 ? formatV4(value) : formatV6(value))

/** "10.0.0.0/24", "10.0.0.5" (a single address), "10.0.0.0/255.255.255.0", "2001:db8::/32" -> { v, ip, prefix } or null. */
export function parseCidr(text) {
  const t = String(text).trim()
  const slash = t.indexOf('/')
  const addr = parseIp(slash < 0 ? t : t.slice(0, slash))
  if (!addr) return null
  const max = Number(BITS[addr.v])
  if (slash < 0) return { v: addr.v, ip: addr.value, prefix: max }
  const p = t.slice(slash + 1)
  if (/^\d{1,3}$/.test(p)) {
    const prefix = Number(p)
    return prefix <= max ? { v: addr.v, ip: addr.value, prefix } : null
  }
  if (addr.v === 4) {
    const mask = parseV4(p)
    if (mask === null) return null
    const inv = ~mask & 0xffffffffn
    if ((inv & (inv + 1n)) !== 0n) return null // not a contiguous mask
    return { v: 4, ip: addr.value, prefix: 32 - inv.toString(2).replace(/^0$/, '').length }
  }
  return null
}

const maskOf = (v, prefix) => {
  const bits = BITS[v]
  const host = bits - BigInt(prefix)
  return ((1n << bits) - 1n) ^ ((1n << host) - 1n)
}

/** The block as numbers: { v, prefix, network, last, size }. */
export function block(c) {
  const mask = maskOf(c.v, c.prefix)
  const network = c.ip & mask
  const size = 1n << (BITS[c.v] - BigInt(c.prefix))
  return { v: c.v, prefix: c.prefix, network, last: network + size - 1n, size }
}

const NUM = (n) => n.toLocaleString('en-US')

// ---- what kind of address is it?
const R4 = [['0.0.0.0/8', 'this network'], ['10.0.0.0/8', 'private network (RFC 1918)'], ['100.64.0.0/10', 'carrier-grade NAT (RFC 6598)'], ['127.0.0.0/8', 'loopback'], ['169.254.0.0/16', 'link-local'], ['172.16.0.0/12', 'private network (RFC 1918)'], ['192.0.0.0/24', 'IETF protocol assignments'], ['192.0.2.0/24', 'documentation (TEST-NET-1)'], ['192.168.0.0/16', 'private network (RFC 1918)'], ['198.18.0.0/15', 'benchmarking'], ['198.51.100.0/24', 'documentation (TEST-NET-2)'], ['203.0.113.0/24', 'documentation (TEST-NET-3)'], ['224.0.0.0/4', 'multicast'], ['255.255.255.255/32', 'limited broadcast'], ['240.0.0.0/4', 'reserved']]
const R6 = [['::1/128', 'loopback'], ['::/128', 'unspecified'], ['::ffff:0:0/96', 'IPv4-mapped'], ['64:ff9b::/96', 'NAT64'], ['2001:db8::/32', 'documentation'], ['2000::/3', 'global unicast'], ['fc00::/7', 'unique local (private)'], ['fe80::/10', 'link-local'], ['ff00::/8', 'multicast']]
const table = (list) => list.map(([c, label]) => [parseCidr(c), label])
const T4 = table(R4)
const T6 = table(R6)

/** A short description of an address: private, loopback, multicast, public... */
export function classify(v, value) {
  const list = v === 4 ? T4 : T6
  let best = null
  for (const [c, label] of list) {
    const b = block(c)
    if (value >= b.network && value <= b.last && (!best || c.prefix > best.prefix)) best = { prefix: c.prefix, label }
  }
  return best ? best.label : v === 4 ? 'public internet address' : 'unassigned or reserved'
}

/** Rows describing a network: [{ id, label, value }]. */
export function networkInfo(c) {
  const b = block(c)
  const rows = []
  const add = (id, label, value) => rows.push({ id, label, value })
  const host = c.ip !== b.network
  if (host) add('address', 'Address', formatIp(c.v, c.ip))
  add('network', 'Network', `${formatIp(c.v, b.network)}/${c.prefix}`)
  if (c.v === 4) {
    const mask = maskOf(4, c.prefix)
    add('mask', 'Netmask', formatV4(mask))
    add('wildcard', 'Wildcard mask', formatV4(~mask & 0xffffffffn))
    if (c.prefix <= 30) {
      add('broadcast', 'Broadcast', formatV4(b.last))
      add('first', 'First host', formatV4(b.network + 1n))
      add('last', 'Last host', formatV4(b.last - 1n))
      add('hosts', 'Usable hosts', NUM(b.size - 2n))
    } else if (c.prefix === 31) {
      add('first', 'First host', formatV4(b.network))
      add('last', 'Last host', formatV4(b.last))
      add('hosts', 'Usable hosts', '2 (point-to-point link, RFC 3021)')
    } else {
      add('hosts', 'Usable hosts', '1 (a single address)')
    }
    add('total', 'Total addresses', NUM(b.size))
    add('type', 'Type', classify(4, b.network))
    add('int', 'As a number', `${c.ip} · 0x${c.ip.toString(16).toUpperCase().padStart(8, '0')}`)
    add('bin', 'Binary', `${formatV4(c.ip).split('.').map((o) => Number(o).toString(2).padStart(8, '0')).join('.')} / ${formatV4(mask).split('.').map((o) => Number(o).toString(2).padStart(8, '0')).join('.')}`)
  } else {
    add('last', 'Last address', formatV6(b.last))
    add('total', 'Total addresses', NUM(b.size))
    add('expanded', 'Expanded', formatV6(b.network, { expand: true }))
    add('type', 'Type', classify(6, b.network))
    const mapped = c.ip >> 32n === 0xffffn
    if (mapped) add('v4', 'IPv4 inside', formatV4(c.ip & 0xffffffffn))
  }
  return rows
}

/** Is the address inside the block? */
export function contains(c, ip) {
  if (c.v !== ip.v) return false
  const b = block(c)
  return ip.value >= b.network && ip.value <= b.last
}

/** How two blocks relate: 'equal', 'a-contains-b', 'b-contains-a' or 'disjoint' (null for IPv4 against IPv6). */
export function relation(a, b) {
  if (a.v !== b.v) return null
  const x = block(a)
  const y = block(b)
  if (x.network === y.network && x.last === y.last) return 'equal'
  if (x.network <= y.network && x.last >= y.last) return 'a-contains-b'
  if (y.network <= x.network && y.last >= x.last) return 'b-contains-a'
  return 'disjoint'
}

/** Cuts a block into subnets of a longer prefix (at most `limit`). Returns { subnets, total } or null. */
export function split(c, newPrefix, limit = 256) {
  const max = Number(BITS[c.v])
  if (!Number.isInteger(newPrefix) || newPrefix <= c.prefix || newPrefix > max) return null
  const b = block(c)
  const step = 1n << (BITS[c.v] - BigInt(newPrefix))
  const total = 1n << BigInt(newPrefix - c.prefix)
  const subnets = []
  for (let i = 0n; i < total && i < BigInt(limit); i++) subnets.push({ v: c.v, ip: b.network + i * step, prefix: newPrefix })
  return { subnets, total }
}

const ARGS = /^\s*(?:(cidr|ip|subnet)(?:[ \t]+|$))?([\s\S]*)$/i

/**
 * Reads a launcher query. Returns { kind, ... } or null:
 *   { kind: 'info', net }  { kind: 'in', ip, net }  { kind: 'relation', a, b }  { kind: 'split', net, prefix }  { kind: 'error', error }
 * Text with no command word only counts when it is a valid address or CIDR on its own.
 */
export function parseCidrQuery(q) {
  const m = ARGS.exec(q || '')
  const word = m[1]
  const text = m[2].trim()
  if (!word) {
    if (!/^[0-9a-f:.]+(\/[0-9.]+)?$/i.test(text) || !/[.:]/.test(text)) return null
    const net = parseCidr(text)
    return net ? { kind: 'info', net } : null
  }
  if (!text) return { kind: 'error', error: 'Type an address or network, for example 10.0.0.0/24' }
  if (!/[0-9:./]/.test(text)) return null // ordinary words such as "ip address" are not for us
  const bad = (what) => ({ kind: 'error', error: `"${what}" is not a valid IP address or network` })
  let x
  if ((x = /^(\S+)\s+in\s+(\S+)$/i.exec(text))) {
    const ip = parseIp(x[1])
    const net = parseCidr(x[2])
    return !ip ? bad(x[1]) : !net ? bad(x[2]) : { kind: 'in', ip, net }
  }
  if ((x = /^(\S+)\s+(?:contains|has)\s+(\S+)$/i.exec(text))) {
    const net = parseCidr(x[1])
    const ip = parseIp(x[2])
    return !net ? bad(x[1]) : !ip ? bad(x[2]) : { kind: 'in', ip, net }
  }
  if ((x = /^(\S+)\s+(?:overlaps?|vs|and|with)\s+(\S+)$/i.exec(text))) {
    const a = parseCidr(x[1])
    const b = parseCidr(x[2])
    return !a ? bad(x[1]) : !b ? bad(x[2]) : { kind: 'relation', a, b }
  }
  if ((x = /^(\S+)\s+(?:split|into|\/)\s*\/?(\d{1,3})$/i.exec(text))) {
    const net = parseCidr(x[1])
    return net ? { kind: 'split', net, prefix: Number(x[2]) } : bad(x[1])
  }
  if ((x = /^(\S+)\s+\/(\d{1,3})$/.exec(text))) {
    const net = parseCidr(x[1])
    return net ? { kind: 'split', net, prefix: Number(x[2]) } : bad(x[1])
  }
  const net = parseCidr(text)
  return net ? { kind: 'info', net } : bad(text)
}

export const cidrText = (c) => `${formatIp(c.v, c.ip)}/${c.prefix}`
