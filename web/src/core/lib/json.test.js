import { describe, it, expect } from 'vitest'
import { parseJson, formatJson, stats, looksLikeJson, highlight } from './json.js'

describe('parseJson', () => {
  it('parses strict JSON', () => {
    const r = parseJson('{"a":[1,2,{"b":null}],"c":"x"}')
    expect(r).toMatchObject({ ok: true, relaxed: false, unwrapped: false })
    expect(r.value.a[2]).toEqual({ b: null })
  })
  it('accepts comments, trailing commas, single quotes and bare keys', () => {
    const r = parseJson(`{ // c
      name: 'it\\'s', /* x */ list: [1, 2,], "ok": true, }`)
    expect(r.ok).toBe(true)
    expect(r.relaxed).toBe(true)
    expect(r.value).toEqual({ name: "it's", list: [1, 2], ok: true })
  })
  it('unwraps JSON-encoded strings', () => {
    const r = parseJson('"{\\"a\\":1}"')
    expect(r).toMatchObject({ ok: true, unwrapped: true, value: { a: 1 } })
  })
  it('reports errors with line and column', () => {
    const r = parseJson('{\n  "a": 1,\n  "b": }\n')
    expect(r.ok).toBe(false)
    expect(r.error.line).toBe(3)
    expect(r.error.snippet).toContain('"b"')
    expect(parseJson('{"a": 1} x').ok).toBe(false)
  })
})

describe('format', () => {
  const v = { b: 1, a: { d: [1], c: 2 } }
  it('pretty prints, minifies and sorts', () => {
    expect(formatJson(v)).toBe('{\n  "b": 1,\n  "a": {\n    "d": [\n      1\n    ],\n    "c": 2\n  }\n}')
    expect(formatJson(v, { minify: true })).toBe('{"b":1,"a":{"d":[1],"c":2}}')
    expect(formatJson(v, { sort: true, minify: true })).toBe('{"a":{"c":2,"d":[1]},"b":1}')
    expect(formatJson([1], { indent: 'tab' })).toBe('[\n\t1\n]')
  })
  it('computes stats', () => {
    expect(stats(v)).toMatchObject({ type: 'object · 2 keys', depth: 4 })
    expect(stats([1, 2])).toMatchObject({ type: 'array · 2 items' })
  })
})

describe('detection and highlighting', () => {
  it('only claims JSON-looking input', () => {
    expect(looksLikeJson('{"a":1}')).toBe(true)
    expect(looksLikeJson('  [1,2]')).toBe(true)
    expect(looksLikeJson('"{\\"a\\":1}"')).toBe(true)
    expect(looksLikeJson('github')).toBe(false)
    expect(looksLikeJson('1+1')).toBe(false)
  })
  it('tokenises', () => {
    const t = highlight('{"k": "v", "n": 1.5, "b": true}')
    expect(t.filter((x) => x.cls).map((x) => x.text)).toEqual(['"k"', '"v"', '"n"', '1.5', '"b"', 'true'])
  })
})
