import { encode, encodeBytes, decode, parseB64Command } from './engine.js'
import { historyItems, remember as rememberHistory } from '../../core/extensions/host.js'

// Base64: "b64 <text>" encodes (standard + URL-safe) and, when the text is valid base64, decodes. Enter copies the result.
export default {
  /** Base64 of a whole file's bytes (the widget's Open file). */
  fileItems(bytes, name) {
    const mk = (label, value) => ({
      key: `b64:file:${label}`,
      title: value.length > 120 ? value.slice(0, 120) + '…' : value,
      subtitle: `${label} of ${name} (${value.length.toLocaleString('en-GB')} characters)  ·  Enter to copy`,
      kind: 'Copy',
      recent: false,
      icon: 'iconify:fa6-solid:key',
      run: () => navigator.clipboard?.writeText(value).catch(() => {}),
    })
    return [mk('Base64', encodeBytes(bytes)), mk('URL-safe base64 (no padding)', encodeBytes(bytes, { url: true }))]
  },
  items(q) {
    if (!q.trim()) return historyItems('b64', 'Base64', 'iconify:fa6-solid:key')
    const text = parseB64Command(q)
    if (text === null) return []
    const preview = (t) => (t.length > 80 ? t.slice(0, 80) + '…' : t).replace(/\s+/g, ' ')
    const mk = (label, result, copyText) => ({
      key: `b64:${label}:${text}`,
      title: preview(result),
      subtitle: `${label}  ·  Enter to copy`,
      kind: 'Copy',
      recent: false,
      icon: 'iconify:fa6-solid:key',
      run: () => {
        rememberHistory('b64', { key: `b64:${label}:${text.slice(0, 300)}`, title: `b64 ${preview(text)}`, subtitle: label, fill: q.trim() })
        navigator.clipboard?.writeText(copyText ?? result).catch(() => {})
      },
    })
    const dec = decode(text)
    // Decoded text goes first; a binary decode is rarely what you meant for ordinary words, so it comes last.
    return [
      ...(dec?.kind === 'text' ? [mk('Decode base64', dec.text)] : []),
      mk('Encode to base64', encode(text)),
      mk('Encode to URL-safe base64 (no padding)', encode(text, { url: true })),
      ...(dec?.kind === 'binary' ? [mk(`Decode base64 → ${dec.bytes.length} bytes of binary (hex)`, dec.hex)] : []),
    ]
  },
}
