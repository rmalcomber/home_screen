import { describe, it, expect } from 'vitest'
import { parseToml, toToml, TomlError } from './toml.js'

const t = (...lines) => lines.join('\n')
const bad = (text) => {
  try {
    parseToml(text)
  } catch (e) {
    expect(e).toBeInstanceOf(TomlError)
    return e.message
  }
  throw new Error(`expected an error for: ${JSON.stringify(text)}`)
}

describe('keys and values', () => {
  it('reads key/value pairs of every basic type', () => {
    expect(parseToml(t('title = "TOML"', 'n = 42', 'neg = -17', 'pi = 3.14', 'big = 5e+22', 'on = true', 'off = false', "lit = 'C:\\path'"))).toEqual({
      title: 'TOML', n: 42, neg: -17, pi: 3.14, big: 5e22, on: true, off: false, lit: 'C:\\path',
    })
  })
  it('reads other integer forms and separators', () => {
    expect(parseToml(t('a = 1_000', 'b = 0xDEAD_BEEF', 'c = 0o755', 'd = 0b1101', 'e = +5', 'f = 1_0.5_0', 'g = -0.0'))).toEqual({ a: 1000, b: 0xdeadbeef, c: 493, d: 13, e: 5, f: 10.5, g: -0 })
  })
  it('reads inf and nan as numbers', () => {
    const r = parseToml(t('a = inf', 'b = -inf', 'c = nan'))
    expect(r.a).toBe(Infinity)
    expect(r.b).toBe(-Infinity)
    expect(Number.isNaN(r.c)).toBe(true)
  })
  it('keeps integers that are too big as text', () => {
    expect(parseToml('a = 9223372036854775807').a).toBe('9223372036854775807')
  })
  it('keeps dates and times as text', () => {
    expect(parseToml(t('a = 1979-05-27T07:32:00Z', 'b = 1979-05-27 07:32:00-08:00', 'c = 1979-05-27', 'd = 07:32:00.5'))).toEqual({
      a: '1979-05-27T07:32:00Z', b: '1979-05-27 07:32:00-08:00', c: '1979-05-27', d: '07:32:00.5',
    })
  })
  it('reads bare, quoted and dotted keys', () => {
    expect(parseToml(t('bare-key_1 = 1', '"quoted key" = 2', "'lit key' = 3", 'a.b.c = 4', 'a . d = 5', '"x.y" = 6'))).toEqual({
      'bare-key_1': 1, 'quoted key': 2, 'lit key': 3, a: { b: { c: 4 }, d: 5 }, 'x.y': 6,
    })
  })
  it('ignores comments and blank lines', () => {
    expect(parseToml(t('# top', '', 'a = 1 # trailing', 'b = "# not a comment"', '  # indented'))).toEqual({ a: 1, b: '# not a comment' })
  })
  it('reads an empty document', () => {
    expect(parseToml('')).toEqual({})
    expect(parseToml('# nothing\n')).toEqual({})
  })
  it('accepts Windows line endings', () => {
    expect(parseToml('a = 1\r\n[t]\r\nb = 2\r\n')).toEqual({ a: 1, t: { b: 2 } })
  })
})

describe('strings', () => {
  it('reads escapes in basic strings', () => {
    expect(parseToml('a = "tab\\there \\"q\\" \\\\ \\u00e9 \\U0001F600 \\n"')).toEqual({ a: 'tab\there "q" \\ é 😀 \n' })
  })
  it('reads multi-line strings', () => {
    expect(parseToml(t('a = """', 'one', 'two"""'))).toEqual({ a: 'one\ntwo' })
    expect(parseToml(t("a = '''", 'raw \\n stays', "'''"))).toEqual({ a: 'raw \\n stays\n' })
    expect(parseToml(t('a = """The quick \\', '    brown \\', '  fox"""'))).toEqual({ a: 'The quick brown fox' })
    expect(parseToml('a = """say ""hi"""""')).toEqual({ a: 'say ""hi""' })
  })
})

describe('arrays and inline tables', () => {
  it('reads arrays, also over lines with comments and trailing commas', () => {
    expect(parseToml(t('a = [1, 2, 3]', 'b = [', '  "x", # first', '  "y",', ']', 'c = []', 'd = [[1, 2], ["a"]]', 'e = [1, "mixed", true]'))).toEqual({
      a: [1, 2, 3], b: ['x', 'y'], c: [], d: [[1, 2], ['a']], e: [1, 'mixed', true],
    })
  })
  it('reads inline tables', () => {
    expect(parseToml(t('a = { x = 1, y = "two" }', 'b = {}', 'c = { d.e = 1, f = [1, { g = 2 }] }'))).toEqual({
      a: { x: 1, y: 'two' }, b: {}, c: { d: { e: 1 }, f: [1, { g: 2 }] },
    })
  })
})

describe('tables', () => {
  it('reads [tables] and nested [a.b] tables', () => {
    expect(parseToml(t('top = 1', '[server]', 'host = "x"', '[server.tls]', 'on = true', '[other]', 'k = 2'))).toEqual({
      top: 1, server: { host: 'x', tls: { on: true } }, other: { k: 2 },
    })
  })
  it('lets a parent table be defined after its child', () => {
    expect(parseToml(t('[a.b]', 'x = 1', '[a]', 'y = 2'))).toEqual({ a: { b: { x: 1 }, y: 2 } })
  })
  it('reads arrays of tables', () => {
    expect(parseToml(t('[[products]]', 'name = "Hammer"', '[[products]]', 'name = "Nail"', '[products.dims]', 'w = 1', '[[products]]'))).toEqual({
      products: [{ name: 'Hammer' }, { name: 'Nail', dims: { w: 1 } }, {}],
    })
    expect(parseToml(t('[[a.b]]', 'x = 1', '[[a.b]]', 'x = 2'))).toEqual({ a: { b: [{ x: 1 }, { x: 2 }] } })
  })
  it('reads nested arrays of tables', () => {
    expect(parseToml(t('[[fruit]]', 'name = "apple"', '[[fruit.variety]]', 'name = "red"', '[[fruit]]', 'name = "banana"'))).toEqual({
      fruit: [{ name: 'apple', variety: [{ name: 'red' }] }, { name: 'banana' }],
    })
  })
  it('reads quoted table names', () => {
    expect(parseToml(t('["a b".c]', 'x = 1'))).toEqual({ 'a b': { c: { x: 1 } } })
  })
})

describe('errors', () => {
  it('rejects duplicate keys and tables, with the line', () => {
    expect(bad(t('a = 1', 'a = 2'))).toMatch(/^Line 2: Duplicate key "a"/)
    expect(bad(t('[a]', '[a]'))).toMatch(/^Line 2: The table \[a\] is already defined/)
    expect(bad(t('a = 1', '[a]'))).toMatch(/already defined/)
    expect(bad(t('a.b = 1', '[a]'))).toMatch(/already defined/)
  })
  it('rejects extending inline tables and mixing table kinds', () => {
    expect(bad(t('a = { x = 1 }', '[a.y]'))).toMatch(/cannot be extended/)
    expect(bad(t('a = [1]', '[[a]]'))).toMatch(/not an array of tables/)
    expect(bad(t('[[a]]', '[a]'))).toMatch(/already defined/)
  })
  it('rejects malformed text', () => {
    expect(bad('a')).toMatch(/Expected =/)
    expect(bad('a =')).toMatch(/Expected a value/)
    expect(bad('a = hello')).toMatch(/Cannot read the value "hello"/)
    expect(bad('a = "open')).toMatch(/never closed/)
    expect(bad('a = [1, 2')).toMatch(/\[ is never closed|Expected/)
    expect(bad('a = 1 b = 2')).toMatch(/expected the end of the line/)
    expect(bad('= 1')).toMatch(/where a key should be/)
    expect(bad('[a')).toMatch(/Expected \]/)
    expect(bad('a = "\\q"')).toMatch(/Unknown escape/)
    expect(bad('a = 007')).toMatch(/Cannot read/)
    expect(bad('a = { x = 1,\n y = 2 }')).toMatch(/one line|Expected/)
    expect(bad('a = """x""""""')).toMatch(/Too many quotes/)
  })
})

describe('toToml', () => {
  it('writes simple values, then tables, then arrays of tables', () => {
    const { text, warnings } = toToml({ title: 'x', n: 1, tags: ['a', 'b'], server: { host: 'h', port: 80, tls: { on: true } }, items: [{ a: 1 }, { a: 2, sub: { z: 1 } }] })
    expect(text).toBe(t('title = "x"', 'n = 1', 'tags = ["a", "b"]', '', '[server]', 'host = "h"', 'port = 80', '', '[server.tls]', 'on = true', '', '[[items]]', 'a = 1', '', '[[items]]', 'a = 2', '', '[items.sub]', 'z = 1', ''))
    expect(warnings).toEqual([])
  })
  it('skips the header of a table that only holds tables', () => {
    expect(toToml({ a: { b: { c: 1 } } }).text).toBe(t('[a.b]', 'c = 1', ''))
  })
  it('writes empty tables and arrays', () => {
    expect(toToml({ a: {}, b: [] }).text).toBe(t('b = []', '', '[a]', ''))
  })
  it('quotes keys and escapes strings', () => {
    expect(toToml({ 'a b': 'say "hi"\n', 'x.y': 1, ok_1: 2, '': 3 }).text).toBe(t('"a b" = "say \\"hi\\"\\n"', '"x.y" = 1', 'ok_1 = 2', '"" = 3', ''))
  })
  it('writes mixed arrays with inline tables', () => {
    expect(toToml({ a: [1, { b: 2 }, 'x'], c: [[1, 2], [3]] }).text).toBe(t('a = [1, { b = 2 }, "x"]', 'c = [[1, 2], [3]]', ''))
  })
  it('writes numbers, including special ones', () => {
    expect(toToml({ a: 1.5, b: -3, c: 1e21, d: NaN, e: Infinity, f: -Infinity, g: 1e-7 }).text).toBe(t('a = 1.5', 'b = -3', 'c = 1e+21', 'd = nan', 'e = inf', 'f = -inf', 'g = 1e-7', ''))
  })
  it('leaves out nulls and says so', () => {
    const r = toToml({ a: null, b: 1, c: { d: null }, e: [1, null, 2], f: [{ g: null, h: 1 }] })
    expect(r.text).toBe(t('b = 1', 'e = [1, 2]', '', '[c]', '', '[[f]]', 'h = 1', ''))
    expect(r.warnings[0]).toMatch(/^TOML has no null: left out 4 values \(a, e\[1\], c\.d, f\.g\)/)
    expect(toToml({ a: null }).warnings[0]).toBe('TOML has no null: left out a')
  })
  it('refuses anything but a map at the top', () => {
    expect(() => toToml([1])).toThrow(/map/)
    expect(() => toToml('x')).toThrow(TomlError)
    expect(() => toToml(null)).toThrow(TomlError)
  })
  it('writes an empty map as empty text', () => {
    expect(toToml({}).text).toBe('')
  })
})

describe('round trips', () => {
  const samples = [
    { title: 'x', n: 1, f: 1.5, ok: true, s: 'line\nbreak "q" \\ é 😀', tags: ['a', 'b'], nested: { a: { b: { c: [1, 2, { d: 1 }] } } } },
    { items: [{ a: 1, sub: { z: [1, 2] } }, { a: 2 }], other: { x: 1 } },
    { 'a b': { 'c.d': { 'e f': 1 } }, empty: {}, list: [] },
    { m: [[1, 2], ['a', 'b'], []] },
  ]
  it.each(samples.map((s, i) => [i, s]))('sample %i survives write then read', (_, value) => {
    expect(parseToml(toToml(value).text)).toEqual(value)
  })
})
