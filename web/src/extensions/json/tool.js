import { parseJson, looksLikeJson, historyItems } from '../../core/extensions/host.js'
import { JsonPanel } from './Panel.jsx'

// JSON formatter: paste JSON (or a JS-style object literal) to pretty-print / minify / sort it. Enter copies the result.
export default {
  items(q) {
    if (!q.trim()) return historyItems('json', 'JSON', 'iconify:fa6-solid:code')
    if (!looksLikeJson(q)) return []
    const data = parseJson(q)
    // Don't hijack short searches like "[wip]": only show the error view for input that is clearly meant to be JSON.
    const t = q.trim()
    const clearlyJson = t[0] === '{' ? t.includes(':') : /[,\n]/.test(t)
    if (!data.ok && t.length < 30 && !clearlyJson) return []
    return [{ key: 'json:' + q, title: 'Format JSON', kind: 'json', icon: 'iconify:fa6-solid:code', panel: JsonPanel, hint: 'Enter: copy', data }]
  },
}
