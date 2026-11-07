import { copyItem, historyItems } from '../../core/extensions/host.js'
import { parseCidrQuery, networkInfo, contains, relation, split, formatIp, cidrText } from './engine.js'

const ICON = 'iconify:fa6-solid:network-wired'

const RELATION = {
  equal: ['Same network', 'Both describe exactly the same block of addresses'],
  'a-contains-b': ['The first network contains the second', 'Every address of the second is inside the first'],
  'b-contains-a': ['The second network contains the first', 'Every address of the first is inside the second'],
  disjoint: ['No overlap', 'The two networks share no addresses'],
}

// IP and CIDR calculator: "cidr 10.0.0.0/24" (or just paste 10.0.0.0/24, 192.168.1.5, 2001:db8::/32) for the network, mask, hosts
// and type; "cidr 10.0.0.5 in 10.0.0.0/24"; "cidr 10.0.0.0/24 overlaps 10.0.0.128/25"; "cidr 10.0.0.0/24 split 26". Enter copies a row.
export default {
  items(q) {
    if (!q.trim()) return historyItems('cidr', 'IP', ICON)
    const cmd = parseCidrQuery(q)
    if (!cmd) return []
    const text = q.trim()
    const history = (title, subtitle) => ({ kind: 'cidr', key: `cidr:${text}`, title, subtitle, fill: text.slice(0, 300) })
    const row = (id, label, value, hist) => copyItem({ key: `cidr:${id}:${text}`, title: value, subtitle: label, icon: ICON, mono: true, history: hist })

    if (cmd.kind === 'error') return [{ key: `cidr:err:${q}`, title: cmd.error, kind: 'Error', icon: ICON, run() {} }]

    if (cmd.kind === 'info') {
      const rows = networkInfo(cmd.net)
      const hist = history(`IP ${cidrText(cmd.net)}`, rows.find((r) => r.id === 'type')?.value || '')
      return rows.map((r) => row(r.id, r.label, r.value, hist))
    }
    if (cmd.kind === 'in') {
      const inside = contains(cmd.net, cmd.ip)
      const ip = formatIp(cmd.ip.v, cmd.ip.value)
      const net = cidrText(cmd.net)
      const title = inside ? `Yes: ${ip} is inside ${net}` : `No: ${ip} is not inside ${net}`
      return [copyItem({ key: `cidr:in:${text}`, title, subtitle: cmd.ip.v === cmd.net.v ? undefined : 'An IPv4 address is never inside an IPv6 network, and the other way round', icon: ICON, history: history(title, '') })]
    }
    if (cmd.kind === 'relation') {
      const r = relation(cmd.a, cmd.b)
      if (!r) return [{ key: `cidr:mix:${q}`, title: 'Cannot compare IPv4 with IPv6', kind: 'Error', icon: ICON, run() {} }]
      const [title, note] = RELATION[r]
      return [copyItem({ key: `cidr:rel:${text}`, title, subtitle: `${cidrText(cmd.a)} and ${cidrText(cmd.b)} · ${note}`, icon: ICON, history: history(`${cidrText(cmd.a)} vs ${cidrText(cmd.b)}`, title) })]
    }
    // split
    const s = split(cmd.net, cmd.prefix)
    if (!s) return [{ key: `cidr:split:${q}`, title: `Cannot split ${cidrText(cmd.net)} into /${cmd.prefix}`, subtitle: 'The new prefix must be longer than the current one', kind: 'Error', icon: ICON, run() {} }]
    const hist = history(`Split ${cidrText(cmd.net)} into /${cmd.prefix}`, `${s.total} subnets`)
    const out = s.subnets.map((n, i) => row(`s${i}`, `Subnet ${i + 1} of ${s.total}`, cidrText(n), hist))
    if (s.total > BigInt(s.subnets.length)) out.push({ key: `cidr:more:${text}`, title: `…and ${(s.total - BigInt(s.subnets.length)).toLocaleString('en-US')} more`, subtitle: `Showing the first ${s.subnets.length}`, kind: 'Info', icon: ICON, run() {} })
    return out
  },
}
