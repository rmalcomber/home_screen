import { describe, it, expect } from 'vitest'
import { calculate } from './calc.js'

const v = (s) => calculate(s)?.text

describe('calculator', () => {
  it('evaluates expressions', () => {
    expect(v('1+1')).toBe('2')
    expect(v('(2+3)*4')).toBe('20')
    expect(v('2^10')).toBe('1024')
    expect(v('2**3**2')).toBe('512')
    expect(v('-3 + 5')).toBe('2')
    expect(v('10/4')).toBe('2.5')
    expect(v('0.1+0.2')).toBe('0.3')
    expect(v('sqrt(16)+max(1,2)')).toBe('6')
    expect(v('=7%4')).toBe('3')
    expect(v('2 × 3')).toBe('6')
  })
  it('ignores non-maths', () => {
    expect(calculate('github')).toBeNull()
    expect(calculate('5')).toBeNull()
    expect(calculate('pi')).toBeNull()
    expect(calculate('1+')).toBeNull()
    expect(calculate('foo(1)')).toBeNull()
    expect(calculate('1/0')).toBeNull()
    expect(calculate('alert(1)')).toBeNull()
  })
})
