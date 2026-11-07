// Colour parsing, conversion and analysis for the launcher / colour widget. Pure except the optional canvas fallback.
// A colour is { r, g, b, a } with r,g,b in 0–255 and a in 0–1.

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const rnd = (n, d = 0) => Number(n.toFixed(d))

function fromHex(s) {
  const m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s)
  if (!m) return null
  let h = m[1]
  if (h.length <= 4) h = [...h].map((c) => c + c).join('')
  const n = (i) => parseInt(h.slice(i, i + 2), 16)
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? rnd(n(6) / 255, 3) : 1 }
}

const num = (t, scale = 1) => (t.endsWith('%') ? (parseFloat(t) / 100) * scale : parseFloat(t))
const parts = (inner) => inner.trim().split(/[\s,/]+/).filter(Boolean)

function hslToRgbRaw(h, s, l) {
  h = ((h % 360) + 360) % 360
  s = clamp(s, 0, 1)
  l = clamp(l, 0, 1)
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }
}

/** Parse hex, rgb()/rgba(), hsl()/hsla(); other CSS colours (names, oklch…) are resolved by the browser when available. */
export function parseColor(input, allowCanvas = true) {
  const s = (input || '').trim().toLowerCase()
  if (!s) return null
  const hex = fromHex(s)
  if (hex) return hex
  let m = /^rgba?\(\s*([^)]+)\)$/.exec(s)
  if (m) {
    const p = parts(m[1])
    if (p.length < 3 || p.length > 4) return null
    const [r, g, b] = p.slice(0, 3).map((t) => clamp(Math.round(num(t, 255)), 0, 255))
    const a = p[3] === undefined ? 1 : clamp(num(p[3], 1), 0, 1)
    return [r, g, b, a].some(Number.isNaN) ? null : { r, g, b, a: rnd(a, 3) }
  }
  m = /^hsla?\(\s*([^)]+)\)$/.exec(s)
  if (m) {
    const p = parts(m[1])
    if (p.length < 3 || p.length > 4) return null
    let h = parseFloat(p[0])
    if (p[0].endsWith('turn')) h *= 360
    const sat = num(p[1], 1)
    const lig = num(p[2], 1)
    const a = p[3] === undefined ? 1 : clamp(num(p[3], 1), 0, 1)
    if ([h, sat, lig, a].some(Number.isNaN)) return null
    return { ...hslToRgbRaw(h, sat > 1 ? sat / 100 : sat, lig > 1 ? lig / 100 : lig), a: rnd(a, 3) }
  }
  if (!allowCanvas || typeof document === 'undefined') return null
  // names, oklch(), lab(), color-mix()… : let the browser resolve it (two sentinels detect invalid input)
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    ctx.fillStyle = '#010203'
    ctx.fillStyle = s
    const a = ctx.fillStyle
    ctx.fillStyle = '#040506'
    ctx.fillStyle = s
    if (a !== ctx.fillStyle) return null
    return parseColor(a, false)
  } catch {
    return null
  }
}

export const toHex = ({ r, g, b, a = 1 }, withAlpha = false) => {
  const h = (n) => Math.round(n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}${withAlpha ? h(a * 255) : ''}`
}

export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return { h: 0, s: 0, l: l * 100 }
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 }
}

export const hslToRgb = (h, s, l) => hslToRgbRaw(h, s / 100, l / 100)

export function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  const h = !d ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: max ? (d / max) * 100 : 0, v: max * 100 }
}

export function rgbToOklch({ r, g, b }) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(A, Bb)
  return { l: L * 100, c: C, h: C < 0.0004 ? 0 : ((Math.atan2(Bb, A) * 180) / Math.PI + 360) % 360 }
}

/** Every format worth copying: [{ id, label, value }]. */
export function formats(c) {
  const hsl = rgbToHsl(c)
  const hsv = rgbToHsv(c)
  const ok = rgbToOklch(c)
  const alpha = c.a < 1
  const A = rnd(c.a, 2)
  const rows = [
    { id: 'hex', label: 'HEX', value: toHex(c) },
    ...(alpha ? [{ id: 'hexa', label: 'HEX + alpha', value: toHex(c, true) }] : []),
    { id: 'rgb', label: 'RGB', value: alpha ? `rgba(${c.r}, ${c.g}, ${c.b}, ${A})` : `rgb(${c.r}, ${c.g}, ${c.b})` },
    { id: 'hsl', label: 'HSL', value: `${alpha ? 'hsla' : 'hsl'}(${rnd(hsl.h)}, ${rnd(hsl.s)}%, ${rnd(hsl.l)}%${alpha ? `, ${A}` : ''})` },
    { id: 'hsv', label: 'HSV', value: `hsv(${rnd(hsv.h)}, ${rnd(hsv.s)}%, ${rnd(hsv.v)}%)` },
    { id: 'oklch', label: 'OKLCH', value: `oklch(${rnd(ok.l, 1)}% ${rnd(ok.c, 3)} ${rnd(ok.h, 1)}${alpha ? ` / ${A}` : ''})` },
    { id: 'float', label: 'Float RGB', value: `(${rnd(c.r / 255, 3)}, ${rnd(c.g / 255, 3)}, ${rnd(c.b / 255, 3)}${alpha ? `, ${A}` : ''})` },
  ]
  return rows
}

const lum = ({ r, g, b }) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** WCAG contrast of the colour as text on white and on black. */
export function contrast(c) {
  const L = lum(c)
  const one = (other) => {
    const ratio = (Math.max(L, other) + 0.05) / (Math.min(L, other) + 0.05)
    return { ratio: rnd(ratio, 2), aa: ratio >= 4.5, aaa: ratio >= 7, aaLarge: ratio >= 3 }
  }
  return { white: one(1), black: one(0) }
}

/** 9 lightness steps with the same hue and saturation. */
export function shades(c) {
  const { h, s } = rgbToHsl(c)
  return [95, 85, 75, 65, 55, 45, 35, 25, 15].map((l) => ({ ...hslToRgb(h, s, l), a: c.a }))
}

/** Colour-wheel relatives (same saturation and lightness). */
export function harmonies(c) {
  const { h, s, l } = rgbToHsl(c)
  const at = (d) => ({ ...hslToRgb(h + d, s, l), a: c.a })
  return [
    { label: 'Complementary', colors: [at(180)] },
    { label: 'Analogous', colors: [at(-30), at(30)] },
    { label: 'Triad', colors: [at(120), at(240)] },
    { label: 'Split complementary', colors: [at(150), at(210)] },
  ]
}

/** "color", "color red", "#ff8800", "rgb(1,2,3)" … → { rgba } | { error } | null. rgba is null for a bare "color". */
export function parseColorCommand(q) {
  const t = (q || '').trim()
  const m = /^(?:colou?r|picker)(?:\s+([\s\S]*))?$/i.exec(t)
  if (m) {
    const rest = (m[1] || '').trim()
    if (!rest) return { rgba: null }
    const c = parseColor(rest)
    return c ? { rgba: c } : { error: `Couldn't read "${rest}" as a colour` }
  }
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(t) || /^(rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(.+\)$/i.test(t)) {
    const c = parseColor(t)
    return c ? { rgba: c } : null
  }
  return null
}
