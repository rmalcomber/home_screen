import { describe, it, expect } from 'vitest'
import { urlKey, cleanUrl, parseWeb, isLocalHost, collectLinks } from './links.js'
import { findDuplicates, findOrganise, findFromChecks, scan } from './findings.js'

const T = (id, type, config, extra = {}) => ({ id, type, title: `T${id}`, config, page_id: 1, parent_id: null, ...extra })
const pages = [{ id: 1, name: 'Home' }, { id: 2, name: 'Work' }]
const mk = (links) => links.map(([title, url]) => ({ title, url }))

describe('urlKey', () => {
  it('is the same for links that go to the same place', () => {
    const same = [
      'https://example.com/a',
      'http://example.com/a',
      'https://www.example.com/a/',
      'HTTPS://Example.COM/a#section',
      'https://example.com:443/a',
      'https://example.com/a?utm_source=x&fbclid=y',
      '  https://example.com/a  ',
    ]
    for (const u of same) expect(urlKey(u), u).toBe('example.com/a')
  })
  it('keeps what matters: path, other ports and parameters (in any order)', () => {
    expect(urlKey('https://example.com/a')).not.toBe(urlKey('https://example.com/b'))
    expect(urlKey('https://example.com:8080/')).toBe('example.com:8080')
    expect(urlKey('https://example.com/?b=2&a=1')).toBe(urlKey('https://example.com/?a=1&b=2'))
    expect(urlKey('https://example.com/?a=1')).not.toBe(urlKey('https://example.com/?a=2'))
    expect(urlKey('https://example.com/')).toBe('example.com')
  })
  it('is empty for anything that is not a web address', () => {
    for (const u of ['', 'nope', 'ftp://x.com/a', 'mailto:a@b.c', 'javascript:alert(1)', undefined]) expect(urlKey(u)).toBe('')
  })
})

describe('cleanUrl, parseWeb, isLocalHost', () => {
  it('removes tracking parameters and nothing else', () => {
    expect(cleanUrl('https://a.com/p?utm_source=x&id=7&fbclid=z')).toBe('https://a.com/p?id=7')
    expect(cleanUrl('https://a.com/p?utm_medium=x')).toBe('https://a.com/p')
    expect(cleanUrl('https://a.com/p?id=7')).toBe('https://a.com/p?id=7')
    expect(cleanUrl('not a url')).toBe('not a url')
  })
  it('parses only http and https', () => {
    expect(parseWeb('https://a.com')).not.toBeNull()
    expect(parseWeb('ftp://a.com')).toBeNull()
    expect(parseWeb('a.com')).toBeNull()
  })
  it('knows local addresses', () => {
    for (const h of ['localhost', 'nas.local', '192.168.1.5', '10.0.0.1', '127.0.0.1', '172.20.1.1', 'router', '::1', 'fd00::1', 'app.internal']) expect(isLocalHost(h), h).toBe(true)
    for (const h of ['example.com', '8.8.8.8', '172.32.0.1', '2606:4700::1', '']) expect(isLocalHost(h), h).toBe(false)
  })
})

describe('collectLinks', () => {
  const tiles = [
    T(1, 'bookmarks', { links: mk([['A', 'https://a.com'], ['B', 'https://b.com']]) }),
    T(2, 'dev', { services: [{ name: 'API', dev: 'http://localhost:3000', stage: '', prod: 'https://api.example.com' }] }),
    T(3, 'github', { owner: 'me', repos: [{ url: 'tool' }, { url: 'https://github.com/x/y.git' }, { url: '' }] }),
    T(4, 'widget', { kind: 'clock' }),
    T(5, 'bookmarks', { links: mk([['C', 'https://c.com']]) }, { page_id: 2, parent_id: 9 }),
    T(9, 'group', {}, { title: 'Stuff' }),
  ]
  it('lists every link with where it lives', () => {
    const l = collectLinks(tiles, pages)
    expect(l.map((x) => x.url)).toEqual(['https://a.com', 'https://b.com', 'http://localhost:3000', 'https://api.example.com', 'https://github.com/me/tool', 'https://github.com/x/y', 'https://c.com'])
    expect(l[2].ref).toEqual({ kind: 'dev', index: 0, env: 'dev' })
    expect(l[2].title).toBe('API (dev)')
    expect(l[4].ref).toEqual({ kind: 'github', index: 0 })
    expect(l[6]).toMatchObject({ pageName: 'Work', groupTitle: 'Stuff', tileId: 5 })
  })
  it('copes with the old single-service developer tile and empty configs', () => {
    expect(collectLinks([T(1, 'dev', { name: 'x', prod: 'https://p.com' }), T(2, 'bookmarks', {}), T(3, 'github', {})], pages).map((x) => x.url)).toEqual(['https://p.com'])
  })
})

describe('findDuplicates', () => {
  const tiles = [
    T(1, 'bookmarks', { links: mk([['Docs', 'http://example.com/docs'], ['Docs again', 'https://www.example.com/docs/'], ['Other', 'https://other.com']]) }),
    T(2, 'bookmarks', { links: mk([['Docs 3', 'https://example.com/docs?utm_source=a'], ['Mine', 'https://mine.com']]) }, { page_id: 2 }),
  ]
  it('keeps the https one and offers the others for removal, across tiles and pages', () => {
    const f = findDuplicates(collectLinks(tiles, pages))
    expect(f).toHaveLength(2)
    expect(f.map((x) => x.title).sort()).toEqual(['Docs', 'Docs 3'])
    expect(f.every((x) => x.on && x.actions[0].type === 'remove')).toBe(true)
    expect(f.find((x) => x.title === 'Docs').kind).toBe('duplicate in tile')
    expect(f.find((x) => x.title === 'Docs 3').note).toContain('Docs again')
  })
  it('ignores the same address in different environments of a developer tile', () => {
    const t = [T(1, 'dev', { services: [{ name: 'a', dev: 'https://x.com', stage: 'https://x.com', prod: 'https://x.com' }] })]
    expect(findDuplicates(collectLinks(t, pages))).toEqual([])
  })
  it('finds nothing in a clean dashboard', () => {
    expect(findDuplicates(collectLinks([T(1, 'bookmarks', { links: mk([['A', 'https://a.com'], ['B', 'https://b.com']]) })], pages))).toEqual([])
  })
})

describe('findOrganise', () => {
  it('offers tracking clean-up, titles, bad links and empty tiles', () => {
    const tiles = [
      T(1, 'bookmarks', { links: mk([['Tracked', 'https://a.com/x?utm_source=n&id=1'], ['', 'https://www.b.com/'], ['https://c.com', 'https://c.com'], ['Bad', 'a.com']]) }),
      T(2, 'bookmarks', { links: [] }),
    ]
    const f = findOrganise(tiles, collectLinks(tiles, pages))
    const by = (k) => f.filter((x) => x.kind === k)
    expect(by('tracking parameters')[0].actions[0]).toMatchObject({ type: 'url', url: 'https://a.com/x?id=1' })
    expect(by('tracking parameters')[0].on).toBe(true)
    expect(by('no title').map((x) => x.actions[0].title)).toEqual(['b.com', 'c.com'])
    expect(by('not a web address')[0]).toMatchObject({ on: false })
    expect(by('empty tile')[0]).toMatchObject({ on: false, actions: [{ type: 'delete-tile', tileId: 2 }] })
  })
  it('suggests one tile for many links to one site, unless they are already together', () => {
    const spread = [
      T(1, 'bookmarks', { links: mk([['1', 'https://github.com/a'], ['2', 'https://github.com/b'], ['x', 'https://x.com']]) }),
      T(2, 'bookmarks', { links: mk([['3', 'https://docs.github.com/c'], ['4', 'https://gist.github.com/d']]) }),
    ]
    const f = findOrganise(spread, collectLinks(spread, pages)).filter((x) => x.kind === 'group by site')
    expect(f).toHaveLength(1)
    expect(f[0].actions[0]).toMatchObject({ type: 'move', name: 'github.com' })
    expect(f[0].actions[0].refs).toHaveLength(4)
    expect(f[0].on).toBe(false)
    const together = [T(1, 'bookmarks', { links: mk([['1', 'https://github.com/a'], ['2', 'https://github.com/b'], ['3', 'https://github.com/c'], ['4', 'https://github.com/d']]) })]
    expect(findOrganise(together, collectLinks(together, pages)).filter((x) => x.kind === 'group by site')).toEqual([])
  })
  it('does not suggest groups for fewer than four links or for local addresses', () => {
    const t = [T(1, 'bookmarks', { links: mk([['1', 'http://nas.local/a'], ['2', 'http://nas.local/b'], ['3', 'http://nas.local/c'], ['4', 'http://nas.local/d'], ['5', 'https://x.com/1']]) })]
    expect(findOrganise(t, collectLinks(t, pages)).filter((x) => x.kind === 'group by site')).toEqual([])
  })
})

describe('findFromChecks', () => {
  const tiles = [T(1, 'bookmarks', { links: mk([['Gone', 'https://gone.com/a'], ['Moved', 'https://old.com/a'], ['Sign in', 'https://wall.com/a'], ['Fine', 'https://ok.com'], ['Maybe', 'https://blocked.com'], ['Temp', 'https://temp.com']]) }), T(2, 'dev', { services: [{ name: 'S', prod: 'https://gone.com/api' }] })]
  const links = collectLinks(tiles, pages)
  const results = new Map([
    ['https://gone.com/a', { status: 'dead', code: 404, note: 'Not found' }],
    ['https://old.com/a', { status: 'moved', code: 301, to: 'https://new.com/a', note: 'Moved permanently' }],
    ['https://wall.com/a', { status: 'moved', code: 301, to: 'https://wall.com/login', warn: true, note: 'Redirects to a sign-in page' }],
    ['https://ok.com', { status: 'ok' }],
    ['https://blocked.com', { status: 'blocked', code: 403 }],
    ['https://temp.com', { status: 'temp', code: 302, to: 'https://temp.com/x' }],
    ['https://gone.com/api', { status: 'dead' }],
  ])
  it('turns results into findings with safe defaults', () => {
    const f = findFromChecks(links, results)
    expect(f.map((x) => x.title)).toEqual(['Gone', 'Moved', 'Sign in', 'Maybe', 'Temp', 'S (prod)'])
    const get = (t) => f.find((x) => x.title === t)
    expect(get('Gone')).toMatchObject({ on: false, kind: 'Not working', actions: [{ type: 'remove' }] })
    expect(get('Moved')).toMatchObject({ on: true, actions: [{ type: 'url', url: 'https://new.com/a' }] })
    expect(get('Sign in').on).toBe(false)
    expect(get('Maybe')).toMatchObject({ on: false, unsure: true })
    expect(get('Temp').on).toBe(false)
    // a developer tile address can be changed, but not removed as a link
    expect(get('S (prod)').actions).toEqual([])
  })
  it('leaves out ignored links', () => {
    const f = findFromChecks(links, results, new Set([urlKey('https://gone.com/a')]))
    expect(f.map((x) => x.title)).not.toContain('Gone')
  })
})

describe('scan', () => {
  it('runs everything that needs no network', () => {
    const r = scan([T(1, 'bookmarks', { links: mk([['A', 'https://a.com'], ['A2', 'https://a.com/']]) })], pages)
    expect(r.links).toHaveLength(2)
    expect(r.dups).toHaveLength(1)
  })
})
