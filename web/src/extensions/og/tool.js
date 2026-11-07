import { historyItems } from '../../core/extensions/host.js'
import { parseOgCommand, normalizeUrl } from './engine.js'
import { OgPanel } from './Panel.jsx'

const ICON = 'iconify:fa6-solid:share-nodes'

// Open Graph viewer: "og https://example.com/article" opens a panel; press Enter in it to fetch the page (through your Home
// Screen server, never while you type) and see the preview card, every og: and twitter: tag, and what is missing.
export default {
  items(q) {
    if (!q.trim()) return historyItems('og', 'Open Graph', ICON)
    const cmd = parseOgCommand(q)
    if (!cmd) return []
    const norm = normalizeUrl(cmd.text)
    return [{ key: 'og:' + q, title: norm.ok ? `Open Graph · ${new URL(norm.url).hostname}` : 'Open Graph', kind: 'og', icon: ICON, panel: OgPanel, hint: 'Enter: fetch the page', data: { norm } }]
  },
}
