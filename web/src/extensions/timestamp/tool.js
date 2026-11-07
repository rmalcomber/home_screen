import { historyItems, remember as rememberHistory } from '../../core/extensions/host.js'
import { parseTimestampCommand, formatRows } from './engine.js'

// Timestamp converter: "now", "1700000000" (s/ms/µs/ns by length), "2026-11-06T12:00:00Z", "ts +3d", "ts 1700000000 in Asia/Tokyo".
// Shows unix seconds/ms, ISO (UTC + local), a time zone of your choice, RFC 2822 and a relative time. Enter copies a row.
export default {
  items(q) {
    if (!q.trim()) return historyItems('ts', 'Time', 'iconify:fa6-solid:clock')
    const now = Date.now()
    const cmd = parseTimestampCommand(q, now)
    if (!cmd) return []
    const rows = formatRows(cmd.ms, { zone: cmd.zone, now })
    if (cmd.alt !== undefined) {
      const utc = formatRows(cmd.alt, { now })
      rows.push({ id: 'unix-utc', label: 'Unix seconds, if that was UTC', value: utc[0].value }, { id: 'iso-utc', label: 'ISO 8601, if that was UTC', value: utc[2].value })
    }
    const input = q.trim().replace(/^(?:ts|timestamp|epoch|unix)\s*/i, '') || 'now'
    const iso = rows.find((r) => r.id === 'iso').value
    return rows.map((r, i) => ({
      key: `ts:${r.id}:${cmd.ms}`,
      title: r.value,
      subtitle: `${r.label}${i === 0 ? ' · ' + cmd.note : ''}  ·  Enter to copy`,
      kind: 'Copy',
      recent: false,
      icon: 'iconify:fa6-solid:clock',
      run: () => {
        rememberHistory('ts', { key: `ts:${input}`, title: `Timestamp · ${input.length > 50 ? input.slice(0, 50) + '…' : input}`, subtitle: iso, fill: `ts ${input}` })
        navigator.clipboard?.writeText(r.value).catch(() => {})
      },
    }))
  },
}
