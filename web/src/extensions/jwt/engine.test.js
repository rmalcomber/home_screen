import { describe, it, expect } from 'vitest'
import { extractToken, parseJwt } from './engine.js'

const b64u = (o) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const make = (header, payload, sig = 'c2lnbmF0dXJl') => `${b64u(header)}.${b64u(payload)}.${sig}`
const NOW = Date.UTC(2026, 10, 6, 12, 0, 0)
const sec = (ms) => Math.floor(ms / 1000)

describe('extractToken', () => {
  const t = make({ alg: 'HS256', typ: 'JWT' }, { sub: '1' })
  it('finds tokens in common spellings', () => {
    expect(extractToken(t)).toBe(t)
    expect(extractToken(`Bearer ${t}`)).toBe(t)
    expect(extractToken(`jwt ${t}`)).toBe(t)
    expect(extractToken(`Authorization: Bearer ${t}`)).toBe(t)
    expect(extractToken(`"${t}"`)).toBe(t)
  })
  it('ignores everything else', () => {
    expect(extractToken('hello.world.foo')).toBeNull()
    expect(extractToken('eyJabc.def')).toBeNull()
    expect(extractToken('github')).toBeNull()
  })
})

describe('parseJwt', () => {
  it('decodes header, payload and claims', () => {
    const r = parseJwt(make({ alg: 'HS256', typ: 'JWT' }, { sub: 'ada', iss: 'me', exp: sec(NOW) + 7200, iat: sec(NOW) - 60, name: 'Ada ✓' }), NOW)
    expect(r).toMatchObject({ ok: true, alg: 'HS256', status: 'valid', signature: 'c2lnbmF0dXJl' })
    expect(r.payload.name).toBe('Ada ✓')
    expect(r.claims.find((c) => c.key === 'exp').time.relative).toBe('in 2 hours')
    expect(r.claims.find((c) => c.key === 'iat').time.relative).toBe('1 minute ago')
    expect(r.claims.find((c) => c.key === 'iss').label).toBe('Issuer')
    expect(r.warnings).toEqual([])
  })
  it('reports expired, not-yet-valid and missing expiry', () => {
    expect(parseJwt(make({ alg: 'RS256' }, { exp: sec(NOW) - 86400 * 3 }), NOW).status).toBe('expired')
    expect(parseJwt(make({ alg: 'RS256' }, { exp: sec(NOW) + 9999, nbf: sec(NOW) + 100 }), NOW).status).toBe('not-yet')
    const r = parseJwt(make({ alg: 'RS256' }, { sub: 'x' }), NOW)
    expect(r.status).toBe('no-exp')
    expect(r.warnings.join()).toContain('never expires')
  })
  it('warns about unsigned tokens and rejects garbage', () => {
    expect(parseJwt(make({ alg: 'none' }, { exp: sec(NOW) + 1 }, ''), NOW).warnings.join()).toContain('Unsigned')
    expect(parseJwt('eyJ!!!.abc.def').ok).toBe(false)
  })
})
