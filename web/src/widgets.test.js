import { describe, it, expect } from 'vitest'
import { WIDGETS } from './tiles/widgets.jsx'
import { CATEGORIES } from './tiles/catalog.js'
import { buildQuery } from './tiles/widgets_tools.jsx'
import { getProviders } from './launcher/registry.js'

describe('widget catalogue', () => {
  const entries = Object.entries(WIDGETS)

  it('gives every widget a category, icon, description and matching kind', () => {
    expect(entries.length).toBeGreaterThanOrEqual(26)
    for (const [key, w] of entries) {
      expect(CATEGORIES, key).toContain(w.category)
      expect(w.icon, key).toMatch(/^iconify:[\w-]+:[\w-]+$/)
      expect(w.description?.length, key).toBeGreaterThan(10)
      expect(w.label, key).toBeTruthy()
      expect(w.defaults.kind, key).toBe(key)
      expect(typeof w.Body, key).toBe('function')
      expect(typeof w.Options, key).toBe('function')
      expect(w.size?.length, key).toBe(2)
    }
  })

  it('has a widget in every category', () => {
    for (const c of CATEGORIES) expect(entries.some(([, w]) => w.category === c), c).toBe(true)
  })

  it('offers every launcher tool as a widget', () => {
    const toolProviders = ['md', 'qr', 'calc', 'curl', 'json', 'b64', 'jwt', 'uuid', 'hash', 'regex', 'color', 'lorem', 'ts', 'diff', 'cron', 'csv', 'password']
    const known = new Set(getProviders().map((p) => p.id))
    for (const id of toolProviders) expect(known.has(id), `provider ${id}`).toBe(true)
    const hosted = new Set(['clock', ...entries.filter(([, w]) => w.tool).map(([k]) => k.replace('tool-', ''))])
    for (const kind of ['markdown', 'qr', 'calc', 'curl', 'json', 'base64', 'jwt', 'uuid', 'hash', 'regex', 'lorem', 'timestamp', 'diff', 'cron', 'csv', 'password']) expect(hosted.has(kind), kind).toBe(true)
    expect(WIDGETS.colorpicker).toBeTruthy() // the colour tool already existed as a widget
  })
})

describe('buildQuery', () => {
  const calc = { prefix: '', input: 'line' }
  const hash = { prefix: 'hash', input: 'multi' }
  const gen = { prefix: 'uuid', input: 'line', allowEmpty: true }
  const panel = { prefix: 'regex', input: 'none' }
  it('passes raw text through for unprefixed tools and waits for input', () => {
    expect(buildQuery(calc, '1+1')).toBe('1+1')
    expect(buildQuery(calc, '   ')).toBeNull()
  })
  it('prepends the command word', () => {
    expect(buildQuery(hash, 'hello')).toBe('hash hello')
    expect(buildQuery(hash, 'a\nb')).toBe('hash a\nb')
    expect(buildQuery(hash, '')).toBeNull()
  })
  it('runs generators and self-contained panels with no text', () => {
    expect(buildQuery(gen, '')).toBe('uuid')
    expect(buildQuery(gen, '5')).toBe('uuid 5')
    expect(buildQuery(panel, '')).toBe('regex')
  })
})
