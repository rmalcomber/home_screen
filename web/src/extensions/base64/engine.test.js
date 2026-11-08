import { describe, it, expect } from 'vitest'
import { encode, encodeBytes, decode, parseB64Command } from './engine.js'

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

describe('encodeBytes', () => {
  it('encodes raw bytes, standard and URL-safe, and round trips through decode', () => {
    expect(encodeBytes(new Uint8Array([0, 255, 254, 250]))).toBe('AP/++g==')
    expect(encodeBytes(new Uint8Array([0, 255, 254, 250]), { url: true })).toBe('AP_--g')
    expect([...decode(encodeBytes(new Uint8Array([0, 255, 254, 250]))).bytes]).toEqual([0, 255, 254, 250])
  })
  it('handles files bigger than the call-stack limit for spread arguments', () => {
    expect(encodeBytes(new Uint8Array(500_000)).length).toBe(Math.ceil(500_000 / 3) * 4)
  })
})
