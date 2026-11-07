import { describe, it, expect } from 'vitest'
import { shortHash, relativeTime } from './text.js'

const NOW = Date.UTC(2026, 10, 6, 12, 0, 0)

describe('relativeTime', () => {
  it('describes past and future times', () => {
    expect(relativeTime(NOW - 3 * 86400000, NOW)).toBe('3 days ago')
    expect(relativeTime(NOW + 30000, NOW)).toBe('in 30 seconds')
  })
})

describe('shortHash', () => {
  it('is stable and distinguishes inputs', () => {
    expect(shortHash('abc')).toBe(shortHash('abc'))
    expect(shortHash('abc')).not.toBe(shortHash('abd'))
    expect(shortHash('')).toBe('45h') // the seed, 5381, in base 36
  })
})
