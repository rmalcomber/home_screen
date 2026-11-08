import { describe, it, expect } from 'vitest'
import { readTextFile, readBytesFile, formatBytes } from './file.js'

const file = (bytes, name = 'a.txt') => new File([bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(bytes)], name)

describe('readTextFile', () => {
  it('reads UTF-8 text and strips a byte order mark', async () => {
    const r = await readTextFile(file('﻿hello é'))
    expect(r).toMatchObject({ ok: true, text: 'hello é', name: 'a.txt' })
  })
  it('refuses a file over the limit before reading it', async () => {
    const r = await readTextFile(file('x'.repeat(50)), { max: 10 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/too large/)
  })
  it('refuses binary and non UTF-8 files', async () => {
    expect((await readTextFile(file(new Uint8Array([104, 0, 105])))).error).toMatch(/text file/)
    expect((await readTextFile(file(new Uint8Array([0xff, 0xfe, 0x41])))).error).toMatch(/UTF-8/)
  })
  it('handles a missing file', async () => {
    expect((await readTextFile(null)).ok).toBe(false)
  })
})

describe('readBytesFile', () => {
  it('returns the bytes and enforces its limit', async () => {
    const r = await readBytesFile(file(new Uint8Array([1, 2, 3]), 'b.bin'))
    expect(r.ok).toBe(true)
    expect([...r.bytes]).toEqual([1, 2, 3])
    expect((await readBytesFile(file('abcdef'), { max: 3 })).ok).toBe(false)
  })
})

it('formats sizes', () => {
  expect(formatBytes(12)).toBe('12 B')
  expect(formatBytes(2048)).toBe('2.0 KB')
  expect(formatBytes(50 * 1024)).toBe('50 KB')
  expect(formatBytes(3 * 1048576)).toBe('3.0 MB')
})
