import { describe, it, expect, beforeEach } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXTENSIONS, WIDGETS_META, TOOLS, extensionById, CATEGORIES } from './registry.js'
import { validateManifest } from './manifest.js'
import { loadExtension, peek, _reset } from './loader.js'
import { buildQuery } from './ToolHost.jsx'
import { getProviders } from '../launcher/registry.js'
import '../launcher/providers.js' // registers the core providers and the extension tools

const here = dirname(fileURLToPath(import.meta.url))
const extRoot = resolve(here, '../../extensions')

describe('manifests', () => {
  it('are valid', () => {
    expect(EXTENSIONS.length).toBeGreaterThanOrEqual(23)
    for (const m of EXTENSIONS) expect(validateManifest(m), m.id).toEqual([])
  })

  it('have unique ids, widget kinds and tool ids, and match their folder', () => {
    const dirs = readdirSync(extRoot).filter((d) => statSync(join(extRoot, d)).isDirectory())
    expect(EXTENSIONS.map((e) => e.id).sort()).toEqual(dirs.sort())
    const kinds = EXTENSIONS.flatMap((e) => (e.widgets || []).map((w) => w.kind))
    expect(new Set(kinds).size).toBe(kinds.length)
    const tools = EXTENSIONS.filter((e) => e.tool).map((e) => e.tool.id)
    expect(new Set(tools).size).toBe(tools.length)
    const orders = EXTENSIONS.filter((e) => e.tool).map((e) => e.tool.order)
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('rejects bad manifests', () => {
    expect(validateManifest({ id: 'Bad Id', name: 'x' }).length).toBeGreaterThan(0)
    expect(validateManifest({ id: 'ok', name: 'Okay' })).toContain('an extension needs a tool, a widget, or both')
    const w = { kind: 'k', name: 'K', category: 'Nope', icon: 'x', description: 'short', size: [0, 1] }
    expect(validateManifest({ id: 'ok', name: 'Okay', widgets: [w] }).length).toBeGreaterThanOrEqual(4)
  })
})

describe('widget catalogue', () => {
  const entries = Object.entries(WIDGETS_META)

  it('gives every widget a category, icon, description, size and matching kind', () => {
    expect(entries.length).toBeGreaterThanOrEqual(26)
    for (const [key, w] of entries) {
      expect(CATEGORIES, key).toContain(w.category)
      expect(w.icon, key).toMatch(/^iconify:[\w-]+:[\w-]+$/)
      expect(w.description?.length, key).toBeGreaterThan(10)
      expect(w.label, key).toBeTruthy()
      expect(w.defaults.kind, key).toBe(key)
      expect(w.size?.length, key).toBe(2)
      expect(extensionById(w.extension), key).toBeTruthy()
    }
  })

  it('has a widget in every category', () => {
    for (const c of CATEGORIES) expect(entries.some(([, w]) => w.category === c), c).toBe(true)
  })

  it('keeps the kinds saved tiles already use', () => {
    const kinds = ['clock', 'weather', 'countdown', 'notes', 'tabata', 'carousel', 'todo', 'colorpicker', 'tool-calc', 'tool-units', 'tool-currency', 'tool-timestamp', 'tool-cron', 'tool-markdown', 'tool-qr', 'tool-lorem', 'tool-password', 'tool-hash', 'tool-base64', 'tool-uuid', 'tool-jwt', 'tool-curl', 'tool-json', 'tool-regex', 'tool-diff', 'tool-csv']
    for (const k of kinds) expect(WIDGETS_META[k], k).toBeTruthy()
    expect(Object.keys(WIDGETS_META).slice(0, 8)).toEqual(kinds.slice(0, 8)) // the picker order
  })
})

describe('extension entries', () => {
  beforeEach(_reset)

  it('export what their manifest promises', async () => {
    for (const m of EXTENSIONS) {
      const mod = await loadExtension(m.id)
      if (m.tool) expect(typeof mod.tool?.items, `${m.id} tool.items`).toBe('function')
      for (const w of m.widgets || []) {
        if (w.host) continue
        expect(typeof mod.widgets?.[w.kind]?.Body, `${w.kind} Body`).toBe('function')
        expect(typeof mod.widgets?.[w.kind]?.Options, `${w.kind} Options`).toBe('function')
      }
    }
  })

  it('load once and remember it', async () => {
    expect(peek('cron').status).toBe('idle')
    const p = loadExtension('cron')
    expect(peek('cron').status).toBe('loading')
    const mod = await p
    expect(peek('cron').status).toBe('ready')
    expect(await loadExtension('cron')).toBe(mod)
  })

  it('report a failed load and allow a retry', async () => {
    let calls = 0
    const flaky = () => (++calls === 1 ? Promise.reject(new Error('chunk missing')) : Promise.resolve({ default: { ok: true } }))
    await expect(loadExtension('flaky', flaky)).rejects.toThrow('chunk missing')
    expect(peek('flaky').status).toBe('error')
    expect(await loadExtension('flaky', flaky)).toEqual({ ok: true })
    expect(peek('flaky').status).toBe('ready')
  })

  it('reject an unknown extension', async () => {
    await expect(loadExtension('nope')).rejects.toThrow('No extension called "nope"')
  })
})

describe('launcher tools', () => {
  it('register a provider each, in manifest order, before the core providers', () => {
    const ids = getProviders().map((p) => p.id)
    for (const t of TOOLS) expect(ids, t.id).toContain(t.id)
    expect(ids.slice(0, TOOLS.length)).toEqual(TOOLS.map((t) => t.id))
    expect(ids.slice(TOOLS.length)).toEqual(['links', 'commands'])
    expect(TOOLS.map((t) => t.id)).toEqual(['curl', 'json', 'b64', 'jwt', 'uuid', 'hash', 'regex', 'color', 'lorem', 'ts', 'diff', 'cron', 'csv', 'password', 'qr', 'md', 'calc', 'url', 'case', 'bases', 'chmod'])
  })

  it('answer through the loaded extension', async () => {
    const calc = getProviders().find((p) => p.id === 'calc')
    const items = await calc.items('2+3*4', {})
    expect(items[0].title).toBe('= 14')
    const hash = getProviders().find((p) => p.id === 'hash')
    expect((await hash.items('md5 hello', {}))[0].title).toBe('5d41402abc4b2a76b9719d911017c592')
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

// The boundary: extensions reach core only through the host API, and engines stay free of UI.
describe('extension boundaries', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]))
  const files = walk(extRoot).filter((f) => /\.jsx?$/.test(f) && !/\.test\./.test(f))
  const NPM = new Set(['preact', 'preact/hooks', 'marked', 'qrcode-generator'])
  const importsOf = (f) => [...readFileSync(f, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  // Everything that is not UI or wiring is an engine: pure logic (calc.js, engine.js, timeutil.js...).
  const isEngine = (f) => !/\.jsx$/.test(f) && !/(^|[\\/])(tool|index|manifest|render)\.js$/.test(f)

  it('only import their own folder, the host API, core/lib (engines) and listed packages', () => {
    for (const f of files) {
      const ext = relative(extRoot, f).split(sep)[0]
      for (const spec of importsOf(f)) {
        if (!spec.startsWith('.')) { expect(NPM.has(spec), `${relative(extRoot, f)} imports ${spec}`).toBe(true); continue }
        const target = resolve(dirname(f), spec)
        const inOwn = target.startsWith(join(extRoot, ext) + sep)
        const isHost = target === resolve(here, 'host.js')
        const isLib = target.startsWith(resolve(here, '../lib') + sep)
        expect(inOwn || isHost || (isLib && isEngine(f)), `${relative(extRoot, f)} imports ${spec}`).toBe(true)
      }
    }
  })

  it('keep engines free of UI and app state', () => {
    for (const f of files.filter(isEngine)) {
      for (const spec of importsOf(f)) expect(/^preact|host\.js$|store\.js$/.test(spec), `${relative(extRoot, f)} imports ${spec}`).toBe(false)
    }
  })
})
