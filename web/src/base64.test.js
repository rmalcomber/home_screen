import { describe, it, expect } from 'vitest'
import { encode, decode, parseB64Command } from './launcher/base64.js'

describe('base64', () => {
  it('encodes text incl. unicode and url-safe', () => {
    expect(encode('hello')).toBe('aGVsbG8=')
    expect(encode('héllo ✓')).toBe('aMOpbGxvIOKckw==')
    expect(encode('??>>', { url: true })).toBe('Pz8-Pg')
  })
  it('decodes standard, url-safe, unpadded and wrapped input', () => {
    expect(decode('aGVsbG8=')).toEqual({ kind: 'text', text: 'hello' })
    expect(decode('aGVsbG8')).toEqual({ kind: 'text', text: 'hello' })
    expect(decode('Pz8-Pg')).toEqual({ kind: 'text', text: '??>>' })
    expect(decode('aMOpbGxv\nIOKckw==')).toEqual({ kind: 'text', text: 'héllo ✓' })
    expect(decode('aMOpbGxvIOKckw==').text).toBe('héllo ✓')
  })
  it('flags binary and rejects non-base64', () => {
    expect(decode('/+8=')).toMatchObject({ kind: 'binary', hex: 'ffef' })
    expect(decode('not base64!')).toBeNull()
    expect(decode('hello world')).toBeNull() // plain text with a space is not base64
    expect(decode('a')).toBeNull()
    expect(decode('')).toBeNull()
  })
  it('parses the command prefix', () => {
    expect(parseB64Command('b64 hello world')).toBe('hello world')
    expect(parseB64Command('base64   x\ny')).toBe('x\ny')
    expect(parseB64Command('b64')).toBeNull()
    expect(parseB64Command('b64x')).toBeNull()
  })
})
