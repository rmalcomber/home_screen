import { describe, it, expect } from 'vitest'
import { diffSeq, computeDiff, splitLines, intraLine, toUnifiedDiff, parseDiffCommand, diffFill } from './engine.js'

// apply an edit script to `a`; the result must equal `b`
const apply = (a, b, ops) => ops.filter((o) => o.t !== 'del').map((o) => (o.t === 'eq' ? a[o.a] : b[o.b]))
const lines = (n, f = (i) => 'l' + i) => Array.from({ length: n }, (_, i) => f(i)).join('\n')

describe('diffSeq (Myers)', () => {
  it('produces a script that rebuilds b from a', () => {
    const cases = [
      [[], []], [['a'], []], [[], ['a']], [['a', 'b', 'c'], ['a', 'b', 'c']],
      [['a', 'b', 'c', 'a', 'b', 'b', 'a'], ['c', 'b', 'a', 'b', 'a', 'c']],
      [['x'], ['y']],
    ]
    for (const [a, b] of cases) expect(apply(a, b, diffSeq(a, b).ops)).toEqual(b)
  })
  it('is minimal for the classic example (edit distance 5)', () => {
    const ops = diffSeq([...'ABCABBA'], [...'CBABAC']).ops
    expect(ops.filter((o) => o.t !== 'eq')).toHaveLength(5)
  })
  it('survives random inputs', () => {
    let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    for (let t = 0; t < 200; t++) {
      const mk = () => Array.from({ length: Math.floor(rnd() * 25) }, () => 'abcd'[Math.floor(rnd() * 4)])
      const a = mk()
      const b = mk()
      expect(apply(a, b, diffSeq(a, b).ops)).toEqual(b)
    }
  })
  it('falls back to replace-all when too different', () => {
    const a = Array.from({ length: 50 }, (_, i) => 'a' + i)
    const b = Array.from({ length: 50 }, (_, i) => 'b' + i)
    const r = diffSeq(a, b, 5)
    expect(r.tooDifferent).toBe(true)
    expect(apply(a, b, r.ops)).toEqual(b)
  })
})

describe('computeDiff', () => {
  it('pairs changed lines and numbers them', () => {
    const { rows, stats } = computeDiff('one\ntwo\nthree\nfour', 'one\n2\nthree\nfour\nfive')
    expect(rows.map((r) => r.kind)).toEqual(['eq', 'mod', 'eq', 'eq', 'add'])
    expect(rows[1]).toMatchObject({ an: 2, bn: 2, aText: 'two', bText: '2' })
    expect(rows[4]).toMatchObject({ bn: 5, text: 'five' })
    expect(stats).toEqual({ added: 2, removed: 1, changed: 1, identical: false })
  })
  it('reports identical text and handles empty input and trailing newlines', () => {
    expect(computeDiff('a\nb\n', 'a\nb').stats.identical).toBe(true)
    expect(computeDiff('', '').stats.identical).toBe(true)
    expect(computeDiff('', 'x').rows).toEqual([{ kind: 'add', bn: 1, text: 'x' }])
    expect(splitLines('a\r\nb\n')).toEqual(['a', 'b'])
  })
  it('can ignore whitespace and case', () => {
    expect(computeDiff('a  b\nC', 'a b\nc').stats.identical).toBe(false)
    expect(computeDiff('a  b\nC', 'a b\nc', { ignoreWs: true, ignoreCase: true }).stats.identical).toBe(true)
  })
})

describe('intraLine', () => {
  it('marks only the changed words', () => {
    const { aParts, bParts } = intraLine('const x = 10;', 'const x = 20;')
    expect(aParts.filter((p) => p.changed).map((p) => p.text)).toEqual(['10'])
    expect(bParts.filter((p) => p.changed).map((p) => p.text)).toEqual(['20'])
    expect(aParts.map((p) => p.text).join('')).toBe('const x = 10;')
  })
})

describe('unified output', () => {
  it('matches the standard format (nearby changes share a hunk)', () => {
    const a = lines(10, (i) => 'abcdefghij'[i])
    const b = a.replace('e', 'E') + '\nk'
    expect(toUnifiedDiff(computeDiff(a, b).rows, 'old.txt', 'new.txt')).toBe(
      ['--- old.txt', '+++ new.txt', '@@ -2,9 +2,10 @@', ' b', ' c', ' d', '-e', '+E', ' f', ' g', ' h', ' i', ' j', '+k', ''].join('\n'),
    )
  })
  it('splits distant changes into separate hunks', () => {
    const a = lines(20)
    const b = a.replace('l1\n', 'L1\n').replace('l18', 'L18')
    const out = toUnifiedDiff(computeDiff(a, b).rows)
    expect(out.match(/^@@ /gm)).toHaveLength(2)
    expect(out).toContain('@@ -1,5 +1,5 @@')
    expect(out).toContain('@@ -16,5 +16,5 @@')
  })
  it('is empty when nothing changed and groups dels before adds', () => {
    expect(toUnifiedDiff(computeDiff('x', 'x').rows)).toBe('')
    expect(toUnifiedDiff(computeDiff('1\n2', 'a\nb').rows)).toBe('--- a\n+++ b\n@@ -1,2 +1,2 @@\n-1\n-2\n+a\n+b\n')
  })
})

describe('parseDiffCommand', () => {
  it('parses the command and the separator', () => {
    expect(parseDiffCommand('diff')).toEqual({ a: '', b: '' })
    expect(parseDiffCommand('diff old text')).toEqual({ a: 'old text', b: '' })
    expect(parseDiffCommand('diff\nline1\nline2\n=======\nline1\nlineX')).toEqual({ a: 'line1\nline2', b: 'line1\nlineX' })
    expect(parseDiffCommand(diffFill('a\nb', 'a\nc'))).toEqual({ a: 'a\nb', b: 'a\nc' })
    expect(parseDiffCommand('diffusion')).toBeNull()
    expect(parseDiffCommand('github')).toBeNull()
  })
})
