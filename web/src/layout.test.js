import { describe, it, expect } from 'vitest'
import { compact } from './util.js'
import { layoutAll, stackLayout, columnize, balance, arrange, placeNew, GROUP_PAD_ROWS } from './layout.js'
import { PALETTE, colorValue } from './colors.js'

const t = (id, o = {}) => ({ id, type: 'bookmarks', title: `T${id}`, x: 0, y: 0, w: 4, h: 6, collapsed: false, parent_id: null, ...o })

describe('compact with a narrower container', () => {
  it('clamps widths and positions to the container', () => {
    const m = compact([t(1, { x: 5, w: 8 }), t(2, { x: 3, w: 2 })], null, {}, 4)
    expect(m.get(1)).toMatchObject({ x: 0, w: 4 })
    expect(m.get(2).x + m.get(2).w).toBeLessThanOrEqual(4)
  })
})

describe('layoutAll: groups', () => {
  const group = t(1, { type: 'group', w: 6, h: 14 })
  it('lays children out on the group grid, independent of the page', () => {
    const items = [group, t(2, { parent_id: 1, w: 3 }), t(3, { parent_id: 1, w: 3, x: 3 }), t(4, { x: 6, y: 0 })]
    const m = layoutAll(items, { mode: 'free' })
    expect(m.get(2)).toMatchObject({ x: 0, y: 0 })
    expect(m.get(3)).toMatchObject({ x: 3, y: 0 })
    expect(m.get(4)).toMatchObject({ x: 6, y: 0 })
  })
  it('keeps children inside a narrowed group', () => {
    const items = [{ ...group, w: 2 }, t(2, { parent_id: 1, w: 5, x: 4 })]
    const p = layoutAll(items, { mode: 'free' }).get(2)
    expect(p.x + p.w).toBeLessThanOrEqual(2)
  })
  it('grows a group to contain its children and pushes tiles below it', () => {
    const items = [{ ...group, h: 4 }, t(2, { parent_id: 1, h: 8 }), t(3, { y: 4, w: 6 })]
    const m = layoutAll(items, { mode: 'free' })
    expect(m.get(1).h).toBe(8 + GROUP_PAD_ROWS)
    expect(m.get(3).y).toBeGreaterThanOrEqual(m.get(1).y + m.get(1).h)
  })
  it('does not grow a collapsed group', () => {
    const items = [{ ...group, h: 4, collapsed: true }, t(2, { parent_id: 1, h: 8 })]
    expect(layoutAll(items, { mode: 'free' }).get(1).h).toBe(4)
  })
  it('previews a drop into a group through `over`', () => {
    const items = [group, t(2, { x: 8, w: 3 })]
    const m = layoutAll(items, { mode: 'free' }, 2, { 2: { parent_id: 1, x: 2, y: 3 } })
    expect(m.get(2)).toMatchObject({ x: 2, y: 3 })
  })
})

describe('columns mode', () => {
  it('snaps widths and positions to equal columns', () => {
    const c = columnize([t(1, { x: 5, w: 9 })], 3)
    expect(c[0]).toMatchObject({ w: 4, x: 4 })
    const m = layoutAll([t(1, { x: 5, w: 9 }), t(2, { x: 4, w: 2 })], { mode: 'columns', cols: 3 })
    expect(m.get(1).w).toBe(4)
    expect(m.get(2)).toMatchObject({ x: 4, w: 4 })
    expect(m.get(2).y).toBe(m.get(1).y + 6) // same column, stacked
  })
  it('places a new tile in the shortest column', () => {
    const items = [t(1, { x: 0, w: 4, h: 10 }), t(2, { x: 4, w: 4, h: 4 }), t(3, { x: 8, w: 4, h: 6 })]
    expect(placeNew(items, { mode: 'columns', cols: 3 })).toEqual({ x: 4, y: 4, w: 4 })
    expect(placeNew(items, { mode: 'free' }, null, 5)).toEqual({ x: 0, y: 10, w: 5 })
  })
})

describe('stackLayout (phones)', () => {
  it('stacks tiles and children in one column', () => {
    const items = [t(1, { type: 'group', h: 20 }), t(2, { parent_id: 1, h: 5 }), t(3, { parent_id: 1, h: 4, y: 9 }), t(4, { y: 30 })]
    const m = stackLayout(items)
    expect(m.get(2).y).toBe(0)
    expect(m.get(3).y).toBe(6)
    expect(m.get(1).h).toBe(6 + 5 + GROUP_PAD_ROWS)
    expect(m.get(4).y).toBe(m.get(1).y + m.get(1).h + 1)
    expect(m.get(4).w).toBe(12)
  })
})

describe('auto-arrange', () => {
  const items = [t(1, { title: 'banana', y: 0 }), t(2, { title: 'Apple', y: 10 }), t(3, { title: 'cherry', y: 20, type: 'dev' })]
  it('sorts A–Z left to right', () => {
    const m = compact(items, null, Object.fromEntries(arrange(items, 'alpha')))
    expect(m.get(2).x).toBe(0)
    expect(m.get(1).x).toBe(4)
    expect(m.get(3).x).toBe(8)
  })
  it('groups by type', () => {
    const m = arrange(items, 'type')
    expect(m.get(3).x).toBe(0) // developer tiles first
  })
  it('balances into columns using the shortest column', () => {
    const m = balance([t(1, { h: 10 }), t(2, { h: 4, y: 1 }), t(3, { h: 4, y: 2 }), t(4, { h: 4, y: 3 })], 2)
    expect(m.get(1)).toMatchObject({ x: 0, y: 0, w: 6 })
    expect(m.get(2)).toMatchObject({ x: 6, y: 0 })
    expect(m.get(3)).toMatchObject({ x: 6, y: 4 })
    expect(m.get(4)).toMatchObject({ x: 6, y: 8 })
  })
  it('resets sizes from the supplied defaults', () => {
    const m = arrange(items, 'reset', { sizeOf: () => [3, 5] })
    expect([...m.values()].every((p) => p.w === 3 && p.h === 5)).toBe(true)
  })
  it('rejects unknown arrangements', () => {
    expect(() => arrange(items, 'nope')).toThrow()
  })
})

describe('palette', () => {
  it('maps names to colours and ignores unknown ones', () => {
    expect(colorValue('blue')).toBe('#3b82f6')
    expect(colorValue('nope')).toBeNull()
    expect(colorValue(null)).toBeNull()
    expect(new Set(PALETTE.map((c) => c.id)).size).toBe(PALETTE.length)
  })
})
