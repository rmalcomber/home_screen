import { describe, it, expect, beforeEach } from 'vitest'
import { parseCaniuseCommand, loadDataset, getDataset, _reset, searchFeatures, featureInfo, plain, parseFlag, MAX_AGE_MS, DATA_URL } from './engine.js'

const DATASET = {
  updated: 1793848571,
  statuses: { cr: 'W3C Candidate Recommendation', ls: 'WHATWG Living Standard' },
  agents: {
    chrome: { browser: 'Chrome', long_name: 'Chrome', type: 'desktop', current_version: '157', version_list: [{ version: '56', era: -1 }, { version: '57', era: -1 }, { version: '157', era: 0 }, { version: '158', era: 1 }] },
    firefox: { browser: 'Firefox', long_name: 'Firefox', type: 'desktop', current_version: '', version_list: [{ version: '51', era: -2 }, { version: '52', era: -1 }, { version: '152', era: 0 }] },
    safari: { browser: 'Safari', long_name: 'Safari', type: 'desktop', current_version: '27.2', version_list: [{ version: '9', era: -2 }, { version: '10', era: -1 }, { version: '27.2', era: 0 }] },
  },
  data: {
    'css-grid': {
      title: 'CSS Grid Layout (level 1)', description: 'Method of positioning elements in **columns** and rows. See `display: grid`.', spec: 'https://www.w3.org/TR/css-grid-1/', status: 'cr',
      keywords: 'grids,grid-row,grid-column,fr unit', usage_perc_y: 97.4, usage_perc_a: 0.17,
      notes: 'Includes [subgrid](#feat=css-subgrid) notes.', notes_by_num: { 1: 'Enabled through a <b>flag</b>.' },
      links: [{ url: 'https://example.com/grid', title: 'Grid guide' }], categories: ['CSS3'],
      stats: { chrome: { 56: 'n d #1', 57: 'y', 157: 'y', 158: 'y' }, firefox: { 51: 'n', 52: 'y', 152: 'y' }, safari: { 9: 'n', 10: 'a x #2', 27.2: 'y' } },
    },
    flexbox: {
      title: 'CSS Flexible Box Layout Module', description: 'Method of positioning elements in horizontal or vertical stacks.', status: 'cr', keywords: 'flex,flexbox', usage_perc_y: 99, usage_perc_a: 0.5, links: [], categories: ['CSS3'],
      stats: { chrome: { 56: 'y', 57: 'y', 157: 'y' }, firefox: { 51: 'y', 52: 'y', 152: 'y' }, safari: { 9: 'a', 10: 'a', 27.2: 'a' } },
    },
    'css-subgrid': { title: 'CSS Subgrid', description: 'Nested grids.', status: 'cr', keywords: 'subgrid', usage_perc_y: 80, usage_perc_a: 0, links: [], stats: { chrome: { 157: 'y' } } },
    'es6-class': { title: 'ES6 Classes', description: 'Declare classes with the class keyword.', status: 'ls', keywords: 'class,es2015', usage_perc_y: 98, usage_perc_a: 0, links: [], stats: { chrome: { 157: 'y' } } },
    'old-thing': { title: 'Nothing supports me', description: 'x', status: 'ls', keywords: '', usage_perc_y: 0, usage_perc_a: 0, links: [], stats: { chrome: { 56: 'n', 57: 'n', 157: 'n' }, firefox: { 51: 'u', 52: 'u', 152: 'u' }, safari: { 9: 'p', 10: 'p', 27.2: 'p' } } },
  },
}

describe('parseCaniuseCommand', () => {
  it('reads the command words', () => {
    expect(parseCaniuseCommand('caniuse grid')).toEqual({ text: 'grid' })
    expect(parseCaniuseCommand('  CIU  flexbox gap ')).toEqual({ text: 'flexbox gap' })
    expect(parseCaniuseCommand('caniuse')).toEqual({ text: '' })
  })
  it('ignores other queries', () => {
    for (const q of ['', 'caniuses x', 'ciuda', 'can i use grid', 'a ciu b']) expect(parseCaniuseCommand(q), q).toBeNull()
  })
})

const memoryStore = (initial = null) => {
  let kept = initial
  return { get: async () => kept, put: async (text, at) => { kept = { text, fetchedAt: at } }, peek: () => kept }
}
const okFetch = (calls) => async (url) => { calls.push(url); return { ok: true, status: 200, text: async () => JSON.stringify(DATASET) } }

describe('loadDataset', () => {
  const NOW = 1_800_000_000_000
  it('downloads once and keeps the text', async () => {
    const calls = []
    const store = memoryStore()
    const r = await loadDataset({ fetchFn: okFetch(calls), store, now: NOW })
    expect(calls).toEqual([DATA_URL])
    expect(r).toMatchObject({ stale: false, source: 'network', fetchedAt: NOW })
    expect(Object.keys(r.data.data)).toContain('css-grid')
    expect(store.peek()).toMatchObject({ fetchedAt: NOW })
  })
  it('uses the stored copy while it is fresh', async () => {
    const calls = []
    const store = memoryStore({ text: JSON.stringify(DATASET), fetchedAt: NOW - 1000 })
    const r = await loadDataset({ fetchFn: okFetch(calls), store, now: NOW })
    expect(calls).toEqual([])
    expect(r).toMatchObject({ source: 'cache', stale: false })
  })
  it('refreshes an old copy, or falls back to it when offline', async () => {
    const old = { text: JSON.stringify(DATASET), fetchedAt: NOW - MAX_AGE_MS - 1 }
    const calls = []
    expect((await loadDataset({ fetchFn: okFetch(calls), store: memoryStore(old), now: NOW })).source).toBe('network')
    expect(calls).toHaveLength(1)
    const offline = async () => { throw new TypeError('Failed to fetch') }
    const r = await loadDataset({ fetchFn: offline, store: memoryStore(old), now: NOW })
    expect(r).toMatchObject({ source: 'cache', stale: true, fetchedAt: old.fetchedAt })
  })
  it('explains a failed first download', async () => {
    await expect(loadDataset({ fetchFn: async () => { throw new TypeError('Failed to fetch') }, store: memoryStore(), now: NOW })).rejects.toThrow(/Could not download the Can I use data \(Failed to fetch\)/)
    await expect(loadDataset({ fetchFn: async () => ({ ok: false, status: 503 }), store: null, now: NOW })).rejects.toThrow(/HTTP 503/)
    await expect(loadDataset({ fetchFn: async () => ({ ok: true, text: async () => '{"nope":1}' }), store: null, now: NOW })).rejects.toThrow(/unexpected data/)
  })
  it('ignores a broken stored copy and a broken store', async () => {
    const calls = []
    const bad = { get: async () => { throw new Error('boom') }, put: async () => { throw new Error('boom') } }
    expect((await loadDataset({ fetchFn: okFetch(calls), store: bad, now: NOW })).source).toBe('network')
    expect((await loadDataset({ fetchFn: okFetch(calls), store: memoryStore({ text: 'not json', fetchedAt: NOW }), now: NOW })).source).toBe('network')
  })
  it('works without any store', async () => {
    expect((await loadDataset({ fetchFn: okFetch([]), store: null, now: NOW })).source).toBe('network')
  })
})

describe('getDataset', () => {
  beforeEach(_reset)
  it('loads once per page and retries after a failure', async () => {
    let fails = 1
    const calls = []
    const fetchFn = async (u) => { calls.push(u); if (fails-- > 0) throw new TypeError('offline'); return { ok: true, text: async () => JSON.stringify(DATASET) } }
    const opts = { fetchFn, store: null }
    await expect(getDataset(opts)).rejects.toThrow()
    const a = await getDataset(opts)
    const b = await getDataset(opts)
    expect(a).toBe(b)
    expect(calls).toHaveLength(2)
  })
})

describe('searchFeatures', () => {
  const ids = (text, limit) => searchFeatures(DATASET, text, limit).map((r) => r.id)
  it('finds a feature by id, title and keywords', () => {
    expect(ids('flexbox')[0]).toBe('flexbox')
    expect(ids('flex')[0]).toBe('flexbox')
    expect(ids('grid')[0]).toBe('css-grid')
    expect(ids('fr unit')).toEqual(['css-grid'])
    expect(ids('es2015')).toEqual(['es6-class'])
    expect(ids('classes')).toEqual(['es6-class'])
  })
  it('needs every word, and ranks by match then by usage', () => {
    expect(ids('css grid')).toEqual(['css-grid', 'css-subgrid'])
    expect(ids('grid zzz')).toEqual([])
    expect(ids('grid').slice(0, 2)).toEqual(['css-grid', 'css-subgrid'])
  })
  it('searches the description last', () => {
    expect(ids('stacks')).toEqual(['flexbox'])
    expect(ids('nested')).toEqual(['css-subgrid'])
  })
  it('handles empty input and limits', () => {
    expect(ids('')).toEqual([])
    expect(ids('   ')).toEqual([])
    expect(ids('css', 1)).toHaveLength(1)
    expect(searchFeatures(DATASET, 'flexbox')[0]).toMatchObject({ title: 'CSS Flexible Box Layout Module', usage: 99.5 })
  })
})

describe('plain and parseFlag', () => {
  it('strips markdown and HTML', () => {
    expect(plain('Use `display: grid` and [the spec](https://x.dev/a). <b>Bold</b>\n  more')).toBe('Use display: grid and the spec. Bold more')
    expect(plain(undefined)).toBe('')
  })
  it('reads support flags', () => {
    expect(parseFlag('y')).toEqual({ code: 'y', prefixed: false, disabled: false, notes: [] })
    expect(parseFlag('a x #2 #3')).toEqual({ code: 'a', prefixed: true, disabled: false, notes: ['2', '3'] })
    expect(parseFlag('n d #1')).toEqual({ code: 'n', prefixed: false, disabled: true, notes: ['1'] })
    expect(parseFlag(undefined).code).toBe('u')
  })
})

describe('featureInfo', () => {
  it('summarises a feature', () => {
    const f = featureInfo(DATASET, 'css-grid')
    expect(f).toMatchObject({ id: 'css-grid', title: 'CSS Grid Layout (level 1)', status: 'W3C Candidate Recommendation', usageFull: 97.4, usagePartial: 0.17, url: 'https://caniuse.com/css-grid' })
    expect(f.description).toBe('Method of positioning elements in columns and rows. See display: grid.')
    expect(f.notes).toBe('Includes subgrid notes.')
    expect(f.noteMap).toEqual({ 1: 'Enabled through a flag.' })
    expect(f.links).toEqual([{ url: 'https://example.com/grid', title: 'Grid guide' }])
    expect(f.updated).toBeInstanceOf(Date)
  })
  it('finds the first version with support and the current state', () => {
    const rows = Object.fromEntries(featureInfo(DATASET, 'css-grid').rows.map((r) => [r.key, r]))
    expect(rows.chrome).toMatchObject({ code: 'y', current: '157', firstFull: '57', summary: '57+', label: 'Supported' })
    expect(rows.firefox).toMatchObject({ code: 'y', current: '152', firstFull: '52', summary: '52+' })
    expect(rows.safari).toMatchObject({ code: 'y', firstFull: '27.2', firstPartial: '10' })
  })
  it('describes partial, missing, unknown and polyfilled support', () => {
    const flex = Object.fromEntries(featureInfo(DATASET, 'flexbox').rows.map((r) => [r.key, r]))
    expect(flex.safari).toMatchObject({ code: 'a', summary: 'partial since 9', label: 'Partial' })
    const none = Object.fromEntries(featureInfo(DATASET, 'old-thing').rows.map((r) => [r.key, r]))
    expect(none.chrome.summary).toBe('not supported')
    expect(none.firefox.summary).toBe('unknown')
    expect(none.safari.summary).toBe('polyfill needed')
  })
  it('skips browsers without data and unknown features', () => {
    expect(featureInfo(DATASET, 'es6-class').rows.map((r) => r.key)).toEqual(['chrome'])
    expect(featureInfo(DATASET, 'nope')).toBeNull()
  })
  it('uses the era-0 version when current_version is empty', () => {
    expect(featureInfo(DATASET, 'flexbox').rows.find((r) => r.key === 'firefox').current).toBe('152')
  })
})
