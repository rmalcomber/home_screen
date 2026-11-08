import { describe as suite, it, expect } from 'vitest'
import { countdownsOf, layoutOf, daysUntil, describe, sortCountdowns, normalise } from './timeutil.js'

const now = new Date(2026, 5, 15, 13, 30) // 15 June 2026, afternoon

suite('config migration', () => {
  it('turns the old single countdown into a list', () => {
    expect(countdownsOf({ kind: 'countdown', label: 'Trip', date: '2026-07-01' })).toEqual([{ label: 'Trip', date: '2026-07-01' }])
  })
  it('gives an empty list for an empty config and keeps a new list as is', () => {
    expect(countdownsOf({ kind: 'countdown', label: '', date: '' })).toEqual([])
    expect(countdownsOf(undefined)).toEqual([])
    const l = [{ label: 'a', date: '2026-01-01' }]
    expect(countdownsOf({ countdowns: l })).toBe(l)
    expect(countdownsOf({ countdowns: [], label: 'x', date: '2026-01-01' })).toEqual([])
  })
  it('layout defaults to list', () => {
    expect(layoutOf({})).toBe('list')
    expect(layoutOf({ layout: 'tiles' })).toBe('tiles')
    expect(layoutOf({ layout: 'x' })).toBe('list')
  })
})

suite('days', () => {
  it('counts whole days regardless of the time of day', () => {
    expect(daysUntil('2026-06-15', now)).toBe(0)
    expect(daysUntil('2026-06-16', now)).toBe(1)
    expect(daysUntil('2026-06-10', now)).toBe(-5)
    expect(daysUntil('2026-12-25', now)).toBe(193)
  })
  it('is null for missing or invalid dates', () => {
    expect(daysUntil('', now)).toBeNull()
    expect(daysUntil('soon', now)).toBeNull()
    expect(daysUntil('2026-13-45', now)).toBeNull()
    expect(daysUntil('2026-02-30', now)).toBeNull()
  })
  it('describes until, since and today with plurals', () => {
    expect(describe(3)).toEqual({ n: 3, word: 'days until' })
    expect(describe(1)).toEqual({ n: 1, word: 'day until' })
    expect(describe(0)).toEqual({ n: 0, word: 'today' })
    expect(describe(-1)).toEqual({ n: 1, word: 'day since' })
    expect(describe(-9)).toEqual({ n: 9, word: 'days since' })
    expect(describe(null).word).toBe('set a date')
  })
})

suite('sorting and saving', () => {
  it('puts upcoming first, then past, then undated', () => {
    const l = [{ label: 'old', date: '2026-01-01' }, { label: 'none', date: '' }, { label: 'far', date: '2026-12-01' }, { label: 'soon', date: '2026-06-20' }, { label: 'recent', date: '2026-06-14' }]
    expect(sortCountdowns(l, now).map((x) => x.label)).toEqual(['soon', 'far', 'recent', 'old', 'none'])
  })
  it('normalise drops blank rows and legacy keys, and keeps one empty row', () => {
    expect(normalise({ kind: 'countdown', label: 'Trip', date: '2026-07-01' })).toEqual({ kind: 'countdown', countdowns: [{ label: 'Trip', date: '2026-07-01' }], layout: 'list' })
    expect(normalise({ kind: 'countdown', countdowns: [{ label: ' a ', date: '' }, { label: '', date: '' }], layout: 'tiles' }).countdowns).toEqual([{ label: 'a', date: '' }])
    expect(normalise({ kind: 'countdown', countdowns: [] }).countdowns).toEqual([{ label: '', date: '' }])
  })
})
