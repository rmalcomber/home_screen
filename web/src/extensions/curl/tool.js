import { parseCurl, looksLikeCurl } from './engine.js'
import { CurlPanel } from './Panel.jsx'
import { historyItems } from '../../core/extensions/host.js'

// Curl runner: paste a curl command to see it organised (params, headers, body), then Enter to run it.
export default {
  items(q) {
    if (!q.trim()) return historyItems('curl', 'curl', 'iconify:fa6-solid:terminal') // shows under Recent
    if (!looksLikeCurl(q)) return []
    const data = parseCurl(q)
    return [{ key: 'curl:' + q, title: data.ok ? `${data.method} ${data.url}` : 'curl', kind: 'curl', icon: 'iconify:fa6-solid:terminal', panel: CurlPanel, hint: 'Enter: run', data }]
  },
}
