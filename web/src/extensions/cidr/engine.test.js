import { describe, it, expect } from 'vitest'
import { parseV4, parseV6, parseIp, formatV4, formatV6, parseCidr, block, classify, networkInfo, contains, relation, split, parseCidrQuery, cidrText } from './engine.js'

const info = (text) => Object.fromEntries(networkInfo(parseCidr(text)).map((r) => [r.id, r.value]))

describe('IPv4 and IPv6 parsing', () => {
  it('reads dotted IPv4 and refuses ambiguous forms', () => {
    expect(parseV4('192.168.1.1')).toBe(3232235777n)
    expect(parseV4('0.0.0.0')).toBe(0n)
    expect(formatV4(3232235777n)).toBe('192.168.1.1')
    for (const s of ['256.1.1.1', '1.2.3', '1.2.3.4.5', '01.2.3.4', 'a.b.c.d', '', '1.2.3.-4']) expect(parseV4(s), s).toBeNull()
  })
  it('reads IPv6 in every notation', () => {
    expect(parseV6('::')).toBe(0n)
    expect(parseV6('::1')).toBe(1n)
    expect(parseV6('2001:db8::1')).toBe(parseV6('2001:0DB8:0:0:0:0:0:1'))
    expect(parseV6('::ffff:1.2.3.4')).toBe(0xffff01020304n)
    expect(parseV6('fe80::1%eth0')).toBe(parseV6('fe80::1'))
    for (const s of ['1:2:3:4:5:6:7', '1::2::3', '12345::', 'g::1', ':1:2', '1:2:3:4:5:6:7:8:9', '1.2.3.4', '']) expect(parseV6(s), s).toBeNull()
  })
  it('tells the versions apart', () => {
    expect(parseIp('10.0.0.1')).toEqual({ v: 4, value: 167772161n })
    expect(parseIp('::1').v).toBe(6)
    expect(parseIp('hello')).toBeNull()
  })
})

describe('formatV6', () => {
  it('uses the shortest form', () => {
    const f = (s) => formatV6(parseV6(s))
    expect(f('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1')
    expect(f('0:0:0:0:0:0:0:0')).toBe('::')
    expect(f('0:0:0:0:0:0:0:1')).toBe('::1')
    expect(f('1:0:0:0:0:0:0:0')).toBe('1::')
    expect(f('1:0:0:2:0:0:0:3')).toBe('1:0:0:2::3')
    expect(f('1:0:2:3:4:5:6:7')).toBe('1:0:2:3:4:5:6:7')
    expect(f('::ffff:1.2.3.4')).toBe('::ffff:102:304')
  })
  it('can expand', () => {
    expect(formatV6(parseV6('2001:db8::1'), { expand: true })).toBe('2001:0db8:0000:0000:0000:0000:0000:0001')
  })
})

describe('parseCidr', () => {
  it('reads prefixes, masks and bare addresses', () => {
    expect(parseCidr('10.0.0.0/24')).toEqual({ v: 4, ip: 167772160n, prefix: 24 })
    expect(parseCidr('10.0.0.5')).toMatchObject({ prefix: 32 })
    expect(parseCidr('::1')).toMatchObject({ v: 6, prefix: 128 })
    expect(parseCidr('10.0.0.0/255.255.255.0').prefix).toBe(24)
    expect(parseCidr('10.0.0.0/0.0.0.0').prefix).toBe(0)
    expect(parseCidr('10.0.0.0/255.255.255.255').prefix).toBe(32)
    expect(parseCidr('2001:db8::/32').prefix).toBe(32)
  })
  it('rejects bad input', () => {
    for (const s of ['10.0.0.0/33', '10.0.0.0/255.0.255.0', '2001:db8::/129', '10.0.0.0/', '10.0.0.0/x', 'nope', '10.0.0.0/1.2']) expect(parseCidr(s), s).toBeNull()
  })
})

describe('networkInfo', () => {
  it('describes a /24', () => {
    expect(info('192.168.1.77/24')).toMatchObject({
      address: '192.168.1.77', network: '192.168.1.0/24', mask: '255.255.255.0', wildcard: '0.0.0.255', broadcast: '192.168.1.255',
      first: '192.168.1.1', last: '192.168.1.254', hosts: '254', total: '256', type: 'private network (RFC 1918)',
    })
  })
  it('does not repeat the address when it is the network', () => {
    expect(info('10.0.0.0/8').address).toBeUndefined()
    expect(info('10.0.0.0/8')).toMatchObject({ total: '16,777,216', hosts: '16,777,214', mask: '255.0.0.0' })
  })
  it('handles /31, /32 and /0', () => {
    expect(info('10.0.0.0/31')).toMatchObject({ first: '10.0.0.0', last: '10.0.0.1' })
    expect(info('10.0.0.0/31').hosts).toContain('2')
    expect(info('10.0.0.9/32')).toMatchObject({ total: '1' })
    expect(info('10.0.0.9/32').hosts).toContain('1')
    expect(info('0.0.0.0/0')).toMatchObject({ total: '4,294,967,296', mask: '0.0.0.0', wildcard: '255.255.255.255' })
  })
  it('shows the binary form', () => {
    expect(info('192.168.1.0/24').bin).toBe('11000000.10101000.00000001.00000000 / 11111111.11111111.11111111.00000000')
  })
  it('describes IPv6 blocks', () => {
    expect(info('2001:db8::/32')).toMatchObject({
      network: '2001:db8::/32', last: '2001:db8:ffff:ffff:ffff:ffff:ffff:ffff', total: '79,228,162,514,264,337,593,543,950,336', type: 'documentation',
      expanded: '2001:0db8:0000:0000:0000:0000:0000:0000',
    })
    expect(info('::ffff:10.1.2.3/128').v4).toBe('10.1.2.3')
  })
})

describe('classify', () => {
  const kind = (s) => {
    const c = parseCidr(s)
    return classify(c.v, c.ip)
  }
  it('names well-known ranges', () => {
    expect(kind('127.0.0.1')).toBe('loopback')
    expect(kind('172.20.1.1')).toContain('private')
    expect(kind('172.32.0.1')).toBe('public internet address')
    expect(kind('169.254.1.1')).toBe('link-local')
    expect(kind('224.0.0.1')).toBe('multicast')
    expect(kind('255.255.255.255')).toBe('limited broadcast')
    expect(kind('100.64.0.1')).toContain('carrier')
    expect(kind('8.8.8.8')).toBe('public internet address')
    expect(kind('::1')).toBe('loopback')
    expect(kind('fe80::1')).toBe('link-local')
    expect(kind('fd12:3456::1')).toContain('unique local')
    expect(kind('2606:4700::1')).toBe('global unicast')
  })
})

describe('contains, relation and split', () => {
  const c = (s) => parseCidr(s)
  it('checks membership', () => {
    expect(contains(c('10.0.0.0/24'), parseIp('10.0.0.200'))).toBe(true)
    expect(contains(c('10.0.0.0/24'), parseIp('10.0.1.0'))).toBe(false)
    expect(contains(c('10.0.0.0/24'), parseIp('::1'))).toBe(false)
    expect(contains(c('2001:db8::/32'), parseIp('2001:db8:1::5'))).toBe(true)
  })
  it('relates two blocks', () => {
    expect(relation(c('10.0.0.0/24'), c('10.0.0.128/25'))).toBe('a-contains-b')
    expect(relation(c('10.0.0.128/25'), c('10.0.0.0/24'))).toBe('b-contains-a')
    expect(relation(c('10.0.0.0/24'), c('10.0.1.0/24'))).toBe('disjoint')
    expect(relation(c('10.0.0.5/24'), c('10.0.0.0/24'))).toBe('equal')
    expect(relation(c('10.0.0.0/8'), c('::/0'))).toBeNull()
  })
  it('splits into subnets', () => {
    const r = split(c('10.0.0.0/24'), 26)
    expect(r.total).toBe(4n)
    expect(r.subnets.map(cidrText)).toEqual(['10.0.0.0/26', '10.0.0.64/26', '10.0.0.128/26', '10.0.0.192/26'])
    expect(split(c('10.0.0.0/24'), 24)).toBeNull()
    expect(split(c('10.0.0.0/24'), 33)).toBeNull()
    expect(split(c('10.0.0.0/8'), 24, 5).subnets).toHaveLength(5)
    expect(split(c('10.0.0.0/8'), 24, 5).total).toBe(65536n)
    expect(split(c('2001:db8::/32'), 34).subnets.map(cidrText)).toEqual(['2001:db8::/34', '2001:db8:4000::/34', '2001:db8:8000::/34', '2001:db8:c000::/34'])
  })
  it('block covers the whole range', () => {
    // 10.0.0.77/30 is the block 10.0.0.76 - 10.0.0.79
    expect(block(c('10.0.0.77/30'))).toMatchObject({ network: parseV4('10.0.0.76'), last: parseV4('10.0.0.79'), size: 4n })
  })
})

describe('parseCidrQuery', () => {
  it('detects a bare address or network', () => {
    expect(parseCidrQuery('10.0.0.0/24').kind).toBe('info')
    expect(parseCidrQuery('192.168.1.5').kind).toBe('info')
    expect(parseCidrQuery('2001:db8::/32').kind).toBe('info')
    expect(parseCidrQuery('::1').kind).toBe('info')
  })
  it('leaves everything else alone', () => {
    for (const q of ['', 'hello', '1.5', '12:30', 'std::vector', '10/24', 'ip address', 'cat', '1+1', 'deadbeef', '3.14159']) expect(parseCidrQuery(q), q).toBeNull()
  })
  it('reads the command forms', () => {
    expect(parseCidrQuery('cidr 10.0.0.0/24').kind).toBe('info')
    expect(parseCidrQuery('ip 10.0.0.5 in 10.0.0.0/24')).toMatchObject({ kind: 'in' })
    expect(parseCidrQuery('cidr 10.0.0.0/24 contains 10.0.0.9')).toMatchObject({ kind: 'in' })
    expect(parseCidrQuery('subnet 10.0.0.0/24 overlaps 10.0.0.128/25')).toMatchObject({ kind: 'relation' })
    expect(parseCidrQuery('cidr 10.0.0.0/24 vs 10.1.0.0/16')).toMatchObject({ kind: 'relation' })
    expect(parseCidrQuery('cidr 10.0.0.0/24 split 26')).toMatchObject({ kind: 'split', prefix: 26 })
    expect(parseCidrQuery('cidr 10.0.0.0/24 /27')).toMatchObject({ kind: 'split', prefix: 27 })
  })
  it('explains mistakes', () => {
    expect(parseCidrQuery('cidr')).toMatchObject({ kind: 'error' })
    expect(parseCidrQuery('cidr 999.1.1.1/24').error).toContain('999.1.1.1/24')
    expect(parseCidrQuery('cidr 10.0.0.1 in nope/24').kind).toBe('error')
    expect(parseCidrQuery('ip 1.2.3.4 overlaps x').kind).toBe('error')
  })
})
