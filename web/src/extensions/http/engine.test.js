import { describe, it, expect } from 'vitest'
import { parseHttpCommand, lookupStatus, statusClass, lookupHeader, lookupMime, statusUrl, headerUrl } from './engine.js'
import { STATUS, HEADERS, MIME } from './data.js'

describe('parseHttpCommand', () => {
  it('reads the command words', () => {
    expect(parseHttpCommand('http 404')).toEqual({ word: 'status', text: '404' })
    expect(parseHttpCommand('Status not found')).toEqual({ word: 'status', text: 'not found' })
    expect(parseHttpCommand('header content-type')).toEqual({ word: 'header', text: 'content-type' })
    expect(parseHttpCommand('HEADERS  cache ')).toEqual({ word: 'header', text: 'cache' })
    expect(parseHttpCommand('mime .png')).toEqual({ word: 'mime', text: '.png' })
    expect(parseHttpCommand('mimetype json')).toEqual({ word: 'mime', text: 'json' })
    expect(parseHttpCommand('http')).toEqual({ word: 'status', text: '' })
  })
  it('ignores URLs and other queries', () => {
    for (const q of ['', 'https://example.com', 'http://localhost:3000', 'httpd conf', 'status-page', 'a http b', 'headerbar', 'mimeo x', '404']) expect(parseHttpCommand(q), q).toBeNull()
  })
})

describe('data', () => {
  it('is well formed', () => {
    expect(new Set(STATUS.map((s) => s[0])).size).toBe(STATUS.length)
    for (const [code, name, meaning, spec] of STATUS) {
      expect(code, name).toBeGreaterThanOrEqual(100)
      expect(code, name).toBeLessThan(600)
      expect(name.length, String(code)).toBeGreaterThanOrEqual(2)
      expect(meaning.length, String(code)).toBeGreaterThan(20)
      expect(spec, String(code)).toBeTruthy()
    }
    expect(new Set(HEADERS.map((h) => h[0].toLowerCase())).size).toBe(HEADERS.length)
    for (const [name, kind, description, example] of HEADERS) {
      expect(name, name).toMatch(/^[A-Za-z][A-Za-z0-9-]*$/)
      expect(['request', 'response', 'both'], name).toContain(kind)
      expect(description.length, name).toBeGreaterThan(15)
      expect(example, name).toBeTruthy()
    }
    const exts = MIME.flatMap((m) => m[0])
    expect(new Set(exts).size).toBe(exts.length)
    for (const [, type] of MIME) expect(type, type).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/)
  })
})

describe('lookupStatus', () => {
  it('finds a code', () => {
    expect(lookupStatus('404')).toEqual([expect.objectContaining({ code: 404, name: 'Not Found', spec: 'RFC 9110' })])
    expect(lookupStatus('418')[0].name).toBe("I'm a teapot")
    expect(lookupStatus('999')).toEqual([])
  })
  it('lists a class', () => {
    expect(lookupStatus('4xx').every((s) => String(s.code)[0] === '4')).toBe(true)
    expect(lookupStatus('5').map((s) => s.code)).toContain(503)
    expect(lookupStatus('2XX')[0].code).toBe(200)
  })
  it('searches names and meanings, best first', () => {
    expect(lookupStatus('not found')[0].code).toBe(404)
    expect(lookupStatus('teapot')[0].code).toBe(418)
    expect(lookupStatus('redirect').map((s) => s.code)).toEqual(expect.arrayContaining([301, 302, 307, 308]))
    expect(lookupStatus('rate limit')[0].code).toBe(429)
    expect(lookupStatus('gateway').map((s) => s.code).slice(0, 2).sort()).toEqual([502, 504])
    expect(lookupStatus('zzzz nothing')).toEqual([])
    expect(lookupStatus('redirect', 3)).toHaveLength(3)
  })
  it('shows the common codes for no text', () => {
    const codes = lookupStatus('').map((s) => s.code)
    expect(codes[0]).toBe(200)
    expect(codes).toContain(404)
    expect(codes.length).toBeGreaterThan(10)
  })
  it('marks codes that are not part of the standard', () => {
    expect(lookupStatus('499')[0]).toMatchObject({ source: 'nginx', unofficial: true })
    expect(lookupStatus('522')[0]).toMatchObject({ source: 'Cloudflare', unofficial: true })
    expect(lookupStatus('207')[0]).toMatchObject({ source: 'WebDAV', unofficial: false })
    expect(lookupStatus('404')[0].source).toBe('')
  })
  it('names the class and links to MDN', () => {
    expect(statusClass(404)).toMatch(/^Client error/)
    expect(statusClass(503)).toMatch(/^Server error/)
    expect(statusUrl(404)).toBe('https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404')
  })
})

describe('lookupHeader', () => {
  it('finds a header by name, forgiving case, dashes and spaces', () => {
    expect(lookupHeader('content-type')[0].name).toBe('Content-Type')
    expect(lookupHeader('Content Type')[0].name).toBe('Content-Type')
    expect(lookupHeader('CONTENTTYPE')[0].name).toBe('Content-Type')
    expect(lookupHeader('etag')[0]).toMatchObject({ name: 'ETag', kind: 'response' })
  })
  it('puts exact matches first, then prefixes, then the rest', () => {
    const names = lookupHeader('accept').map((h) => h.name)
    expect(names[0]).toBe('Accept')
    expect(names.slice(1, 4).every((n) => n.toLowerCase().startsWith('accept'))).toBe(true)
    expect(lookupHeader('origin').map((h) => h.name)).toEqual(expect.arrayContaining(['Origin', 'Access-Control-Allow-Origin']))
  })
  it('searches descriptions as a last resort', () => {
    expect(lookupHeader('cookie').map((h) => h.name)).toEqual(expect.arrayContaining(['Cookie', 'Set-Cookie']))
    expect(lookupHeader('compression').map((h) => h.name)).toEqual(expect.arrayContaining(['Accept-Encoding', 'Content-Encoding']))
    expect(lookupHeader('')).toEqual([])
    expect(lookupHeader('qqqqq')).toEqual([])
  })
  it('links to MDN', () => {
    expect(headerUrl('Content-Type')).toBe('https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type')
  })
})

describe('lookupMime', () => {
  it('finds by extension, with or without a dot', () => {
    expect(lookupMime('png')[0]).toMatchObject({ type: 'image/png' })
    expect(lookupMime('.json')[0].type).toBe('application/json')
    expect(lookupMime('*.JPG')[0].type).toBe('image/jpeg')
    expect(lookupMime('js')[0].type).toBe('text/javascript')
  })
  it('finds by type, and lists its extensions', () => {
    const r = lookupMime('image/jpeg')[0]
    expect(r.exts).toEqual(['jpg', 'jpeg', 'jpe'])
    expect(lookupMime('application/pdf')[0].exts).toEqual(['pdf'])
    expect(lookupMime('multipart/form-data')[0].exts).toEqual([])
  })
  it('searches by prefix and by words', () => {
    expect(lookupMime('image/').length).toBeGreaterThan(5)
    expect(lookupMime('font').map((m) => m.type)).toEqual(expect.arrayContaining(['font/woff2', 'font/ttf']))
    expect(lookupMime('spreadsheet').map((m) => m.exts[0])).toEqual(expect.arrayContaining(['xlsx', 'ods']))
    expect(lookupMime('')).toEqual([])
    expect(lookupMime('qqqq')).toEqual([])
    expect(lookupMime('image/', 3)).toHaveLength(3)
  })
})
