import { describe, it, expect } from 'vitest'
import { parseNetCommand, cleanHost, describeCommand, fillText, problem, request, pingText, traceText, dnsText, ttlText, readResult } from './engine.js'

describe('parseNetCommand', () => {
  it('reads ping and trace commands, with or without a host', () => {
    expect(parseNetCommand('ping example.com')).toEqual({ op: 'ping', host: 'example.com' })
    expect(parseNetCommand('PING  https://example.com:8080/a?b#c')).toEqual({ op: 'ping', host: 'example.com' })
    expect(parseNetCommand('ping')).toEqual({ op: 'ping', host: '' })
    expect(parseNetCommand('traceroute 8.8.8.8')).toEqual({ op: 'trace', host: '8.8.8.8' })
    expect(parseNetCommand('tracert example.com')).toEqual({ op: 'trace', host: 'example.com' })
    expect(parseNetCommand('trace')).toEqual({ op: 'trace', host: '' })
  })
  it('reads dns commands: type and resolver in any order, PTR for an address', () => {
    expect(parseNetCommand('dns example.com')).toEqual({ op: 'dns', name: 'example.com', type: 'A', resolver: '' })
    expect(parseNetCommand('dns example.com mx')).toEqual({ op: 'dns', name: 'example.com', type: 'MX', resolver: '' })
    expect(parseNetCommand('dig MX example.com @1.1.1.1')).toEqual({ op: 'dns', name: 'example.com', type: 'MX', resolver: '1.1.1.1' })
    expect(parseNetCommand('dns @9.9.9.9 example.com TXT')).toEqual({ op: 'dns', name: 'example.com', type: 'TXT', resolver: '9.9.9.9' })
    expect(parseNetCommand('dns 8.8.8.8')).toMatchObject({ type: 'PTR', name: '8.8.8.8' })
    expect(parseNetCommand('dns 2001:4860:4860::8888')).toMatchObject({ type: 'PTR' })
    expect(parseNetCommand('dns')).toEqual({ op: 'dns', name: '', type: 'A', resolver: '' })
  })
  it('reads the record-type shortcuts only when a host follows', () => {
    expect(parseNetCommand('mx example.com')).toMatchObject({ op: 'dns', type: 'MX', name: 'example.com' })
    expect(parseNetCommand('txt _dmarc.example.com')).toMatchObject({ type: 'TXT', name: '_dmarc.example.com' })
    expect(parseNetCommand('ptr 1.1.1.1')).toMatchObject({ type: 'PTR' })
    expect(parseNetCommand('mx')).toBeNull()
    expect(parseNetCommand('txt file')).toBeNull()
    expect(parseNetCommand('ns lookup')).toBeNull()
    expect(parseNetCommand('mx a b.c')).toBeNull()
  })
  it('reports bad dns input instead of guessing', () => {
    expect(parseNetCommand('dns example.com nonsense')).toMatchObject({ bad: expect.stringContaining('not a record type') })
    expect(parseNetCommand('dns a b c')).toMatchObject({ bad: expect.stringContaining('Unexpected') })
  })
  it('ignores everything else', () => {
    for (const q of ['pingpong', 'hello', 'dnsx example.com', '1+1', 'a example.com', 'tracing x', 'https://example.com']) expect(parseNetCommand(q)).toBeNull()
  })
})

describe('hosts and problems', () => {
  it('cleans a host from a URL or host:port', () => {
    expect(cleanHost('https://user:pw@Example.com:8443/x')).toBe('Example.com')
    expect(cleanHost('example.com:80')).toBe('example.com')
    expect(cleanHost('[::1]:8080')).toBe('::1')
    expect(cleanHost('::1')).toBe('::1')
    expect(cleanHost('')).toBe('')
  })
  it('says what is missing or wrong', () => {
    expect(problem({ op: 'ping', host: '' })).toMatch(/Type a host/)
    expect(problem({ op: 'ping', host: 'a;b' })).toMatch(/not a host/)
    expect(problem({ op: 'trace', host: 'example.com' })).toBe('')
    expect(problem({ op: 'dns', name: '', type: 'A' })).toMatch(/Type a domain/)
    expect(problem({ op: 'dns', name: '_dmarc.example.com', type: 'TXT' })).toBe('')
    expect(problem({ op: 'dns', bad: 'Unexpected "x"' })).toBe('Unexpected "x"')
  })
  it('describes and refills commands', () => {
    const c = parseNetCommand('dns example.com mx @1.1.1.1')
    expect(describeCommand(c)).toBe('DNS MX for example.com')
    expect(fillText(c)).toBe('dns example.com MX @1.1.1.1')
    expect(fillText({ op: 'ping', host: 'a.com' })).toBe('ping a.com')
    expect(describeCommand({ op: 'trace', host: 'a.com' })).toBe('Traceroute to a.com')
  })
  it('builds the server requests', () => {
    expect(request({ op: 'ping', host: 'a.com' })).toEqual(['/api/net/ping', { host: 'a.com', count: 4, timeout: 2000 }])
    expect(request({ op: 'trace', host: 'a.com' })[0]).toBe('/api/net/trace')
    expect(request({ op: 'dns', name: 'a.com', type: 'MX', resolver: '' })).toEqual(['/api/net/dns', { name: 'a.com', type: 'MX' }])
    expect(request({ op: 'dns', name: 'a.com', type: 'MX', resolver: '9.9.9.9' })[1].resolver).toBe('9.9.9.9')
  })
})

describe('text output', () => {
  it('formats a ping', () => {
    const t = pingText({ host: 'a.com', addr: '1.2.3.4', mode: 'icmp', sent: 2, received: 1, loss: 50, min: 10, avg: 10, max: 10, results: [{ seq: 1, ms: 10 }, { seq: 2, error: 'timeout' }] })
    expect(t).toBe('Ping a.com [1.2.3.4] (ICMP)\n#1: 10 ms\n#2: timeout\n2 sent, 1 received, 50% loss; min/avg/max 10/10/10 ms')
    expect(pingText({ host: '1.2.3.4', addr: '1.2.3.4', mode: 'tcp', sent: 1, received: 0, loss: 100, results: [{ seq: 1, error: 'no connection' }] })).toContain('TCP connect time')
  })
  it('formats a traceroute', () => {
    const t = traceText({ host: 'a.com', addr: '1.2.3.4', max_hops: 20, hops: [{ hop: 1, addr: '10.0.0.1', ms: [1.25, null, 3], note: '' }, { hop: 2, addr: null, ms: [null, null, null] }] })
    expect(t.split('\n')[0]).toBe('Traceroute to a.com [1.2.3.4], 20 hops max')
    expect(t).toContain(' 1  10.0.0.1')
    expect(t).toContain('1.3 ms  *  3 ms')
    expect(t.split('\n')[2]).toMatch(/^ 2  \*/)
  })
  it('formats dns answers and ttls', () => {
    expect(dnsText({ answers: [{ name: 'a.com', ttl: 300, type: 'A', data: '1.2.3.4' }] })).toBe('a.com\t300\tA\t1.2.3.4')
    expect([ttlText(30), ttlText(300), ttlText(3600), ttlText(86400), ttlText(90)]).toEqual(['30s', '5m', '1h', '1d', '90s'])
  })
})

describe('readResult', () => {
  it('explains the server answers', () => {
    expect(readResult(200, { addr: 'x' })).toEqual({ ok: true, data: { addr: 'x' } })
    expect(readResult(200, { error: 'boom' })).toEqual({ ok: false, error: 'boom' })
    expect(readResult(403, null).error).toMatch(/localhost/)
    expect(readResult(404, null).error).toMatch(/older/)
    expect(readResult(500, null).error).toMatch(/500/)
  })
})
