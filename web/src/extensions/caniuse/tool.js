import { historyItems } from '../../core/extensions/host.js'
import { parseCaniuseCommand } from './engine.js'
import { CaniusePanel } from './Panel.jsx'

const ICON = 'iconify:fa6-solid:globe'

// Can I use: "caniuse grid", "ciu flexbox gap", "caniuse webp" opens a panel with browser support for the feature. The panel
// downloads the public Can I use data the first time (it is kept in the browser afterwards), so the launcher itself never waits
// for the network.
export default {
  items(q) {
    if (!q.trim()) return historyItems('caniuse', 'Can I use', ICON)
    const cmd = parseCaniuseCommand(q)
    if (!cmd) return []
    return [{ key: 'caniuse:' + q, title: 'Can I use', kind: 'caniuse', icon: ICON, panel: CaniusePanel, hint: 'Browser support', data: { text: cmd.text } }]
  },
}
