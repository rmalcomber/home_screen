import { describe, it, expect } from 'vitest'
import { parseTimestampCommand as parse, formatRows, isoLocal } from './engine.js'

const NOW = Date.UTC(2026, 10, 6, 12, 0, 0)
const p = (q) => parse(q, NOW)

describe('numbers', () => {
  it('detects seconds, ms, µs and ns by digit count', () => {
    expect(p('1700000000').ms).toBe(1700000000000)
    expect(p('1700000000123').ms).toBe(1700000000123)
    expect(p('1700000000123456').ms).toBe(1700000000123)
    expect(p('1700000000123456789').ms).toBe(1700000000123)
  })
  it('accepts explicit units, decimals and prefixes', () => {
    expect(p('ts 1700000000.5').ms).toBe(1700000000500)
    expect(p('ts 1700000000000 ms').ms).toBe(1700000000000)
    expect(p('epoch 1700000000 s').ms).toBe(1700000000000)
    expect(p('ts 86400').ms).toBe(86400000)
    expect(p('ts -1').ms).toBe(-1000)
  })
  it('does not claim ordinary short numbers or math', () => {
    expect(p('42')).toBeNull()
    expect(p('12345678')).toBeNull()
    expect(p('1700000000 ms')).toBeNull() // bare numbers need a prefix once a unit is involved
    expect(p('1+1')).toBeNull()
  })
})

describe('now, offsets and dates', () => {
  it('handles now and offsets', () => {
    expect(p('now').ms).toBe(NOW)
    expect(p('ts').ms).toBe(NOW)
    expect(p('ts +3d').ms).toBe(NOW + 3 * 86400000)
    expect(p('now - 90 minutes').ms).toBe(NOW - 90 * 60000)
    expect(p('ts +1.5h').ms).toBe(NOW + 5400000)
    expect(p('+3d')).toBeNull()
  })
  it('parses ISO dates with and without zones', () => {
    expect(p('2026-11-06T12:00:00Z').ms).toBe(NOW)
    expect(p('2026-11-06T13:00:00+01:00').ms).toBe(NOW)
    expect(p('2026-11-06 07:00:00-0500').ms).toBe(NOW)
    const local = p('2026-11-06 12:00')
    expect(local.ms).toBe(new Date(2026, 10, 6, 12, 0, 0).getTime())
    expect(local.alt).toBe(NOW)
    expect(p('2026-11-06T12:00:00.250Z').ms).toBe(NOW + 250)
    expect(p('2026-11-06').alt).toBe(Date.UTC(2026, 10, 6))
  })
  it('falls back to the browser date parser only with a prefix', () => {
    expect(p('ts Nov 6 2026 12:00 UTC').ms).toBe(NOW)
    expect(p('Nov 6 2026')).toBeNull()
    expect(p('ts banana')).toBeNull()
  })
  it('reads an "in <zone>" suffix', () => {
    expect(p('1700000000 in Asia/Tokyo')).toMatchObject({ ms: 1700000000000, zone: 'Asia/Tokyo' })
    expect(p('ts now in UTC').zone).toBe('UTC')
    expect(p('1700000000 in nowhere/land')).toBeNull()
  })
})

describe('formatRows', () => {
  it('lists every representation', () => {
    const rows = Object.fromEntries(formatRows(1700000000123, { now: 1700000000123 + 3 * 86400000 }).map((r) => [r.id, r.value]))
    expect(rows.unix).toBe('1700000000')
    expect(rows.ms).toBe('1700000000123')
    expect(rows.iso).toBe('2023-11-14T22:13:20.123Z')
    expect(rows.rfc).toBe('Tue, 14 Nov 2023 22:13:20 GMT')
    expect(rows.rel).toBe('3 days ago')
    expect(rows.localiso).toMatch(/^2023-11-1[45]T\d\d:\d\d:20\.123[+-]\d\d:\d\d$/)
  })
  it('adds the requested zone', () => {
    const rows = formatRows(1700000000000, { zone: 'Asia/Tokyo' })
    expect(rows.find((r) => r.id === 'zone').value).toMatch(/15 November 2023.*07:13:20/)
  })
  it('formats local ISO with the correct offset', () => {
    const d = new Date(2026, 10, 6, 9, 5, 7, 8)
    expect(isoLocal(d).startsWith('2026-11-06T09:05:07.008')).toBe(true)
  })
})
