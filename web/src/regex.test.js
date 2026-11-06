import { describe, it, expect } from 'vitest'
import { execute, segments, toLiteral, parseRegexCommand } from './launcher/regex.js'

const run = (o) => execute({ flags: 'g', text: '', replacement: null, max: 500, ...o })

describe('execute', () => {
  it('finds all matches with groups and named groups', () => {
    const r = run({ pattern: '(?<k>\\w+)=(\\d+)', text: 'a=1, bb=22' })
    expect(r.matches).toHaveLength(2)
    expect(r.matches[1]).toMatchObject({ index: 5, text: 'bb=22', groups: ['bb', '22'], named: { k: 'bb' } })
  })
  it('respects flags and non-global exec', () => {
    expect(run({ pattern: 'a', flags: '', text: 'aaa' }).matches).toHaveLength(1)
    expect(run({ pattern: 'A', flags: 'gi', text: 'aaa' }).matches).toHaveLength(3)
    expect(run({ pattern: '^b', flags: 'gm', text: 'a\nb' }).matches).toHaveLength(1)
  })
  it('handles zero-length matches, limits and replacement', () => {
    expect(run({ pattern: 'x*', text: 'ab' }).matches).toHaveLength(3)
    const r = run({ pattern: '\\d', text: '1234', max: 2 })
    expect(r).toMatchObject({ truncated: true })
    expect(r.matches).toHaveLength(2)
    expect(run({ pattern: '(\\w+)@(\\w+)', text: 'me@host', replacement: '$2:$1' }).replaced).toBe('host:me')
  })
  it('reports invalid patterns', () => {
    expect(run({ pattern: '(', text: 'x' }).error).toMatch(/Invalid regular expression/i)
  })
})

describe('helpers', () => {
  it('splits text into highlighted segments', () => {
    const text = 'a1b22'
    const r = run({ pattern: '\\d+', text })
    expect(segments(text, r.matches)).toEqual([
      { text: 'a', match: null }, { text: '1', match: 0 }, { text: 'b', match: null }, { text: '22', match: 1 },
    ])
  })
  it('escapes slashes for the literal form', () => {
    expect(toLiteral('a/b')).toBe('a\\/b')
    expect(toLiteral('a\\/b[/]')).toBe('a\\/b[/]')
  })
  it('parses commands', () => {
    expect(parseRegexCommand('regex')).toEqual({ pattern: '', flags: 'g', text: '' })
    expect(parseRegexCommand('re /\\d+/gi abc 123')).toEqual({ pattern: '\\d+', flags: 'gi', text: 'abc 123' })
    expect(parseRegexCommand('re /a[/]b\\/c/ x')).toEqual({ pattern: 'a[/]b\\/c', flags: '', text: 'x' })
    expect(parseRegexCommand('regex ^\\w+$\nline one\nline two')).toEqual({ pattern: '^\\w+$', flags: 'g', text: 'line one\nline two' })
    expect(parseRegexCommand('regexp /x/q')).toMatchObject({ pattern: '/x/q' }) // invalid flag: treated as a plain pattern
    expect(parseRegexCommand('regex101')).toBeNull()
    expect(parseRegexCommand('re')).toBeNull()
    expect(parseRegexCommand('read me')).toBeNull()
  })
})
