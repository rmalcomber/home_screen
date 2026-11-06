import { describe, it, expect } from 'vitest'
import { v4, v7, parseUuid, parseUuidCommand, forms, NIL } from './launcher/uuid.js'

const zeros = (n) => new Uint8Array(n)
const ones = (n) => new Uint8Array(n).fill(0xff)

describe('uuid', () => {
  it('generates v4 with version and variant bits', () => {
    expect(v4(zeros)).toBe('00000000-0000-4000-8000-000000000000')
    expect(v4(ones)).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
    expect(v4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('generates v7 that embeds the timestamp and sorts by time', () => {
    const t = Date.UTC(2026, 10, 6, 12, 0, 0)
    const u = v7(t, zeros)
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7000-8000-000000000000$/)
    expect(parseUuid(u).time.getTime()).toBe(t)
    expect(v7(t + 1) > v7(t)).toBe(true)
  })
  it('parses spellings and reports details', () => {
    const a = parseUuid('{550E8400-E29B-41D4-A716-446655440000}')
    expect(a).toMatchObject({ canonical: '550e8400-e29b-41d4-a716-446655440000', version: 4, versionName: 'random', variant: 'RFC 4122 / 9562' })
    expect(parseUuid('urn:uuid:550e8400e29b41d4a716446655440000').canonical).toBe(a.canonical)
    expect(parseUuid(NIL).nil).toBe(true)
    expect(parseUuid('nope')).toBeNull()
    // a v1 UUID carries its creation time
    expect(parseUuid('c232ab00-9414-11ec-b3c8-9f6bdeced846').time.getUTCFullYear()).toBe(2022)
  })
  it('formats and parses commands', () => {
    expect(forms('550e8400-e29b-41d4-a716-446655440000')).toMatchObject({ compact: '550e8400e29b41d4a716446655440000', upper: '550E8400-E29B-41D4-A716-446655440000', braces: '{550E8400-E29B-41D4-A716-446655440000}' })
    expect(parseUuidCommand('uuid')).toEqual({ count: 1 })
    expect(parseUuidCommand('GUID 5')).toEqual({ count: 5 })
    expect(parseUuidCommand('uuid 999')).toEqual({ count: 100 })
    expect(parseUuidCommand('uuid 550e8400-e29b-41d4-a716-446655440000').inspect.version).toBe(4)
    expect(parseUuidCommand('uuid foo')).toBeNull()
    expect(parseUuidCommand('uuidx')).toBeNull()
  })
})
