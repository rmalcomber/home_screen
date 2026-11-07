import { copyItem, preview, historyItems } from '../../core/extensions/host.js'
import { parseCaseCommand, conversions, textStats } from './engine.js'

const ICON = 'iconify:fa6-solid:font'

// Text case and counts: "snake hello world", "camel …", "kebab …", "title …", "slug …", or "case …" for every form;
// "count …" / "wc …" for words, characters and lines. The form you asked for comes first. Enter copies a row.
export default {
  items(q) {
    if (!q.trim()) return historyItems('case', 'Text', ICON)
    const cmd = parseCaseCommand(q)
    if (!cmd) return []
    const { word, text } = cmd
    const fill = `${word} ${text.slice(0, 300)}`
    const history = (label, value) => ({ kind: 'case', key: `case:${word}:${text.slice(0, 200)}`, title: `${word} ${preview(text, 50)}`, subtitle: `${label}: ${preview(value, 40)}`, fill })
    if (word === 'count') {
      return textStats(text).map((r) =>
        copyItem({ key: `case:count:${r.id}:${text.length}`, title: r.value, subtitle: r.label, icon: ICON, text: r.value, history: history(r.label, r.value) }),
      )
    }
    return conversions(text, word === 'case' ? null : word).map((r) =>
      copyItem({ key: `case:${r.id}:${text}`, title: preview(r.value, 100), subtitle: r.label, icon: ICON, text: r.value, mono: true, history: history(r.label, r.value) }),
    )
  },
}
