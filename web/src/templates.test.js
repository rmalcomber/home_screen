import { describe, it, expect } from 'vitest'
import { TEMPLATES, countTiles, countGroups } from './templates.js'
import { WIDGETS } from './tiles/widgets.jsx'
import { PALETTE } from './colors.js'
import { layoutAll } from './layout.js'

const kids = (tpl) => tpl.tiles.flatMap((t) => t.children || [])

describe('starter templates', () => {
  it('have unique ids and names', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length)
    expect(new Set(TEMPLATES.map((t) => t.name)).size).toBe(TEMPLATES.length)
  })
  it('only use widgets, colours and tile types that exist', () => {
    const types = ['bookmarks', 'dev', 'github', 'widget', 'group']
    for (const tpl of TEMPLATES) {
      for (const t of [...tpl.tiles, ...kids(tpl)]) {
        expect(types, `${tpl.id}: ${t.title}`).toContain(t.type)
        if (t.type === 'widget') expect(WIDGETS[t.config.kind], `${tpl.id}: ${t.config.kind}`).toBeTruthy()
        if (t.color) expect(PALETTE.map((c) => c.id)).toContain(t.color)
        expect(t.title, tpl.id).toBeTruthy()
      }
    }
  })
  it('nest at most one level deep and only inside groups', () => {
    for (const tpl of TEMPLATES) {
      for (const t of tpl.tiles) if (t.children) expect(t.type).toBe('group')
      for (const k of kids(tpl)) expect(k.children).toBeUndefined()
    }
  })
  it('lay out without overlapping once created', () => {
    for (const tpl of TEMPLATES) {
      const items = []
      let id = 1
      for (const spec of tpl.tiles) {
        const g = { id: id++, parent_id: null, x: spec.x || 0, y: 0, w: spec.w || 4, h: spec.type === 'group' ? 4 : 8, collapsed: false, type: spec.type }
        items.push(g)
        for (const k of spec.children || []) items.push({ id: id++, parent_id: g.id, x: k.x || 0, y: 0, w: 4, h: 8, collapsed: false, type: k.type })
      }
      const m = layoutAll(items, { mode: tpl.mode || 'free', cols: tpl.cols })
      const top = items.filter((t) => t.parent_id == null)
      for (const a of top) for (const b of top) {
        if (a.id >= b.id) continue
        const p = m.get(a.id), q = m.get(b.id)
        const overlap = p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h
        expect(overlap, `${tpl.id}: tiles ${a.id} and ${b.id}`).toBe(false)
      }
    }
  })
  it('report their size', () => {
    expect(countTiles(TEMPLATES.find((t) => t.id === 'toolbox'))).toBe(12)
    expect(countGroups(TEMPLATES.find((t) => t.id === 'toolbox'))).toBe(3)
  })
})

describe('template groups', () => {
  it('place their children side by side without overlapping', () => {
    for (const tpl of TEMPLATES) {
      for (const g of tpl.tiles.filter((t) => t.type === 'group')) {
        const spans = g.children.map((k) => [k.x || 0, (k.x || 0) + (k.w || 4)]).sort((a, b) => a[0] - b[0])
        spans.forEach(([a, b], i) => {
          expect(b, `${tpl.id}/${g.title}`).toBeLessThanOrEqual(g.w)
          if (i) expect(a, `${tpl.id}/${g.title}`).toBeGreaterThanOrEqual(spans[i - 1][1])
        })
      }
    }
  })
})
