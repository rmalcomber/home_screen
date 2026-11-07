import { historyItems, remember as rememberHistory } from '../../core/extensions/host.js'
import { digest, parseHashCommand, ALGOS } from './engine.js'

// Hash: "hash <text>" gives MD5 + SHA-1/256/384/512; "sha256 <text>" / "md5 <text>" gives one (hex, UPPERCASE hex, base64). Enter copies.
export default {
  async items(q) {
    if (!q.trim()) return historyItems('hash', 'Hash', 'iconify:fa6-solid:hashtag')
    const cmd = parseHashCommand(q)
    if (!cmd) return []
    const results = await digest(cmd.text, cmd.ids ?? undefined)
    const preview = (t) => (t.length > 40 ? t.slice(0, 40) + '…' : t).replace(/\s+/g, ' ')
    const mk = (algo, form, value) => ({
      key: `hash:${algo.id}:${form}:${cmd.text}`,
      title: value,
      subtitle: `${algo.label}${form === 'hex' ? '' : ' · ' + form}  ·  Enter to copy`,
      kind: 'Copy',
      recent: false,
      icon: 'iconify:fa6-solid:hashtag',
      run: () => {
        rememberHistory('hash', { key: `hash:${algo.id}:${cmd.text.slice(0, 200)}`, title: `${algo.label} of "${preview(cmd.text)}"`, subtitle: results[algo.id].hex.slice(0, 24) + '…', fill: `${algo.id} ${cmd.text}` })
        navigator.clipboard?.writeText(value).catch(() => {})
      },
    })
    const out = []
    for (const algo of ALGOS) {
      const r = results[algo.id]
      if (!r) continue
      out.push(mk(algo, 'hex', r.hex))
      if (cmd.ids) out.push(mk(algo, 'UPPERCASE', r.hex.toUpperCase()), mk(algo, 'base64', r.b64))
    }
    return out
  },
}
