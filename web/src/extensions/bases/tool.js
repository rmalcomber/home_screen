import { copyItem, preview, historyItems } from '../../core/extensions/host.js'
import { parseBasesCommand, parseInteger, baseRows, setBits, parseSize, sizeRows, evalBits, fromBitPositions, basesFill } from './engine.js'

const ICON = 'iconify:fa6-solid:binary'
const RADIX = { hex: 16, bin: 2, oct: 8, dec: 10 }
const NAME = { hex: 'hexadecimal', bin: 'binary', oct: 'octal', dec: 'decimal' }

// Number bases, byte sizes and bit tools: "hex ff", "bin 1010", "oct 755", "dec 255", "base 36 zz", a bare 0xFF / 0b1010 / 0o17,
// "bytes 1.5 GiB", "bits (1<<3)|(1<<5)", "bits set 0 2 5". Enter copies a row.
export default {
  items(q) {
    if (!q.trim()) return historyItems('bases', 'Number', ICON)
    const cmd = parseBasesCommand(q)
    if (!cmd) return []
    const { word, text } = cmd
    if (!text) return []
    const fill = basesFill(word === 'literal' ? '' : word, text.slice(0, 300))
    const error = (title, subtitle) => [{ key: `bases:err:${q}`, title, subtitle, kind: 'Error', icon: ICON, run() {} }]
    const rows = (list, label) =>
      list.map((r) =>
        copyItem({
          key: `bases:${r.id}:${q.trim()}`,
          title: r.value,
          subtitle: [r.label, r.alt].filter(Boolean).join(' · '),
          icon: ICON,
          mono: true,
          text: r.value,
          history: { kind: 'bases', key: `bases:${word}:${text.slice(0, 200)}`, title: `${label} ${preview(text, 40)}`, subtitle: r.value, fill },
        }),
      )

    if (word === 'bytes') {
      const n = parseSize(text)
      return n === null ? error('Not a size', 'Try 1536000, 1.5 GiB or 10mb') : rows(sizeRows(n), 'Size')
    }
    if (word === 'bits') {
      const set = fromBitPositions(text)
      const res = set !== null ? { ok: true, value: set } : evalBits(text)
      if (!res.ok) return error(res.error, 'Try (1<<3)|(1<<5), 0xF0 & 0x3C or set 0 2 5')
      const list = baseRows(res.value)
      if (res.value > 0n) {
        const bits = setBits(res.value)
        list.push({ id: 'set', label: `Bits set (${bits.length})`, value: bits.join(', ') })
      }
      return rows(list, 'Bits')
    }
    let radix = RADIX[word] ?? 10
    let digits = text
    if (word === 'base') {
      const m = /^(\d{1,2})\s+(\S+)$/.exec(text)
      if (m && +m[1] >= 2 && +m[1] <= 36) { radix = +m[1]; digits = m[2] }
    }
    const v = parseInteger(digits, radix)
    if (v === null) return word === 'base' ? [] : error(`Not a valid ${NAME[word] || 'number'}`, `Check the digits${RADIX[word] ? ` (base ${radix})` : ''}`)
    return rows(baseRows(v), 'Number')
  },
}
