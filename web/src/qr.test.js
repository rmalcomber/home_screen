import { describe, it, expect } from 'vitest'
import { buildMatrix, svgPath, toSvg, wifiString, parseQrCommand, byteLength, MAX_BYTES } from './launcher/qr.js'

describe('buildMatrix', () => {
  it('builds a valid version-1 symbol for short text', () => {
    const m = buildMatrix('hello', 'M')
    expect(m.n).toBe(21)
    expect(m.version).toBe(1)
    expect(m.rows).toHaveLength(21)
    expect(m.rows.every((r) => r.length === 21)).toBe(true)
  })
  it('has the three finder patterns and the timing pattern', () => {
    const { n, rows } = buildMatrix('https://example.com', 'M')
    const finder = (r0, c0) => {
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        const edge = r === 0 || r === 6 || c === 0 || c === 6
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4
        expect(rows[r0 + r][c0 + c], `finder at ${r0},${c0} cell ${r},${c}`).toBe(edge || core)
      }
    }
    finder(0, 0)
    finder(0, n - 7)
    finder(n - 7, 0)
    for (let i = 8; i < n - 8; i++) {
      expect(rows[6][i]).toBe(i % 2 === 0) // horizontal timing
      expect(rows[i][6]).toBe(i % 2 === 0) // vertical timing
    }
    expect(rows[n - 8][8]).toBe(true) // the fixed dark module
  })
  it('grows with the data and with stronger error correction', () => {
    expect(buildMatrix('x'.repeat(100), 'M').version).toBeGreaterThanOrEqual(5)
    expect(buildMatrix('x'.repeat(100), 'H').version).toBeGreaterThan(buildMatrix('x'.repeat(100), 'L').version)
  })
  it('counts UTF-8 bytes, not characters', () => {
    expect(byteLength('€')).toBe(3)
    expect(byteLength('😀')).toBe(4)
    expect(buildMatrix('€€€€€', 'L').bytes).toBe(15)
    // same number of characters, more bytes → bigger symbol
    expect(buildMatrix('€'.repeat(12), 'M').version).toBeGreaterThan(buildMatrix('e'.repeat(12), 'M').version)
  })
  it('is deterministic', () => {
    expect(buildMatrix('same', 'Q').rows).toEqual(buildMatrix('same', 'Q').rows)
    expect(buildMatrix('same', 'Q').rows).not.toEqual(buildMatrix('other', 'Q').rows)
  })
  it('explains when the data does not fit', () => {
    expect(() => buildMatrix('a'.repeat(MAX_BYTES.L + 1), 'L')).toThrow(/Too much data/)
    expect(() => buildMatrix('a'.repeat(MAX_BYTES.L), 'L')).not.toThrow()
    expect(() => buildMatrix('a'.repeat(MAX_BYTES.H + 1), 'H')).toThrow(/at level H/)
  })
})

describe('SVG output', () => {
  const m = { n: 3, rows: [[true, true, false], [false, true, false], [true, false, true]] }
  it('merges horizontal runs into one path', () => {
    expect(svgPath(m, 0)).toBe('M0 0h2v1h-2zM1 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1z')
    expect(svgPath(m, 2)).toContain('M2 2h2v1h-2z')
  })
  it('wraps it in a scalable SVG with a quiet zone', () => {
    const svg = toSvg(m, { margin: 4, fg: '#112233', bg: '#ffeedd' })
    expect(svg).toContain('viewBox="0 0 11 11"')
    expect(svg).toContain('fill="#ffeedd"')
    expect(svg).toContain('fill="#112233"')
    expect(svg.match(/<svg[^>]*>/)[0]).not.toContain('width=') // scales to its container
    expect(toSvg(m, { size: 300 })).toContain('width="300" height="300"')
  })
})

describe('Wi-Fi payload', () => {
  it('formats and escapes', () => {
    expect(wifiString({ ssid: 'Home', password: 'secret' })).toBe('WIFI:T:WPA;S:Home;P:secret;;')
    expect(wifiString({ ssid: 'my;net', password: 'p:w"d,\\', hidden: true })).toBe('WIFI:T:WPA;S:my\\;net;P:p\\:w\\"d\\,\\\\;H:true;;')
    expect(wifiString({ ssid: 'Open', security: 'nopass' })).toBe('WIFI:T:nopass;S:Open;;')
    expect(wifiString({ ssid: 'Old', password: 'x', security: 'WEP' })).toBe('WIFI:T:WEP;S:Old;P:x;;')
    expect(wifiString({ ssid: '' })).toBe('')
  })
})

describe('parseQrCommand', () => {
  it('recognises the prefix', () => {
    expect(parseQrCommand('qr https://example.com')).toEqual({ text: 'https://example.com' })
    expect(parseQrCommand('QRCODE hello world \n')).toEqual({ text: 'hello world' })
    expect(parseQrCommand('qr')).toEqual({ text: '' })
    expect(parseQrCommand('qr\nline1\nline2')).toEqual({ text: 'line1\nline2' })
  })
  it('ignores other words', () => {
    expect(parseQrCommand('qrstuv')).toBeNull()
    expect(parseQrCommand('quartz')).toBeNull()
    expect(parseQrCommand('github')).toBeNull()
  })
})

// Round trip: render the matrix as pixels and decode it with an independent QR reader (jsQR).
import jsQR from 'jsqr'

function decode(m, { margin = 4, scale = 6, invert = false } = {}) {
  const total = m.n + margin * 2
  const size = total * scale
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.floor(y / scale) - margin
    const c = Math.floor(x / scale) - margin
    const dark = r >= 0 && c >= 0 && r < m.n && c < m.n && m.rows[r][c]
    const v = dark !== invert ? 0 : 255
    const i = (y * size + x) * 4
    data[i] = data[i + 1] = data[i + 2] = v
    data[i + 3] = 255
  }
  return jsQR(data, size, size)?.data
}

describe('scannability (decoded with jsQR)', () => {
  it('round-trips URLs, text and every error-correction level', () => {
    for (const text of ['hello', 'https://example.com/a/b?x=1&y=2#frag', 'The quick brown fox jumps over the lazy dog 0123456789']) {
      for (const ecc of ['L', 'M', 'Q', 'H']) expect(decode(buildMatrix(text, ecc)), `${ecc} ${text}`).toBe(text)
    }
  })
  it('round-trips UTF-8 (accents, euro, emoji, CJK)', () => {
    for (const text of ['café', 'Price: €5', 'ok 😀', '日本語のテキスト']) expect(decode(buildMatrix(text, 'M')), text).toBe(text)
  })
  it('round-trips a Wi-Fi payload and larger symbols', () => {
    const wifi = wifiString({ ssid: 'Home;Net', password: 's3cret:pw', hidden: true })
    expect(decode(buildMatrix(wifi, 'M'))).toBe(wifi)
    const long = 'abcdefghij'.repeat(60)
    const m = buildMatrix(long, 'M')
    expect(m.version).toBeGreaterThan(10)
    expect(decode(m)).toBe(long)
  })
  it('scans with no quiet zone only when given enough margin, and with a normal one', () => {
    expect(decode(buildMatrix('margin test', 'M'), { margin: 4 })).toBe('margin test')
    expect(decode(buildMatrix('margin test', 'M'), { margin: 2 })).toBe('margin test')
  })
})
