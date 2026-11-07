import { describe, it, expect } from 'vitest'
import { parseOgCommand, normalizeUrl, ogRequest, parseOpenGraph, checks, readResponse, USER_AGENT } from './engine.js'

const PAGE = `<!doctype html><html><head>
<title>  Fallback   title </title>
<base href="https://cdn.example.com/assets/">
<meta property="og:title" content="The Title">
<meta property="og:description" content="A short description.">
<meta property="og:image" content="img/card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://example.com/a">
<meta property="og:site_name" content="Example">
<meta property="og:type" content="article">
<meta property="article:author" content="Ada">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:creator" content="@ada">
<meta name="description" content="Plain description">
<meta name="robots" content="index,follow">
<meta name="viewport" content="width=device-width">
<meta name="unrelated" content="x">
<link rel="canonical" href="https://example.com/a">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="touch.png">
<link rel="alternate" type="application/rss+xml" title="Feed" href="/feed.xml">
<link rel="alternate" type="text/html" href="/other">
</head><body></body></html>`

describe('parseOgCommand', () => {
  it('reads the command words', () => {
    expect(parseOgCommand('og https://example.com')).toEqual({ text: 'https://example.com' })
    expect(parseOgCommand('  OpenGraph  example.com ')).toEqual({ text: 'example.com' })
    expect(parseOgCommand('ogp')).toEqual({ text: '' })
    expect(parseOgCommand('og')).toEqual({ text: '' })
  })
  it('ignores other queries', () => {
    for (const q of ['', 'ogre', 'dog og', 'https://example.com', 'opengraphs x', 'og2 x']) expect(parseOgCommand(q), q).toBeNull()
  })
})

describe('normalizeUrl', () => {
  it('accepts http and https addresses and adds https when missing', () => {
    expect(normalizeUrl('https://example.com/a?b=1#c')).toEqual({ ok: true, url: 'https://example.com/a?b=1#c' })
    expect(normalizeUrl('http://localhost:3000')).toEqual({ ok: true, url: 'http://localhost:3000/' })
    expect(normalizeUrl('example.com/page')).toEqual({ ok: true, url: 'https://example.com/page' })
    expect(normalizeUrl('localhost:8080/x')).toEqual({ ok: true, url: 'https://localhost:8080/x' })
    expect(normalizeUrl('  EXAMPLE.com  ').url).toBe('https://example.com/')
  })
  it('refuses everything else with a reason', () => {
    expect(normalizeUrl('').error).toMatch(/Type a web address/)
    expect(normalizeUrl('two words').error).toMatch(/spaces/)
    expect(normalizeUrl('ftp://example.com').error).toMatch(/http and https/)
    expect(normalizeUrl('file:///etc/passwd').error).toMatch(/http and https/)
    expect(normalizeUrl('javascript:alert(1)').error).toMatch(/http and https/)
    expect(normalizeUrl('mailto:a@b.c').error).toMatch(/http and https/)
    expect(normalizeUrl('http://').ok).toBe(false)
  })
})

describe('ogRequest', () => {
  it('asks the server for a plain GET that follows redirects', () => {
    const r = ogRequest('https://example.com/')
    expect(r).toMatchObject({ method: 'GET', url: 'https://example.com/', follow: true, insecure: false, body: null })
    expect(r.headers).toContainEqual(['User-Agent', USER_AGENT])
    expect(r.timeout).toBeGreaterThan(0)
  })
})

describe('parseOpenGraph', () => {
  const d = parseOpenGraph(PAGE, 'https://example.com/a')
  it('reads the summary with fallbacks', () => {
    expect(d.summary).toMatchObject({
      title: 'The Title', description: 'A short description.', site: 'Example', type: 'article', url: 'https://example.com/a', card: 'summary_large_image',
    })
    expect(d.pageTitle).toBe('Fallback title')
  })
  it('resolves relative URLs against <base>', () => {
    expect(d.summary.image).toBe('https://cdn.example.com/assets/img/card.png')
    expect(d.imageWasRelative).toBe(true)
    expect(d.icons).toEqual([
      { rel: 'icon', href: 'https://cdn.example.com/favicon.ico', sizes: '32x32', type: '' },
      { rel: 'apple-touch-icon', href: 'https://cdn.example.com/assets/touch.png', sizes: '', type: '' },
    ])
    expect(d.feeds).toEqual([{ title: 'Feed', href: 'https://cdn.example.com/feed.xml', type: 'application/rss+xml' }])
  })
  it('sorts the tags into groups', () => {
    expect(d.og.map((r) => r[0])).toEqual(['og:title', 'og:description', 'og:image', 'og:image:width', 'og:image:height', 'og:url', 'og:site_name', 'og:type', 'article:author'])
    expect(d.twitter).toEqual([['twitter:card', 'summary_large_image'], ['twitter:creator', '@ada']])
    expect(d.basic.map((r) => r[0])).toEqual(['description', 'robots', 'viewport'])
    expect(d.canonical).toBe('https://example.com/a')
  })
  it('falls back to Twitter tags, the page title and the description', () => {
    const f = parseOpenGraph('<title>Only title</title><meta name="description" content="Meta d"><meta name="twitter:image" content="/t.png">', 'https://x.dev/p')
    expect(f.summary).toMatchObject({ title: 'Only title', description: 'Meta d', image: 'https://x.dev/t.png', url: 'https://x.dev/p' })
    const t = parseOpenGraph('<meta name="twitter:title" content="TT"><meta name="twitter:description" content="TD">', 'https://x.dev/')
    expect(t.summary).toMatchObject({ title: 'TT', description: 'TD' })
  })
  it('copes with pages that have no tags at all', () => {
    const e = parseOpenGraph('<html><body>hi</body></html>', 'https://x.dev/')
    expect(e.summary).toMatchObject({ title: '', description: '', image: '', url: 'https://x.dev/' })
    expect(e.og).toEqual([])
  })
  it('ignores tags with no content and is case-insensitive', () => {
    const e = parseOpenGraph('<meta property="OG:Title" content="Up"><meta property="og:image"><meta property="og:url" content="">', 'https://x.dev/')
    expect(e.og).toEqual([['og:title', 'Up'], ['og:url', '']])
  })
})

describe('checks', () => {
  const levels = (c) => c.map((x) => x.level + ':' + x.text.split(' ')[0])
  it('is happy with a complete page', () => {
    const good = parseOpenGraph(PAGE.replace('content="img/card.png"', 'content="https://cdn.example.com/card.png"'), 'https://example.com/a')
    const c = checks(good)
    expect(c.filter((x) => x.level === 'warn')).toEqual([])
    expect(c.filter((x) => x.level === 'ok').map((x) => x.text)).toEqual(['og:title is set', 'og:description is set', 'og:image is set', 'og:url is set', 'og:type is set'])
  })
  it('warns about what is missing', () => {
    const c = checks(parseOpenGraph('<title>x</title>', 'https://x.dev/'))
    expect(levels(c)).toEqual(expect.arrayContaining(['warn:og:title', 'warn:og:image', 'warn:og:description', 'warn:og:url', 'warn:og:type', 'info:twitter:card']))
  })
  it('warns about relative and insecure images and missing sizes', () => {
    const c = checks(parseOpenGraph('<meta property="og:image" content="/card.png">', 'http://x.dev/p'))
    const text = c.map((x) => x.text).join('\n')
    expect(text).toMatch(/relative address/)
    expect(text).toMatch(/not served over https/)
    expect(text).toMatch(/og:image:width/)
  })
  it('notes long titles and descriptions', () => {
    const c = checks(parseOpenGraph(`<meta property="og:title" content="${'T'.repeat(80)}"><meta property="og:description" content="${'d'.repeat(250)}">`, 'https://x.dev/'))
    const text = c.map((x) => x.text).join('\n')
    expect(text).toMatch(/title is 80 characters/)
    expect(text).toMatch(/description is 250 characters/)
  })
})

describe('readResponse', () => {
  const ok = (extra = {}) => ({ status: 200, status_text: 'OK', headers: [['Content-Type', 'text/html; charset=utf-8']], body: PAGE, binary: false, truncated: false, ...extra })
  it('reads a good page', () => {
    const r = readResponse(ok(), 'https://example.com/a')
    expect(r.ok).toBe(true)
    expect(r.data.summary.title).toBe('The Title')
    expect(r.notes).toEqual([])
  })
  it('passes server errors on', () => {
    expect(readResponse({ error: 'dns error: no such host' }, 'https://x.dev/')).toEqual({ ok: false, error: 'dns error: no such host' })
    expect(readResponse(null, 'x').ok).toBe(false)
  })
  it('refuses things that are not pages', () => {
    expect(readResponse(ok({ headers: [['content-type', 'image/png']], body: '' }), 'u').error).toMatch(/not a web page \(image\/png\)/)
    expect(readResponse(ok({ binary: true }), 'u').error).toMatch(/not a web page/)
    expect(readResponse(ok({ body: '   ' }), 'u').error).toMatch(/empty page/)
  })
  it('explains error statuses, but still reads tags when they are there', () => {
    const blocked = readResponse(ok({ status: 403, status_text: 'Forbidden', body: '<html><title>Denied</title></html>' }), 'u')
    expect(blocked.ok).toBe(false)
    expect(blocked.error).toMatch(/403 Forbidden.*refuse requests/)
    const withTags = readResponse(ok({ status: 404, status_text: 'Not Found' }), 'https://example.com/a')
    expect(withTags.ok).toBe(true)
    expect(withTags.notes[0]).toMatch(/404 Not Found/)
  })
  it('notes truncation and unfollowed redirects', () => {
    expect(readResponse(ok({ truncated: true }), 'https://example.com/a').notes[0]).toMatch(/first 2 MB/)
    expect(readResponse(ok({ status: 302 }), 'https://example.com/a').notes[0]).toMatch(/302/)
  })
})
