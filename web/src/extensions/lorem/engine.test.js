import { describe, it, expect } from 'vitest'
import { generate, toHtml, parseLoremCommand, unitLabel, CLASSIC_SENTENCE } from './engine.js'

// small seeded PRNG so the tests are deterministic
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const wordsOf = (s) => s.split(/\s+/).filter(Boolean)

describe('generate', () => {
  it('makes exact word counts, starting classically when asked', () => {
    expect(generate({ count: 5, unit: 'words' }, { rand: seeded(1) })).toBe('Lorem ipsum dolor sit amet')
    const w = generate({ count: 40, unit: 'words' }, { rand: seeded(2) })
    expect(wordsOf(w)).toHaveLength(40)
    expect(w.startsWith('Lorem ipsum dolor sit amet consectetur adipiscing elit ')).toBe(true)
    const r = generate({ count: 30, unit: 'words' }, { rand: seeded(3), classic: false })
    expect(wordsOf(r)).toHaveLength(30)
    expect(/^[A-Z]/.test(r)).toBe(true)
  })
  it('makes sentences', () => {
    const t = generate({ count: 4, unit: 'sentences' }, { rand: seeded(4) })
    expect(t.startsWith(CLASSIC_SENTENCE)).toBe(true)
    expect(t.match(/\./g)).toHaveLength(4)
    expect(generate({ count: 2, unit: 'sentences' }, { rand: seeded(5), classic: false }).startsWith(CLASSIC_SENTENCE)).toBe(false)
  })
  it('makes paragraphs separated by blank lines', () => {
    const t = generate({ count: 3, unit: 'paragraphs' }, { rand: seeded(6) })
    const ps = t.split('\n\n')
    expect(ps).toHaveLength(3)
    expect(ps[0].startsWith(CLASSIC_SENTENCE)).toBe(true)
    ps.forEach((p) => expect(p.split('. ').length).toBeGreaterThanOrEqual(3))
  })
  it('cuts characters to the exact length', () => {
    for (const n of [1, 10, 140, 500]) expect(generate({ count: n, unit: 'chars' }, { rand: seeded(7) })).toHaveLength(n)
  })
  it('clamps absurd counts', () => {
    expect(wordsOf(generate({ count: 999999, unit: 'words' }, { rand: seeded(8) }))).toHaveLength(5000)
  })
  it('is random by default and never repeats a word back to back', () => {
    expect(generate({ count: 20, unit: 'words' }, { classic: false })).not.toBe(generate({ count: 20, unit: 'words' }, { classic: false }))
    const w = wordsOf(generate({ count: 400, unit: 'words' }, { rand: seeded(9), classic: false }))
    w.slice(1).forEach((x, i) => expect(x.toLowerCase()).not.toBe(w[i].toLowerCase()))
  })
})

describe('html and parsing', () => {
  it('wraps paragraphs', () => {
    expect(toHtml('a\n\nb')).toBe('<p>a</p>\n<p>b</p>')
    expect(toHtml('one line')).toBe('<p>one line</p>')
  })
  it('parses commands', () => {
    expect(parseLoremCommand('lorem')).toEqual({ menu: true })
    expect(parseLoremCommand('Lorem Ipsum')).toEqual({ menu: true })
    expect(parseLoremCommand('lorem 50')).toEqual({ count: 50, unit: 'words' })
    expect(parseLoremCommand('lorem 3p')).toEqual({ count: 3, unit: 'paragraphs' })
    expect(parseLoremCommand('lorem 2 sentences')).toEqual({ count: 2, unit: 'sentences' })
    expect(parseLoremCommand('lorem 200 chars')).toEqual({ count: 200, unit: 'chars' })
    expect(parseLoremCommand('lorem 99999 words')).toEqual({ count: 5000, unit: 'words' })
    expect(parseLoremCommand('lorem 0')).toBeNull()
    expect(parseLoremCommand('lorem 5 furlongs')).toBeNull()
    expect(parseLoremCommand('loremaster')).toBeNull()
    expect(parseLoremCommand('github')).toBeNull()
  })
  it('labels units', () => {
    expect(unitLabel(1, 'paragraphs')).toBe('1 paragraph')
    expect(unitLabel(3, 'paragraphs')).toBe('3 paragraphs')
    expect(unitLabel(1, 'chars')).toBe('1 character')
    expect(unitLabel(20, 'chars')).toBe('20 characters')
  })
})
