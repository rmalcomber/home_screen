import { describe, it, expect } from 'vitest'
import { parseUrlCommand, encodeComponent, encodeFull, decodeComponent, htmlEncode, htmlEncodeAll, htmlDecode, parseUrl, parseable } from './engine.js'

describe('parseUrlCommand', () => {
  it('recognises the command words', () => {
    expect(parseUrlCommand('url a b')).toEqual({ word: 'url', text: 'a b' })
    expect(parseUrlCommand('  URLDecode %41')).toEqual({ word: 'urldecode', text: '%41' })
    expect(parseUrlCommand('html <b>')).toEqual({ word: 'html', text: '<b>' })
    expect(parseUrlCommand('query a=1')).toEqual({ word: 'qs', text: 'a=1' })
    expect(parseUrlCommand('qs')).toEqual({ word: 'qs', text: '' })
  })
  it('ignores everything else', () => {
    for (const q of ['', 'urls are fun', 'htmlx a', 'a url b', 'https://example.com', 'quest', '1+1']) expect(parseUrlCommand(q), q).toBeNull()
  })
})

describe('url encoding', () => {
  it('encodes components and whole URLs differently', () => {
    expect(encodeComponent('a b&c=d/é')).toBe('a%20b%26c%3Dd%2F%C3%A9')
    expect(encodeFull('https://x.dev/a b?q=é')).toBe('https://x.dev/a%20b?q=%C3%A9')
  })
  it('decodes, treating invalid sequences as null', () => {
    expect(decodeComponent('a%20b%26')).toBe('a b&')
    expect(decodeComponent('a+b')).toBe('a+b')
    expect(decodeComponent('a+b', { form: true })).toBe('a b')
    expect(decodeComponent('%E0%A4%A')).toBeNull()
  })
})

describe('html entities', () => {
  it('escapes the five special characters', () => {
    expect(htmlEncode(`<a href="x">Tom & 'Jerry'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;')
  })
  it('can escape non-ASCII as numeric entities', () => {
    expect(htmlEncodeAll('café ✓ 😀')).toBe('caf&#233; &#10003; &#128512;')
  })
  it('decodes numeric, hex and named entities', () => {
    expect(htmlDecode('&lt;b&gt; &amp; &#65;&#x42; &copy; &hellip; &NBSP;')).toBe('<b> & AB © …  ')
    expect(htmlDecode('&unknown; &#xZZ; &#0; &#xD800;')).toBe('&unknown; &#xZZ; &#0; &#xD800;')
  })
  it('round-trips', () => {
    const s = `<p class="a">5 > 3 & 'x'</p>`
    expect(htmlDecode(htmlEncode(s))).toBe(s)
  })
})

describe('parseUrl', () => {
  it('splits a full URL', () => {
    const r = parseUrl('https://user:pw@example.com:8080/a%20b/c?x=1&y=two+words&z#frag%20ment')
    expect(r.ok).toBe(true)
    expect(r.isUrl).toBe(true)
    const p = Object.fromEntries(r.parts)
    expect(p).toMatchObject({ Scheme: 'https', User: 'user', Host: 'example.com', Port: '8080', Path: '/a b/c', Fragment: 'frag ment' })
    expect(p.Password).toBe('••••')
    expect(r.params).toEqual([{ key: 'x', value: '1' }, { key: 'y', value: 'two words' }, { key: 'z', value: '' }])
  })
  it('parses a bare query string, with or without ?', () => {
    expect(parseUrl('?a=1&b=%26').params).toEqual([{ key: 'a', value: '1' }, { key: 'b', value: '&' }])
    expect(parseUrl('a=1&a=2').params).toEqual([{ key: 'a', value: '1' }, { key: 'a', value: '2' }])
    expect(parseUrl('a=1#top').params).toEqual([{ key: 'a', value: '1' }])
  })
  it('keeps undecodable values as they are', () => {
    expect(parseUrl('a=%E0%A4%A').params[0].value).toBe('%E0%A4%A')
  })
  it('reports problems', () => {
    expect(parseUrl('').ok).toBe(false)
    expect(parseUrl('hello world').ok).toBe(false)
    expect(parseUrl('http://').ok).toBe(false)
  })
})

describe('parseable', () => {
  it('is true for URLs and key=value text only', () => {
    expect(parseable('https://a.dev/x')).toBe(true)
    expect(parseable('?a=1&b=2')).toBe(true)
    expect(parseable('a=1')).toBe(true)
    expect(parseable('hello world')).toBe(false)
    expect(parseable('100% sure')).toBe(false)
  })
})
