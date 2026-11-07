import { describe, it, expect } from 'vitest'
import { ENGINES, searchUrl, parseWebCommand, webFill } from './engine.js'

const byId = (id) => ENGINES.find((e) => e.id === id)

describe('engines', () => {
  it('are well formed', () => {
    expect(ENGINES.length).toBeGreaterThanOrEqual(20)
    expect(new Set(ENGINES.map((e) => e.id)).size).toBe(ENGINES.length)
    const words = ENGINES.flatMap((e) => e.words)
    expect(new Set(words).size).toBe(words.length)
    expect(words).not.toContain('search')
    for (const e of ENGINES) {
      expect(e.url, e.id).toMatch(/^https:\/\//)
      expect(e.url.split('%s').length - 1, e.id).toBe(1)
      expect(e.words.length, e.id).toBeGreaterThan(0)
      for (const w of e.words) expect(w, e.id).toMatch(/^[a-z0-9]+$/)
      expect(() => new URL(searchUrl(e, 'test')), e.id).not.toThrow()
    }
  })
  it('has the ones people expect', () => {
    for (const w of ['google', 'bing', 'duckduckgo', 'ddg', 'brave', 'ecosia', 'startpage', 'youtube', 'wikipedia', 'github', 'stackoverflow', 'mdn', 'npm', 'crates']) {
      expect(parseWebCommand(`${w} x`)?.engine, w).toBeTruthy()
    }
  })
})

describe('searchUrl', () => {
  it('encodes the search text', () => {
    expect(searchUrl(byId('google'), 'rust lifetimes')).toBe('https://www.google.com/search?q=rust%20lifetimes')
    expect(searchUrl(byId('google'), 'c++ & rust = ?')).toBe('https://www.google.com/search?q=c%2B%2B%20%26%20rust%20%3D%20%3F')
    expect(searchUrl(byId('ddg'), 'ünï 😀')).toBe('https://duckduckgo.com/?q=%C3%BCn%C3%AF%20%F0%9F%98%80')
    expect(searchUrl(byId('google'), '  padded  ')).toBe('https://www.google.com/search?q=padded')
  })
  it('cannot be tricked into a different URL', () => {
    const u = new URL(searchUrl(byId('google'), 'x&evil=1#frag/../..'))
    expect(u.hostname).toBe('www.google.com')
    expect(u.searchParams.get('q')).toBe('x&evil=1#frag/../..')
    expect(u.searchParams.has('evil')).toBe(false)
    expect(u.hash).toBe('')
  })
  it('works for engines with the text in the path', () => {
    expect(searchUrl(byId('maps'), 'cafe near me')).toBe('https://www.google.com/maps/search/cafe%20near%20me')
  })
})

describe('parseWebCommand', () => {
  it('finds the engine and the text', () => {
    expect(parseWebCommand('google rust lifetimes')).toMatchObject({ engine: { id: 'google' }, term: 'rust lifetimes' })
    expect(parseWebCommand('  DDG  duck  ')).toMatchObject({ engine: { id: 'ddg' }, term: 'duck' })
    expect(parseWebCommand('yt lofi\nbeats')).toMatchObject({ engine: { id: 'youtube' }, term: 'lofi\nbeats' })
    expect(parseWebCommand('gh home_screen')).toMatchObject({ engine: { id: 'github' } })
    expect(parseWebCommand('so rust borrow checker')).toMatchObject({ engine: { id: 'stackoverflow' } })
  })
  it('lists every engine for "search"', () => {
    expect(parseWebCommand('search rust')).toEqual({ engine: null, term: 'rust' })
  })
  it('needs some text and a known word first', () => {
    for (const q of ['', 'google', 'google   ', 'googled it', 'rust google', 'https://google.com', 'unknown term', 'search', '1+1', 'googlex y']) expect(parseWebCommand(q), q).toBeNull()
  })
  it('builds the fill text', () => {
    expect(webFill(byId('google'), 'x y')).toBe('google x y')
    expect(webFill(null, 'x y')).toBe('search x y')
  })
})
