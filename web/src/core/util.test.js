import { describe, it, expect } from 'vitest'
import { rootDomain, parseBookmarks, groupByDomain, parseGithub, compact, tileMatches } from './util.js'

describe('rootDomain', () => {
  it('strips subdomains', () => {
    expect(rootDomain('docs.github.com')).toBe('github.com')
    expect(rootDomain('www.example.com')).toBe('example.com')
    expect(rootDomain('news.bbc.co.uk')).toBe('bbc.co.uk')
    expect(rootDomain('localhost')).toBe('localhost')
    expect(rootDomain('192.168.0.1')).toBe('192.168.0.1')
  })
})

describe('bookmarks', () => {
  const html = `<DL><p><DT><H3>Dev</H3><DL><p>
    <DT><A HREF="https://github.com/a/b">Repo</A>
    <DT><A HREF="https://docs.github.com/x">Docs</A>
    <DT><A HREF="chrome://settings">Settings</A>
    <DT><A HREF="https://bbc.co.uk/news">BBC</A></DL></DL>`
  it('parses and groups', () => {
    const links = parseBookmarks(html)
    expect(links).toHaveLength(3)
    const g = groupByDomain(links)
    expect(g[0]).toMatchObject({ domain: 'github.com' })
    expect(g[0].links).toHaveLength(2)
    expect(g.map((x) => x.domain)).toContain('bbc.co.uk')
  })
})

describe('github', () => {
  it('parses repo', () => {
    expect(parseGithub('https://github.com/rust-lang/rust/pulls')).toMatchObject({ owner: 'rust-lang', repo: 'rust' })
    expect(parseGithub('https://example.com/a/b')).toBeNull()
  })
})

describe('compact', () => {
  it('pushes overlapping tiles down and floats gaps up', () => {
    const t = [
      { id: 1, x: 0, y: 0, w: 6, h: 4 },
      { id: 2, x: 0, y: 10, w: 6, h: 4 },
    ]
    expect(compact(t).get(2).y).toBe(4)
    const m = compact(t, 2, { 2: { x: 0, y: 0 } })
    expect(m.get(2).y).toBe(0)
    expect(m.get(1).y).toBe(4)
  })
})

describe('search', () => {
  it('matches partial urls', () => {
    const t = { title: 'Dev', type: 'bookmarks', config: { links: [{ title: 'x', url: 'https://foo.example.com/bar' }] } }
    expect(tileMatches(t, 'example.com/b')).toBe(true)
    expect(tileMatches(t, 'zzz')).toBe(false)
  })
})

describe('github owner shorthand', () => {
  it('uses default owner for bare repo names', () => {
    expect(parseGithub('my-repo', 'rmalcomber')).toMatchObject({ owner: 'rmalcomber', repo: 'my-repo', base: 'https://github.com/rmalcomber/my-repo' })
    expect(parseGithub('other/thing', 'rmalcomber')).toMatchObject({ owner: 'other', repo: 'thing' })
    expect(parseGithub('my-repo')).toBeNull()
  })
})

describe('devServices', () => {
  it('migrates the old single-service shape', async () => {
    const { devServices } = await import('./util.js')
    expect(devServices({ name: 'A', prod: 'https://a' })).toHaveLength(1)
    expect(devServices({ services: [{}, {}] })).toHaveLength(2)
    expect(devServices({})).toEqual([])
  })
})

describe('launcher ranking', () => {
  it('ranks, filters and routes', async () => {
    const { rank, route, registerProvider } = await import('./launcher/registry.js')
    const items = [
      { key: 1, title: 'GitHub', subtitle: 'https://github.com' },
      { key: 2, title: 'Docs', subtitle: 'https://docs.github.com/x', group: 'Dev' },
      { key: 3, title: 'YouTube', subtitle: 'https://youtube.com' },
    ]
    expect(rank(items, 'git').map((i) => i.key)).toEqual([1, 2])
    expect(rank(items, 'dev docs').map((i) => i.key)).toEqual([2])
    expect(rank(items, 'zzz')).toEqual([])
    registerProvider({ id: 'cmd', name: 'Commands', prefix: '>', items: () => [] })
    expect(route('> add')).toMatchObject({ query: 'add', scoped: { id: 'cmd' } })
    expect(route('add').scoped).toBeNull()
  })
})
