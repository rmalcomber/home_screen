import { describe, it, expect } from 'vitest'
import { parseChmodCommand, fromSymbolic, toSymbolic, toOctal, fromOctal, applySymbolic, parseMode, describeMode, knownMode, fromUmask } from './engine.js'

describe('parseChmodCommand', () => {
  it('recognises chmod, perm and umask', () => {
    expect(parseChmodCommand('chmod 755')).toEqual({ word: 'chmod', text: '755' })
    expect(parseChmodCommand(' PERM rwxr-xr-x ')).toEqual({ word: 'perm', text: 'rwxr-xr-x' })
    expect(parseChmodCommand('umask 022')).toEqual({ word: 'umask', text: '022' })
    expect(parseChmodCommand('chmod')).toEqual({ word: 'chmod', text: '' })
  })
  it('ignores other queries', () => {
    for (const q of ['', 'chmodding', 'a chmod', 'permission denied', 'umasks']) expect(parseChmodCommand(q), q).toBeNull()
  })
})

describe('octal and symbolic', () => {
  const pairs = [
    ['755', 'rwxr-xr-x'], ['644', 'rw-r--r--'], ['600', 'rw-------'], ['777', 'rwxrwxrwx'], ['000', '---------'], ['4755', 'rwsr-xr-x'],
    ['2755', 'rwxr-sr-x'], ['1777', 'rwxrwxrwt'], ['4644', 'rwSr--r--'], ['1666', 'rw-rw-rwT'],
  ]
  it.each(pairs)('%s <-> %s', (oct, sym) => {
    expect(toSymbolic(fromOctal(oct))).toBe(sym)
    expect(fromSymbolic(sym)).toBe(fromOctal(oct))
    expect(toOctal(fromOctal(oct))).toBe(oct)
  })
  it('accepts a leading file type character', () => {
    expect(fromSymbolic('-rwxr-xr-x')).toBe(0o755)
    expect(fromSymbolic('drwxr-xr-x')).toBe(0o755)
  })
  it('pads and rejects', () => {
    expect(toOctal(0o7)).toBe('007')
    expect(fromOctal('0644')).toBe(0o644)
    for (const s of ['889', '12', '77777', 'rwx', 'rwxrwxrwxx', 'rwxr-xr-q']) expect(fromOctal(s) ?? fromSymbolic(s), s).toBeNull()
  })
})

describe('applySymbolic', () => {
  it('adds, removes and sets', () => {
    expect(applySymbolic(0o644, 'u+x')).toBe(0o744)
    expect(applySymbolic(0o755, 'go-x')).toBe(0o744)
    expect(applySymbolic(0o000, 'u=rwx,go=rx')).toBe(0o755)
    expect(applySymbolic(0o644, 'a+x')).toBe(0o755)
    expect(applySymbolic(0o644, '+x')).toBe(0o755)
    expect(applySymbolic(0o777, 'o=')).toBe(0o770)
  })
  it('copies permissions from another class', () => {
    expect(applySymbolic(0o750, 'o=g')).toBe(0o755)
    expect(applySymbolic(0o700, 'go=u')).toBe(0o777)
  })
  it('handles X, s and t', () => {
    expect(applySymbolic(0o644, 'a+X')).toBe(0o644)
    expect(applySymbolic(0o744, 'a+X')).toBe(0o755)
    expect(applySymbolic(0o755, 'u+s')).toBe(0o4755)
    expect(applySymbolic(0o755, 'g+s')).toBe(0o2755)
    expect(applySymbolic(0o777, '+t')).toBe(0o1777)
    expect(applySymbolic(0o4755, 'u-s')).toBe(0o755)
  })
  it('rejects malformed clauses', () => {
    for (const s of ['x', 'u+q', 'u++x', 'z+x', 'u+x,']) expect(applySymbolic(0o644, s), s).toBeNull()
  })
})

describe('parseMode', () => {
  it('reads octal, symbolic, and a mode followed by clauses', () => {
    expect(parseMode('755')).toEqual({ ok: true, mode: 0o755 })
    expect(parseMode('rwxr-xr-x')).toEqual({ ok: true, mode: 0o755 })
    expect(parseMode('644 u+x,g+w')).toEqual({ ok: true, mode: 0o764 })
    expect(parseMode('644 u+x g+w')).toEqual({ ok: true, mode: 0o764 })
    expect(parseMode('u=rwx,go=rx')).toEqual({ ok: true, mode: 0o755 })
  })
  it('defaults to 644 with no argument', () => {
    expect(parseMode('')).toMatchObject({ ok: true, mode: 0o644, empty: true })
  })
  it('explains what it cannot read', () => {
    expect(parseMode('banana')).toEqual({ ok: false, error: 'Cannot read "banana" as a permission' })
    expect(parseMode('755 nonsense').ok).toBe(false)
    expect(parseMode('999').ok).toBe(false)
  })
})

describe('describeMode', () => {
  it('describes each class and special bits', () => {
    expect(describeMode(0o754).lines).toEqual([['Owner', 'read, write and execute'], ['Group', 'read and execute'], ['Everyone else', 'read only']])
    expect(describeMode(0o000).lines[0][1]).toBe('no access')
    expect(describeMode(0o4755).special[0]).toContain('setuid')
    expect(describeMode(0o1777).special[0]).toContain('sticky')
    expect(describeMode(0o755).special).toEqual([])
  })
  it('knows common modes', () => {
    expect(knownMode(0o644)).toContain('file')
    expect(knownMode(0o777)).toContain('rarely')
    expect(knownMode(0o123)).toBe('')
  })
})

describe('fromUmask', () => {
  it('works out default permissions', () => {
    expect(fromUmask('022')).toEqual({ umask: '022', file: 0o644, dir: 0o755 })
    expect(fromUmask('0077')).toMatchObject({ umask: '077', file: 0o600 })
    expect(fromUmask('077')).toMatchObject({ file: 0o600, dir: 0o700 })
    expect(fromUmask('002')).toMatchObject({ file: 0o664, dir: 0o775 })
  })
  it('rejects invalid values', () => {
    for (const s of ['', '22', '088', 'abc']) expect(fromUmask(s), s).toBeNull()
  })
})
