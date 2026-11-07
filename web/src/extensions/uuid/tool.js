import { historyItems, remember as rememberHistory } from '../../core/extensions/host.js'
import { v4, v7, NIL, forms, parseUuidCommand } from './engine.js'

// UUID: "uuid" → v4 / v7 and common spellings, "uuid 5" → five at once, "uuid <uuid>" → inspect (version, time) and re-format.
export default {
  items(q) {
    if (!q.trim()) return historyItems('uuid', 'UUID', 'iconify:fa6-solid:fingerprint')
    const cmd = parseUuidCommand(q)
    if (!cmd) return []
    // `fill` is what reopens this value from Recent (as "uuid <value>", which offers every spelling again)
    const item = (key, title, subtitle, text, fill) => ({
      key: `uuid:${key}:${text}`,
      title,
      subtitle: `${subtitle}  ·  Enter to copy`,
      kind: 'Copy',
      recent: false,
      icon: 'iconify:fa6-solid:fingerprint',
      run: () => {
        if (fill) rememberHistory('uuid', { key: `uuid:${text}`, title: text, subtitle, fill })
        navigator.clipboard?.writeText(text).catch(() => {})
      },
    })
    if (cmd.inspect) {
      const p = cmd.inspect
      const f = forms(p.canonical)
      const detail = p.nil ? 'Nil UUID (all zeros)' : `Version ${p.version} · ${p.versionName}`
      const extra = p.nil ? '' : `${p.variant}${p.time ? ` · created ${p.time.toISOString()}` : ''}`
      return [
        item('info', detail, extra || 'canonical form', f.lower, `uuid ${p.canonical}`),
        item('upper', f.upper, 'UPPERCASE', f.upper, `uuid ${p.canonical}`),
        item('compact', f.compact, 'No hyphens', f.compact, `uuid ${p.canonical}`),
        item('braces', f.braces, 'Braces (GUID style)', f.braces, `uuid ${p.canonical}`),
      ]
    }
    if (cmd.count > 1) {
      const many = (gen, label) => {
        const list = Array.from({ length: cmd.count }, gen)
        return item(`${label}${cmd.count}`, `${cmd.count} × ${label}  (${list[0]}, …)`, 'One per line', list.join('\n'))
      }
      return [many(() => v4(), 'UUID v4'), many(() => v7(), 'UUID v7')]
    }
    const u = v4()
    const u7 = v7()
    const f = forms(u)
    return [
      item('v4', u, 'UUID v4 · random', u, `uuid ${u}`),
      item('v7', u7, 'UUID v7 · time-ordered (sorts by creation time)', u7, `uuid ${u7}`),
      item('compact', f.compact, 'v4, no hyphens', f.compact, `uuid ${u}`),
      item('upper', f.upper, 'v4, UPPERCASE', f.upper, `uuid ${u}`),
      item('braces', f.braces, 'v4, braces (GUID style)', f.braces, `uuid ${u}`),
      item('nil', NIL, 'Nil UUID', NIL, `uuid ${NIL}`),
    ]
  },
}
