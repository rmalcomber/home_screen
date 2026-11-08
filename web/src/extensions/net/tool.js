import { historyItems } from '../../core/extensions/host.js'
import { parseNetCommand, describeCommand } from './engine.js'
import { NetPanel } from './Panel.jsx'

const ICON = { ping: 'iconify:fa6-solid:tower-broadcast', trace: 'iconify:fa6-solid:route', dns: 'iconify:fa6-solid:server' }

// Network tools: "ping example.com", "trace example.com", "dns example.com MX @1.1.1.1" open a panel; press Enter in it to run the
// check (from the machine running Home Screen, never while you type).
export default {
  items(q) {
    if (!q.trim()) return historyItems('net', 'Network', ICON.ping)
    const cmd = parseNetCommand(q)
    if (!cmd) return []
    return [{ key: 'net:' + q, title: describeCommand(cmd), kind: 'net', icon: ICON[cmd.op], panel: NetPanel, hint: 'Enter: run it', data: { cmd } }]
  },
}
