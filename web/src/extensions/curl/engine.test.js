import { describe, it, expect } from 'vitest'
import { shellSplit, parseCurl, runPayload, looksLikeCurl } from './engine.js'

const devtools = `curl 'https://api.example.com/v1/items?limit=10&q=a%20b' \\
  -H 'accept: application/json' \\
  -H 'authorization: Bearer abc' \\
  --data-raw '{"a":1,"b":[2]}' -X POST`

describe('shellSplit', () => {
  it('handles quotes and escapes', () => {
    expect(shellSplit(`a 'b c' "d \\"e\\"" f\\-g`)).toEqual(['a', 'b c', 'd "e"', 'f-g'])
    // backslash + whitespace is deliberately a (possibly flattened) line continuation, not an escaped space
    expect(shellSplit(`a \\ b`)).toEqual(['a', 'b'])
    expect(shellSplit(`$'x\\ny\\x41'`)).toEqual(['x\nyA'])
    expect(() => shellSplit(`'oops`)).toThrow()
  })
})

describe('parseCurl', () => {
  it('parses a DevTools style multi-line command', () => {
    for (const cmd of [devtools, devtools.replace(/\\\n/g, '\\ ')]) {
      const p = parseCurl(cmd)
      expect(p.ok).toBe(true)
      expect(p.method).toBe('POST')
      expect(p.origin).toBe('https://api.example.com')
      expect(p.path).toBe('/v1/items')
      expect(p.params).toEqual([['limit', '10'], ['q', 'a b']])
      expect(p.headers).toEqual([['accept', 'application/json'], ['authorization', 'Bearer abc'], ['Content-Type', 'application/x-www-form-urlencoded']])
      expect(p.implied).toEqual(['Content-Type'])
      expect(p.bodyKind).toBe('json')
      expect(p.bodyPretty).toContain('"a": 1')
    }
  })
  it('handles flags, bundles, auth and -G', () => {
    const p = parseCurl(`curl -sSL -k -u bob:pw -A tester https://x.test/a -H "X-Id: 7"`)
    expect(p).toMatchObject({ method: 'GET', follow: true, insecure: true, user: 'bob' })
    expect(p.headers).toContainEqual(['User-Agent', 'tester'])
    expect(p.headers).toContainEqual(['Authorization', 'Basic Ym9iOnB3'])
    const g = parseCurl(`curl -G x.test/s -d q=1 --data-urlencode "n=a b"`)
    expect(g.url).toBe('http://x.test/s?q=1&n=a%20b')
    expect(g.method).toBe('GET')
    expect(g.body).toBeNull()
  })
  it('supports --json, -I and -XPOST attached values', () => {
    const j = parseCurl(`curl --json '{"k":true}' https://x.test`)
    expect(j.method).toBe('POST')
    expect(j.headers).toContainEqual(['Content-Type', 'application/json'])
    expect(parseCurl(`curl -I https://x.test`).method).toBe('HEAD')
    expect(parseCurl(`curl -XPUT https://x.test`).method).toBe('PUT')
  })
  it('reports problems', () => {
    expect(parseCurl('curl').ok).toBe(false)
    expect(parseCurl('curl -F a=b https://x.test').unsupported).toBe(true)
    expect(parseCurl('wget x').ok).toBe(false)
  })
  it('merges duplicate headers for the run payload', () => {
    const p = parseCurl(`curl https://x.test -H 'Cookie: a=1' -H 'cookie: b=2' -H 'X: 1' -H 'x: 2'`)
    const r = runPayload(p)
    expect(r.headers).toEqual([['Cookie', 'a=1; b=2'], ['X', '1, 2']])
    expect(looksLikeCurl('  curl x')).toBe(true)
    expect(looksLikeCurl('curling')).toBe(false)
  })
})
