import { historyItems } from '../../core/extensions/host.js'
import { parseQrCommand } from './engine.js'
import { QrPanel } from './Panel.jsx'

// QR code: "qr <text or URL>" shows a live code with error-correction, size, colour and quiet-zone options, a Wi-Fi tab,
// and Copy / Download as PNG or SVG. Ctrl+Enter copies the PNG.
export default {
  items(q) {
    if (!q.trim()) return historyItems('qr', 'QR', 'iconify:fa6-solid:qrcode')
    const data = parseQrCommand(q)
    if (!data) return []
    return [{ key: 'qr:' + q, title: 'QR code', kind: 'qr', icon: 'iconify:fa6-solid:qrcode', panel: QrPanel, hint: 'Ctrl+Enter: copy PNG', data }]
  },
}
