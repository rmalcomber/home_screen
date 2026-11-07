import { historyItems, parseColorCommand } from '../../core/extensions/host.js'
import { ColorPanel } from './Panel.jsx'

// Colour picker: "color", "color red", "#ff8800", "rgb(255, 136, 0)", "hsl(…)" open a picker with every format, shades,
// harmonies and WCAG contrast. Click any value to copy; Enter copies the HEX.
export default {
  items(q) {
    if (!q.trim()) return historyItems('color', 'Colour', 'iconify:fa6-solid:palette')
    const data = parseColorCommand(q)
    if (!data) return []
    return [{ key: 'color:' + q, title: 'Colour picker', kind: 'color', icon: 'iconify:fa6-solid:palette', panel: ColorPanel, hint: 'Enter: copy HEX · click a value to copy it', data }]
  },
}
