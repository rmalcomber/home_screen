// QR code helpers for the launcher and widget. Encoding is done by the `qrcode-generator` library (byte mode, UTF-8);
// this module builds the module matrix, an SVG, and the Wi-Fi payload. Unit tested in qr.test.js.
import qrcode from 'qrcode-generator'

qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'] // so non-ASCII text (é, €, emoji) scans correctly

export const ECC_LEVELS = [
  ['L', 'Low (7%)'],
  ['M', 'Medium (15%)'],
  ['Q', 'Quartile (25%)'],
  ['H', 'High (30%)'],
]
// Byte capacity of a version-40 symbol at each error-correction level.
export const MAX_BYTES = { L: 2953, M: 2331, Q: 1663, H: 1273 }

export const byteLength = (s) => new TextEncoder().encode(s).length

/** Build the module matrix. Throws an Error with a readable message when the data doesn't fit. */
export function buildMatrix(text, ecc = 'M') {
  const bytes = byteLength(text)
  if (bytes > MAX_BYTES[ecc]) throw new Error(`Too much data: ${bytes} bytes, but a QR code at level ${ecc} holds at most ${MAX_BYTES[ecc]}. Try a lower error-correction level or shorter text.`)
  const qr = qrcode(0, ecc)
  qr.addData(text, 'Byte')
  qr.make()
  const n = qr.getModuleCount()
  const rows = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)))
  return { n, rows, version: (n - 17) / 4, bytes }
}

/** SVG path covering every dark module (horizontal runs merged), offset by the quiet-zone margin. */
export function svgPath({ n, rows }, margin = 4) {
  const parts = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!rows[r][c]) continue
      let len = 1
      while (c + len < n && rows[r][c + len]) len++
      parts.push(`M${c + margin} ${r + margin}h${len}v1h-${len}z`)
      c += len - 1
    }
  }
  return parts.join('')
}

/** A standalone SVG document. `size` (px) sets width/height; omit it to let the SVG scale. */
export function toSvg(m, { margin = 4, fg = '#000000', bg = '#ffffff', size } = {}) {
  const total = m.n + margin * 2
  const dims = size ? ` width="${size}" height="${size}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"${dims} shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${bg}"/><path d="${svgPath(m, margin)}" fill="${fg}"/></svg>`
}

/** Draw onto a canvas with a whole number of pixels per module (so edges stay sharp). Returns the canvas size. */
export function drawCanvas(canvas, m, { px = 512, margin = 4, fg = '#000000', bg = '#ffffff' } = {}) {
  const total = m.n + margin * 2
  const scale = Math.max(1, Math.floor(px / total))
  canvas.width = canvas.height = total * scale
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = fg
  for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.rows[r][c]) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale)
  return canvas.width
}

const esc = (s) => s.replace(/([\\;,:"])/g, '\\$1')

/** The text phones read as "join this Wi-Fi network": WIFI:T:WPA;S:ssid;P:password;H:true;; */
export function wifiString({ ssid = '', password = '', security = 'WPA', hidden = false }) {
  if (!ssid) return ''
  const t = security === 'nopass' ? 'nopass' : security
  return `WIFI:T:${t};S:${esc(ssid)};${security === 'nopass' ? '' : `P:${esc(password)};`}${hidden ? 'H:true;' : ''};`
}

/** "qr <text>" / "qrcode <text>" → { text } | null */
export function parseQrCommand(q) {
  const m = /^\s*(?:qr|qrcode)(?:[ \t]+|\r?\n|$)([\s\S]*)$/i.exec(q || '')
  return m ? { text: m[1].replace(/\s+$/, '') } : null
}
