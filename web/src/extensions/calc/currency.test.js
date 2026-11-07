import { describe, it, expect } from 'vitest'
import { parseCurrency, convertCurrency } from './currency.js'

const rates = { EUR: 1, USD: 1.08, GBP: 0.83393, JPY: 177.85 }

describe('currency', () => {
  it('parses conversions', () => {
    expect(parseCurrency('100 usd to gbp')).toEqual({ amount: 100, from: 'USD', to: 'GBP' })
    expect(parseCurrency('£50 in eur')).toEqual({ amount: 50, from: 'GBP', to: 'EUR' })
    expect(parseCurrency('20 dollars to yen')).toEqual({ amount: 20, from: 'USD', to: 'JPY' })
    expect(parseCurrency('100usd->gbp')).toEqual({ amount: 100, from: 'USD', to: 'GBP' })
    expect(parseCurrency('usd to gbp')).toEqual({ amount: 1, from: 'USD', to: 'GBP' })
    expect(parseCurrency('2*50 eur to usd')).toEqual({ amount: 100, from: 'EUR', to: 'USD' })
  })
  it('rejects non-currency input', () => {
    expect(parseCurrency('github')).toBeNull()
    expect(parseCurrency('10 km to miles')).toBeNull()
    expect(parseCurrency('1+1')).toBeNull()
    expect(parseCurrency('100 usd to usd')).toBeNull()
  })
  it('converts using EUR-based rates', () => {
    const r = convertCurrency({ amount: 100, from: 'USD', to: 'GBP' }, rates)
    expect(r.text).toBe('77.22')
    expect(r.label).toBe('100 USD = 77.22 GBP')
    expect(convertCurrency({ amount: 1, from: 'USD', to: 'XXX' }, rates)).toBeNull()
  })
})
