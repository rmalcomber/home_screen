import { describe, it, expect } from 'vitest'
import { parseYaml, toYaml, resolveScalar, plainSafe, YamlError } from './yaml.js'

const y = (...lines) => lines.join('\n')
const bad = (text) => {
  try {
    parseYaml(text)
  } catch (e) {
    expect(e).toBeInstanceOf(YamlError)
    return e.message
  }
  throw new Error(`expected an error for: ${JSON.stringify(text)}`)
}

describe('resolveScalar', () => {
  it('follows the YAML 1.2 core schema', () => {
    expect(resolveScalar('')).toBeNull()
    expect(resolveScalar('~')).toBeNull()
    expect(resolveScalar('Null')).toBeNull()
    expect(resolveScalar('true')).toBe(true)
    expect(resolveScalar('FALSE')).toBe(false)
    expect(resolveScalar('42')).toBe(42)
    expect(resolveScalar('-7')).toBe(-7)
    expect(resolveScalar('0x1F')).toBe(31)
    expect(resolveScalar('0o17')).toBe(15)
    expect(resolveScalar('3.14')).toBe(3.14)
    expect(resolveScalar('.5')).toBe(0.5)
    expect(resolveScalar('1e3')).toBe(1000)
    expect(resolveScalar('-1.5E-2')).toBe(-0.015)
  })
  it('keeps everything else as text', () => {
    for (const s of ['yes', 'no', 'on', 'hello', '1.2.3', '12:30', '2024-01-01', '0b101', '1_000', '.inf', 'nulls', 'True1']) expect(resolveScalar(s), s).toBe(s)
    expect(resolveScalar('12345678901234567890')).toBe('12345678901234567890') // too big to keep exactly
  })
})

describe('block maps and lists', () => {
  it('reads nested maps', () => {
    expect(parseYaml(y('name: Home', 'server:', '  host: localhost', '  port: 8080', '  tls:', '    enabled: true', 'debug: false'))).toEqual({
      name: 'Home', server: { host: 'localhost', port: 8080, tls: { enabled: true } }, debug: false,
    })
  })
  it('reads lists of scalars and of maps', () => {
    expect(parseYaml(y('- a', '- 2', '- true', '-', '- null'))).toEqual(['a', 2, true, null, null])
    expect(parseYaml(y('users:', '  - name: ada', '    id: 1', '  - name: bob', '    id: 2'))).toEqual({ users: [{ name: 'ada', id: 1 }, { name: 'bob', id: 2 }] })
  })
  it('allows a list at the same indent as its key', () => {
    expect(parseYaml(y('items:', '- a', '- b', 'other: 1'))).toEqual({ items: ['a', 'b'], other: 1 })
  })
  it('reads lists inside lists and nested blocks under a dash', () => {
    expect(parseYaml(y('- - a', '  - b', '- - c'))).toEqual([['a', 'b'], ['c']])
    expect(parseYaml(y('-', '  x: 1', '  y: 2', '- z'))).toEqual([{ x: 1, y: 2 }, 'z'])
  })
  it('treats an empty value as null and an empty document as null', () => {
    expect(parseYaml(y('a:', 'b: ~', 'c:'))).toEqual({ a: null, b: null, c: null })
    expect(parseYaml('')).toBeNull()
    expect(parseYaml('# only a comment\n\n')).toBeNull()
  })
  it('reads a lone scalar document', () => {
    expect(parseYaml('hello')).toBe('hello')
    expect(parseYaml('42')).toBe(42)
    expect(parseYaml('"quoted"')).toBe('quoted')
  })
  it('keeps keys as text and allows quoted keys and colons in values', () => {
    expect(parseYaml(y('1: one', '"two words": 2', "'it''s': 3", 'url: http://example.com:8080/x', 'time: 12:30'))).toEqual({
      1: 'one', 'two words': 2, "it's": 3, url: 'http://example.com:8080/x', time: '12:30',
    })
  })
  it('reads values after a key with a colon in a quoted key', () => {
    expect(parseYaml('"a: b": c')).toEqual({ 'a: b': 'c' })
  })
})

describe('comments and document markers', () => {
  it('ignores comments', () => {
    expect(parseYaml(y('# top', 'a: 1 # trailing', 'b: "x # not a comment"', 'c: x#y', '', '  # indented comment', 'd: 2'))).toEqual({ a: 1, b: 'x # not a comment', c: 'x#y', d: 2 })
  })
  it('accepts a leading --- and a trailing ...', () => {
    expect(parseYaml(y('---', 'a: 1', '...'))).toEqual({ a: 1 })
    expect(parseYaml(y('%YAML 1.2', '---', 'a: 1'))).toEqual({ a: 1 })
  })
})

describe('quoted scalars', () => {
  it('reads double-quoted escapes', () => {
    expect(parseYaml('a: "line\\nbreak\\ttab \\"q\\" \\\\ \\u00e9 \\x41"')).toEqual({ a: 'line\nbreak\ttab "q" \\ é A' })
  })
  it('reads single-quoted text, where only a doubled quote is special', () => {
    expect(parseYaml("a: 'it''s \\n literal'")).toEqual({ a: "it's \\n literal" })
  })
  it('folds a quoted scalar over lines', () => {
    expect(parseYaml(y('a: "one', '  two', '', '  three"', 'b: 1'))).toEqual({ a: 'one two\nthree', b: 1 })
    expect(parseYaml(y("a: 'x", "  y'"))).toEqual({ a: 'x y' })
  })
  it('keeps text that looks like other types when quoted', () => {
    expect(parseYaml(y('a: "123"', "b: 'true'", 'c: ""'))).toEqual({ a: '123', b: 'true', c: '' })
  })
})

describe('flow collections', () => {
  it('reads inline lists and maps', () => {
    expect(parseYaml('a: [1, two, "three", [4, 5], {six: 6}]')).toEqual({ a: [1, 'two', 'three', [4, 5], { six: 6 }] })
    expect(parseYaml('{a: 1, "b c": [x, y], d, e: }')).toEqual({ a: 1, 'b c': ['x', 'y'], d: null, e: null })
    expect(parseYaml('[]')).toEqual([])
    expect(parseYaml('{}')).toEqual({})
    expect(parseYaml('- [a, b]\n- {c: d}')).toEqual([['a', 'b'], { c: 'd' }])
  })
  it('reads collections over several lines, with comments and trailing commas', () => {
    expect(parseYaml(y('a: [', '  1, # one', '  2,', ']', 'b: {', '  x: 1,', '  y: 2', '}'))).toEqual({ a: [1, 2], b: { x: 1, y: 2 } })
  })
  it('reports an unclosed collection', () => {
    expect(bad('a: [1, 2')).toMatch(/never closed/)
  })
})

describe('block scalars', () => {
  it('reads literal blocks and chomping', () => {
    expect(parseYaml(y('a: |', '  line 1', '  line 2', 'b: 1'))).toEqual({ a: 'line 1\nline 2\n', b: 1 })
    expect(parseYaml(y('a: |-', '  x', '  y', ''))).toEqual({ a: 'x\ny' })
    expect(parseYaml(y('a: |+', '  x', '', '', 'b: 1'))).toEqual({ a: 'x\n\n\n', b: 1 })
  })
  it('keeps relative indentation and blank lines inside a block', () => {
    expect(parseYaml(y('a: |', '  def f():', '      return 1', '', '  done'))).toEqual({ a: 'def f():\n    return 1\n\ndone\n' })
  })
  it('folds > blocks', () => {
    expect(parseYaml(y('a: >', '  one', '  two', '', '  three', 'b: 1'))).toEqual({ a: 'one two\nthree\n', b: 1 })
    expect(parseYaml(y('a: >-', '  x', '  y'))).toEqual({ a: 'x y' })
  })
  it('works in lists and with an explicit indent', () => {
    expect(parseYaml(y('- |', '  a', '  b', '- c'))).toEqual(['a\nb\n', 'c'])
    expect(parseYaml(y('a: |2', '    indented', '  base'))).toEqual({ a: '  indented\nbase\n' })
  })
  it('reads an empty block', () => {
    expect(parseYaml(y('a: |', 'b: 1'))).toEqual({ a: '', b: 1 })
  })
})

describe('what it refuses', () => {
  it('rejects anchors, aliases, tags and merge keys with the line', () => {
    expect(bad(y('a: &x 1', 'b: *x'))).toMatch(/^Line 1: Anchors, aliases and tags/)
    expect(bad('a: *x')).toMatch(/Anchors/)
    expect(bad('a: !!str 1')).toMatch(/Anchors, aliases and tags/)
    expect(bad(y('base: 1', '<<: x'))).toMatch(/^Line 2: Merge keys/)
    expect(bad('&a key: 1')).toMatch(/Anchors/)
  })
  it('rejects complex keys and several documents', () => {
    expect(bad('? a\n: b')).toMatch(/Complex keys/)
    expect(bad(y('a: 1', '---', 'b: 2'))).toMatch(/Several documents/)
  })
  it('rejects tabs, duplicate keys and bad indentation', () => {
    expect(bad('a:\n\tb: 1')).toMatch(/^Line 2: Tabs/)
    expect(bad(y('a: 1', 'a: 2'))).toMatch(/^Line 2: Duplicate key "a"/)
    expect(bad(y('a: 1', '   b: 2'))).toMatch(/^Line 2: Unexpected indentation/)
    expect(bad(y('a: first', '  second'))).toMatch(/long plain value/)
  })
  it('rejects values that are probably mistakes', () => {
    expect(bad('a: b: c')).toMatch(/": "/)
    expect(bad('a: - b')).toMatch(/list cannot start/)
    expect(bad('a: @x')).toMatch(/cannot start a value/)
    expect(bad('a: "x" y')).toMatch(/after the closing quote/)
    expect(bad('a: "never')).toMatch(/never closed/)
    expect(bad('just text\nmore text')).toMatch(/Unexpected content|Expected/)
    expect(bad('a: "\\q"')).toMatch(/Unknown escape/)
  })
})

describe('plainSafe', () => {
  it('quotes anything that would be read back differently', () => {
    for (const s of ['', ' x', 'x ', 'true', 'No', 'null', '~', '123', '1.5', '0x1f', '2024-01-01', '12:30', '- a', '-', 'a: b', 'a #b', '#x', '@x', '&x', '*x', '!x', '[x', '{x', '|x', '>x', "'x", '"x', '%x', 'a\nb', 'a\tb', '---', 'key:', '.inf', 'Off']) expect(plainSafe(s), JSON.stringify(s)).toBe(false)
  })
  it('keeps ordinary text plain', () => {
    for (const s of ['hello', 'hello world', 'a-b', 'a:b', 'http://x.dev/a?b=c', 'x#y', 'ünïcode', '1.2.3', 'v1', 'a,b', '-x', 'a/b']) expect(plainSafe(s), s).toBe(true)
  })
})

describe('toYaml', () => {
  it('writes maps, lists and scalars', () => {
    expect(toYaml({ name: 'Home', count: 3, ok: true, none: null, tags: ['a', 'b'], server: { host: 'x', ports: [80, 443] } })).toBe(
      y('name: Home', 'count: 3', 'ok: true', 'none: null', 'tags:', '  - a', '  - b', 'server:', '  host: x', '  ports:', '    - 80', '    - 443', ''),
    )
  })
  it('writes lists of maps and of lists compactly', () => {
    expect(toYaml([{ a: 1, b: { c: 2 } }, [1, [2, 3]], 'x'])).toBe(y('- a: 1', '  b:', '    c: 2', '- - 1', '  - - 2', '    - 3', '- x', ''))
  })
  it('writes empty containers inline', () => {
    expect(toYaml({ a: [], b: {}, c: [[]] })).toBe(y('a: []', 'b: {}', 'c:', '  - []', ''))
    expect(toYaml([])).toBe('[]\n')
    expect(toYaml({})).toBe('{}\n')
  })
  it('quotes strings that would change type', () => {
    expect(toYaml({ a: 'true', b: '123', c: '', d: 'a: b', e: 'x', 'k y': 1, yes: 2, 1: 3 })).toBe(
      y('"1": 3', 'a: "true"', 'b: "123"', "c: ''", 'd: "a: b"', 'e: x', 'k y: 1', '"yes": 2', ''),
    )
  })
  it('writes multi-line strings as block scalars', () => {
    expect(toYaml({ a: 'one\ntwo', b: 'x\n', c: 'y\n\n' })).toBe(y('a: |-', '  one', '  two', 'b: |', '  x', 'c: |+', '  y', '', ''))
    expect(toYaml(['a\nb'])).toBe(y('- |-', '  a', '  b', ''))
  })
  it('falls back to quotes when a block would be misread', () => {
    expect(toYaml({ a: ' lead\nx' })).toBe('a: " lead\\nx"\n')
    expect(toYaml({ a: 'cr\r\nx' })).toBe('a: "cr\\r\\nx"\n')
  })
  it('writes top-level scalars', () => {
    expect(toYaml('hi')).toBe('hi\n')
    expect(toYaml(5)).toBe('5\n')
    expect(toYaml(null)).toBe('null\n')
  })
  it('writes special numbers', () => {
    expect(toYaml([NaN, Infinity, -Infinity, 1.5, -0.25])).toBe(y('- .nan', '- .inf', '- -.inf', '- 1.5', '- -0.25', ''))
  })
})

describe('round trips', () => {
  const samples = [
    { a: 1, b: [1, 2, { c: 'x' }], d: { e: null, f: 'multi\nline\n', g: 'true', h: '  spaced  ', i: 'ünï 😀', j: 'a: b # c' } },
    [[], {}, [[1]], [{ a: [] }], 'x', null, true, 3.5],
    { 'key with spaces': 1, 'a:b': 2, '': 3, '#': 4, '- x': 5, '[': 6 },
    'plain', 12, null, false, [], {},
    { deep: { deeper: { deepest: [1, { x: ['a', ['b']] }] } } },
    { s: ['', ' ', '\t', '\n', 'a\nb\n\n', '"', "'", '\\', '---', '...'] },
  ]
  it.each(samples.map((s, i) => [i, s]))('sample %i survives write then read', (_, value) => {
    expect(parseYaml(toYaml(value))).toEqual(value)
  })
  it('reads JSON as YAML', () => {
    const json = '{"a": [1, 2, {"b": null}], "c": "text", "d": {"e": true}}'
    expect(parseYaml(json)).toEqual(JSON.parse(json))
  })
})
