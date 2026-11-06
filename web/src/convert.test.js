import { describe, it, expect } from 'vitest'
import { convert } from './launcher/convert.js'

const c = (s) => convert(s)?.text

describe('unit converter', () => {
  it('converts linear units', () => {
    expect(c('10 km to miles')).toBe('6.2137119')
    expect(c('5 ft in cm')).toBe('152.4')
    expect(c('1 mile to km')).toBe('1.609344')
    expect(c('2h in min')).toBe('120')
    expect(c('1.5 gb to mb')).toBe('1500')
    expect(c('1 gib to mib')).toBe('1024')
    expect(c('100 kg to lb')).toBe('220.46226')
    expect(c('60 mph to km/h')).toBe('96.56064')
    expect(c('2 square meters to sqft')).toBe('21.527821')
  })
  it('converts temperature', () => {
    expect(c('100f to c')).toBe('37.777778')
    expect(c('0 c to f')).toBe('32')
    expect(c('0 °C in K')).toBe('273.15')
  })
  it('handles the "in" ambiguity and expressions', () => {
    expect(c('5 in in cm')).toBe('12.7')
    expect(c('2*5 km to m')).toBe('10000')
  })
  it('rejects non-conversions', () => {
    expect(convert('10 km to kg')).toBeNull()
    expect(convert('github')).toBeNull()
    expect(convert('10 km')).toBeNull()
    expect(convert('1+1')).toBeNull()
  })
})
