import { historyItems } from '../../core/extensions/host.js'
import { parseMarkdownCommand } from './engine.js'
import { MarkdownPanel } from './Panel.jsx'

// Markdown previewer: "md <markdown>" (or "markdown …") renders it live. Copy as rich text (pastes formatted into email and
// docs), as HTML, or download a standalone page. Raw HTML in the source is shown as text, never rendered.
export default {
  items(q) {
    if (!q.trim()) return historyItems('md', 'Markdown', 'iconify:fa6-brands:markdown')
    const data = parseMarkdownCommand(q)
    if (!data) return []
    return [{ key: 'md:' + q, title: 'Markdown preview', kind: 'md', icon: 'iconify:fa6-brands:markdown', panel: MarkdownPanel, hint: 'Ctrl+Enter: copy rich text', data }]
  },
}
