import { historyItems, remember as rememberHistory } from '../../core/extensions/host.js'
import { generate, toHtml, parseLoremCommand, unitLabel } from './engine.js'

// Lorem ipsum: "lorem" shows presets; "lorem 50" = 50 words (like Emmet), "lorem 3p", "lorem 2 sentences", "lorem 200 chars".
// Each request offers plain text, HTML (<p>…</p>) and a version without the classic opening. Enter copies.
export default {
  items(q) {
    if (!q.trim()) return historyItems('lorem', 'Lorem', 'iconify:fa6-solid:align-left')
    const cmd = parseLoremCommand(q)
    if (!cmd) return []
    const preview = (t) => (t.length > 90 ? t.slice(0, 90) + '…' : t).replace(/\s+/g, ' ')
    const mk = (spec, variant, label) => {
      const text = generate(spec, { classic: variant !== 'random' })
      const out = variant === 'html' ? toHtml(text) : text
      const what = unitLabel(spec.count, spec.unit)
      return {
        key: `lorem:${spec.count}${spec.unit}:${variant}`,
        title: preview(out),
        subtitle: `${what} · ${label}  ·  Enter to copy`,
        kind: 'Copy',
        recent: false,
        icon: 'iconify:fa6-solid:align-left',
        run: () => {
          rememberHistory('lorem', { key: `lorem:${spec.count}${spec.unit}:${variant}`, title: `Lorem ipsum · ${what}`, subtitle: label, fill: `lorem ${spec.count} ${spec.unit}` })
          navigator.clipboard?.writeText(out).catch(() => {})
        },
      }
    }
    if (cmd.menu) {
      return [
        [1, 'sentences'], [1, 'paragraphs'], [3, 'paragraphs'], [5, 'paragraphs'], [10, 'words'], [50, 'words'], [100, 'words'],
      ].map(([count, unit]) => mk({ count, unit }, 'plain', 'plain text'))
    }
    return [mk(cmd, 'plain', 'plain text'), mk(cmd, 'html', 'HTML paragraphs'), mk(cmd, 'random', 'no "Lorem ipsum dolor" opening')]
  },
}
