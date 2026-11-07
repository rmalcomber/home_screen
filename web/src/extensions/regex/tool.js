import { historyItems } from '../../core/extensions/host.js'
import { parseRegexCommand } from './engine.js'
import { RegexPanel } from './Panel.jsx'

// Regex tester: "regex" / "re " opens an editor; "re /\\d+/g some text" pre-fills pattern, flags and test text. Ctrl+Enter copies /regex/.
export default {
  items(q) {
    if (!q.trim()) return historyItems('regex', 'Regex', 'iconify:fa6-solid:asterisk')
    const data = parseRegexCommand(q)
    if (!data) return []
    return [{ key: 'regex:' + q, title: 'Regex tester', kind: 'regex', icon: 'iconify:fa6-solid:asterisk', panel: RegexPanel, hint: 'Ctrl+Enter: copy /regex/', data }]
  },
}
