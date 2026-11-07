import { historyItems } from '../../core/extensions/host.js'
import { parseDiffCommand } from './engine.js'
import { DiffPanel } from './Panel.jsx'

// Text diff: "diff" opens two boxes; "diff <old>⏎=======⏎<new>" pre-fills both (a line of 7 "=" separates them).
// Line diff with word-level highlights, unified or side by side. Ctrl+Enter copies a standard unified diff.
export default {
  items(q) {
    if (!q.trim()) return historyItems('diff', 'Diff', 'iconify:fa6-solid:code-compare')
    const data = parseDiffCommand(q)
    if (!data) return []
    return [{ key: 'diff:' + q, title: 'Text diff', kind: 'diff', icon: 'iconify:fa6-solid:code-compare', panel: DiffPanel, hint: 'Ctrl+Enter: copy unified diff', data }]
  },
}
