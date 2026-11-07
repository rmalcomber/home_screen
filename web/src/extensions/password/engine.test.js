import { describe, it, expect } from 'vitest'
import { randomInt, generate, pools, pin, hexToken, urlToken, entropyBits, strengthLabel, parsePasswordCommand } from './engine.js'

const has = (s, re) => re.test(s)

describe('randomInt', () => {
  it('stays in range and covers every value', () => {
    const seen = new Set()
    for (let i = 0; i < 2000; i++) {
      const n = randomInt(7)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(7)
      seen.add(n)
    }
    expect(seen.size).toBe(7)
    expect(randomInt(1)).toBe(0)
    expect(() => randomInt(0)).toThrow()
  })
})

describe('generate', () => {
  it('has the requested length and every selected class', () => {
    for (let i = 0; i < 200; i++) {
      const p = generate({ length: 12 })
      expect(p).toHaveLength(12)
      expect(has(p, /[a-z]/) && has(p, /[A-Z]/) && has(p, /\d/) && has(p, /[^A-Za-z0-9]/)).toBe(true)
    }
  })
  it('honours the options', () => {
    expect(generate({ length: 40, symbol: false })).toMatch(/^[A-Za-z0-9]{40}$/)
    expect(generate({ length: 40, upper: false, symbol: false })).toMatch(/^[a-z0-9]{40}$/)
    expect(generate({ length: 30, lower: false, upper: false, symbol: false })).toMatch(/^\d{30}$/)
    expect(generate({ length: 200, easy: true })).not.toMatch(/[O0oIl1|]/)
    expect(() => generate({ lower: false, upper: false, digit: false, symbol: false })).toThrow()
  })
  it('clamps the length and is not constant', () => {
    expect(generate({ length: 1 })).toHaveLength(4)
    expect(generate({ length: 9999 })).toHaveLength(256)
    expect(generate({ length: 24 })).not.toBe(generate({ length: 24 }))
  })
  it('is deterministic with an injected generator (guaranteed class placement + shuffle)', () => {
    const rand = () => 0
    expect(generate({ length: 6 }, rand)).toHaveLength(6)
  })
  it('makes PINs and tokens of exact length from the right alphabet', () => {
    expect(pin(8)).toMatch(/^\d{8}$/)
    expect(hexToken(33)).toMatch(/^[0-9a-f]{33}$/)
    expect(urlToken(50)).toMatch(/^[A-Za-z0-9_-]{50}$/)
  })
})

describe('strength and parsing', () => {
  it('estimates entropy', () => {
    expect(entropyBits(10, 10)).toBe(33)
    expect(entropyBits(20, pools().join('').length)).toBeGreaterThan(120)
    expect(strengthLabel(20)).toBe('very weak')
    expect(strengthLabel(50)).toBe('fair')
    expect(strengthLabel(70)).toBe('strong')
    expect(strengthLabel(100)).toBe('very strong')
    expect(strengthLabel(140)).toBe('excellent')
  })
  it('parses the command', () => {
    expect(parsePasswordCommand('password')).toEqual({ length: 20, lengthGiven: false, opts: {} })
    expect(parsePasswordCommand('pw 32 nosymbols easy')).toEqual({ length: 32, lengthGiven: true, opts: { symbol: false, easy: true } })
    expect(parsePasswordCommand('PASSWORD 8')).toMatchObject({ length: 8 })
    expect(parsePasswordCommand('password 2').length).toBe(4)
    expect(parsePasswordCommand('password banana')).toBeNull()
    expect(parsePasswordCommand('password noupper nolower nonum nosym')).toBeNull()
    expect(parsePasswordCommand('passwordless')).toBeNull()
    expect(parsePasswordCommand('pass')).toBeNull()
  })
})
