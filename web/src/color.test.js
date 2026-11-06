import { describe, it, expect } from 'vitest'
import { parseColor, toHex, rgbToHsl, hslToRgb, rgbToHsv, rgbToOklch, formats, contrast, shades, harmonies, parseColorCommand } from './launcher/color.js'

describe('parseColor', () => {
  it('parses hex in all lengths', () => {
    expect(parseColor('#f80')).toEqual({ r: 255, g: 136, b: 0, a: 1 })
    expect(parseColor('FF8800')).toEqual({ r: 255, g: 136, b: 0, a: 1 })
    expect(parseColor('#ff880080')).toEqual({ r: 255, g: 136, b: 0, a: 0.502 })
    expect(parseColor('#f808')).toMatchObject({ r: 255, g: 136, b: 0 })
  })
  it('parses rgb and hsl in comma and space syntax', () => {
    expect(parseColor('rgb(255, 136, 0)')).toEqual({ r: 255, g: 136, b: 0, a: 1 })
    expect(parseColor('rgb(255 136 0 / 50%)')).toEqual({ r: 255, g: 136, b: 0, a: 0.5 })
    expect(parseColor('rgba(100%, 0%, 0%, .25)')).toEqual({ r: 255, g: 0, b: 0, a: 0.25 })
    expect(parseColor('hsl(120, 100%, 50%)')).toEqual({ r: 0, g: 255, b: 0, a: 1 })
    expect(parseColor('hsl(0.5turn 100% 50%)')).toEqual({ r: 0, g: 255, b: 255, a: 1 })
  })
  it('rejects junk (no browser canvas in tests)', () => {
    expect(parseColor('')).toBeNull()
    expect(parseColor('rgb(1,2)')).toBeNull()
    expect(parseColor('banana')).toBeNull()
    expect(parseColor('#12')).toBeNull()
  })
})

describe('conversions', () => {
  it('round-trips rgb/hsl/hsv', () => {
    const c = { r: 255, g: 136, b: 0, a: 1 }
    const { h, s, l } = rgbToHsl(c)
    expect([Math.round(h), Math.round(s), Math.round(l)]).toEqual([32, 100, 50])
    expect(hslToRgb(h, s, l)).toEqual({ r: 255, g: 136, b: 0 })
    expect(rgbToHsv(c)).toMatchObject({ s: 100, v: 100 })
    expect(toHex(c)).toBe('#ff8800')
    expect(toHex({ ...c, a: 0.5 }, true)).toBe('#ff880080')
  })
  it('computes OKLCH for known colours', () => {
    const white = rgbToOklch({ r: 255, g: 255, b: 255 })
    expect(white.l).toBeCloseTo(100, 0)
    expect(white.c).toBeLessThan(0.001)
    const red = rgbToOklch({ r: 255, g: 0, b: 0 })
    expect(red.l).toBeCloseTo(62.8, 0)
    expect(red.c).toBeCloseTo(0.258, 2)
    expect(red.h).toBeCloseTo(29.2, 0)
  })
  it('formats every spelling', () => {
    const f = Object.fromEntries(formats({ r: 255, g: 136, b: 0, a: 1 }).map((x) => [x.id, x.value]))
    expect(f).toMatchObject({ hex: '#ff8800', rgb: 'rgb(255, 136, 0)', hsl: 'hsl(32, 100%, 50%)', hsv: 'hsv(32, 100%, 100%)', float: '(1, 0.533, 0)' })
    expect(f.oklch).toMatch(/^oklch\(\d+(\.\d)?% 0\.\d+ \d+(\.\d)?\)$/)
    const a = Object.fromEntries(formats({ r: 255, g: 136, b: 0, a: 0.5 }).map((x) => [x.id, x.value]))
    expect(a).toMatchObject({ hexa: '#ff880080', rgb: 'rgba(255, 136, 0, 0.5)' })
  })
})

describe('analysis', () => {
  it('computes WCAG contrast', () => {
    const black = contrast({ r: 0, g: 0, b: 0 })
    expect(black.white).toMatchObject({ ratio: 21, aa: true, aaa: true })
    expect(black.black.ratio).toBe(1)
    const grey = contrast({ r: 119, g: 119, b: 119 })
    expect(grey.white.ratio).toBeCloseTo(4.48, 1)
    expect(grey.white.aa).toBe(false)
    expect(grey.white.aaLarge).toBe(true)
  })
  it('builds shades and harmonies', () => {
    const c = { r: 255, g: 0, b: 0, a: 1 }
    expect(shades(c)).toHaveLength(9)
    const h = harmonies(c)
    expect(h.find((x) => x.label === 'Complementary').colors[0]).toMatchObject({ r: 0, g: 255, b: 255 })
    expect(h.find((x) => x.label === 'Triad').colors.map((x) => toHex(x))).toEqual(['#00ff00', '#0000ff'])
  })
})

describe('parseColorCommand', () => {
  it('recognises colour input', () => {
    expect(parseColorCommand('color')).toEqual({ rgba: null })
    expect(parseColorCommand('colour #f80').rgba).toMatchObject({ r: 255, g: 136, b: 0 })
    expect(parseColorCommand('#ff8800').rgba).toMatchObject({ g: 136 })
    expect(parseColorCommand('rgb(1, 2, 3)').rgba).toMatchObject({ b: 3 })
    expect(parseColorCommand('color nonsense').error).toMatch(/Couldn't read/)
  })
  it('ignores everything else', () => {
    expect(parseColorCommand('colorado')).toBeNull()
    expect(parseColorCommand('colours of the wind')).toBeNull()
    expect(parseColorCommand('#xyz')).toBeNull()
    expect(parseColorCommand('github')).toBeNull()
  })
})
