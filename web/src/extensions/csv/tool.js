import { historyItems } from '../../core/extensions/host.js'
import { parseCsvCommand } from './engine.js'
import { CsvPanel } from './Panel.jsx'

// CSV <-> JSON: "csv" + data (or paste multi-line CSV/TSV, e.g. copied from a spreadsheet) converts to JSON;
// JSON pasted after "csv" converts to CSV. Ctrl+Enter copies.
export default {
  items(q) {
    if (!q.trim()) return historyItems('csv', 'CSV', 'iconify:fa6-solid:table')
    const data = parseCsvCommand(q)
    if (!data) return []
    return [{ key: 'csv:' + q, title: 'CSV ⇄ JSON', kind: 'csv', icon: 'iconify:fa6-solid:table', panel: CsvPanel, hint: 'Ctrl+Enter: copy result', data }]
  },
}
