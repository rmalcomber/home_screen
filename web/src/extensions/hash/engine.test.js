import { describe, it, expect } from 'vitest'
import { webcrypto } from 'node:crypto'
import { md5, digest, digestBytes, parseHashCommand } from './engine.js'

const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
const enc = (s) => new TextEncoder().encode(s)

describe('md5', () => {
  it('matches the RFC 1321 vectors', () => {
    expect(hex(md5(enc('')))).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(hex(md5(enc('abc')))).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(hex(md5(enc('message digest')))).toBe('f96b697d7cb7938d525a2f31aaf161d0')
    expect(hex(md5(enc('The quick brown fox jumps over the lazy dog')))).toBe('9e107d9d372bb6826bd81d3542a419d6')
    // crosses the 55/56/64-byte padding boundaries
    expect(hex(md5(enc('a'.repeat(56))))).toBe('3b0c8ac703f828b04c6c197006d17218')
    expect(hex(md5(enc('1234567890'.repeat(8))))).toBe('57edf4a22be3c955ac49da2e2107b67a')
  })
})

describe('digest', () => {
  it('computes SHA family hashes in hex and base64', async () => {
    const r = await digest('abc', undefined, webcrypto.subtle)
    expect(r.md5.hex).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(r.sha1.hex).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
    expect(r.sha256.hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(r.sha256.b64).toBe('ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=')
    expect(r.sha512.hex.startsWith('ddaf35a193617aba')).toBe(true)
  })
  it('hashes UTF-8', async () => {
    const r = await digest('héllo', ['md5'], webcrypto.subtle)
    expect(r.md5.hex).toBe(hex(md5(enc('héllo'))))
  })
})

describe('parseHashCommand', () => {
  it('parses all-algorithm and single-algorithm forms', () => {
    expect(parseHashCommand('hash hello world\n')).toEqual({ text: 'hello world', ids: null })
    expect(parseHashCommand('SHA-256 abc')).toEqual({ text: 'abc', ids: ['sha256'] })
    expect(parseHashCommand('md5 x')).toEqual({ text: 'x', ids: ['md5'] })
    expect(parseHashCommand('sha1\nline1\nline2').ids).toEqual(['sha1'])
    expect(parseHashCommand('hash')).toBeNull()
    expect(parseHashCommand('hashing x')).toBeNull()
  })
})

describe('digestBytes', () => {
  it('hashes raw bytes, the same as the text path for text', async () => {
    const bytes = enc('abc')
    const r = await digestBytes(bytes, ['md5', 'sha256'], webcrypto.subtle)
    expect(r.md5.hex).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(r.sha256.hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(r).toEqual(await digest('abc', ['md5', 'sha256'], webcrypto.subtle))
  })
  it('hashes bytes that are not valid text, and large files', async () => {
    const r = await digestBytes(new Uint8Array([0, 255, 128]), ['sha1'], webcrypto.subtle)
    expect(r.sha1.hex).toHaveLength(40)
    const big = new Uint8Array(3_000_000).fill(7)
    expect((await digestBytes(big, ['md5'], webcrypto.subtle)).md5.hex).toHaveLength(32)
  })
})
