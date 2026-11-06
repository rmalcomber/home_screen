import { describe, it, expect, beforeEach, vi } from 'vitest'

// A tiny in-memory stand-in for the server's tile/page/layout API.
function fakeServer() {
  const db = { tiles: [], pages: [{ id: 1, name: 'Home', mode: 'free', cols: 3, position: 0 }], nextTile: 1, nextPage: 2, layoutPuts: 0 }
  const json = (v, status = 200) => ({ ok: status < 400, status, json: async () => v })
  const body = (init) => (init?.body ? JSON.parse(init.body) : undefined)
  const handler = async (url, init = {}) => {
    const method = init.method || 'GET'
    const b = body(init)
    let m
    if (url === '/api/settings') return json({})
    if (url === '/api/pages' && method === 'GET') return json(db.pages)
    if (url === '/api/pages' && method === 'POST') { const p = { position: db.pages.length, ...b, id: db.nextPage++ }; db.pages.push(p); return json(p) }
    if ((m = url.match(/^\/api\/pages\/(\d+)$/))) {
      const id = Number(m[1])
      if (method === 'PUT') { db.pages = db.pages.map((p) => (p.id === id ? { ...p, ...b } : p)); return json(db.pages.find((p) => p.id === id)) }
      if (method === 'DELETE') { if (db.pages.length < 2) return json(null, 409); db.pages = db.pages.filter((p) => p.id !== id); db.tiles = db.tiles.filter((t) => t.page_id !== id); return json(null, 204) }
    }
    if (url === '/api/tiles' && method === 'GET') return json(db.tiles)
    if (url === '/api/tiles' && method === 'POST') {
      const t = { color: null, parent_id: null, page_id: 1, ...b, id: db.nextTile++ }
      db.tiles.push(t)
      return json(t)
    }
    if ((m = url.match(/^\/api\/tiles\/(\d+)$/))) {
      const id = Number(m[1])
      if (method === 'PUT') { db.tiles = db.tiles.map((t) => (t.id === id ? { ...t, ...b, id } : t)); return json(db.tiles.find((t) => t.id === id)) }
      if (method === 'DELETE') { db.tiles = db.tiles.filter((t) => t.id !== id && t.parent_id !== id); return json(null, 204) }
    }
    if (url === '/api/layout' && method === 'PUT') {
      db.layoutPuts++
      for (const i of b) db.tiles = db.tiles.map((t) => (t.id === i.id ? { ...t, ...i } : t))
      return json(null, 204)
    }
    throw new Error(`unhandled ${method} ${url}`)
  }
  return { db, handler }
}

let S, srv

beforeEach(async () => {
  vi.resetModules()
  srv = fakeServer()
  vi.stubGlobal('fetch', vi.fn(srv.handler))
  S = await import('./store.js')
  await S.load()
})

const tile = (o) => ({ type: 'bookmarks', title: 'T', icon: null, x: 0, y: 0, w: 4, h: 6, collapsed: false, config: { links: [] }, ...o })

describe('store: tiles, groups and pages', () => {
  it('starts on the first page', () => {
    expect(S.currentPage.value.name).toBe('Home')
    expect(S.pageTiles.value).toEqual([])
  })

  it('adds tiles to the current page, stacking them', async () => {
    await S.saveTile(tile({ title: 'A' }))
    await S.saveTile(tile({ title: 'B' }))
    const [a, b] = S.pageTiles.value
    expect(a.page_id).toBe(1)
    expect(a.y).toBe(0)
    expect(b.y).toBe(6)
  })

  it('puts a new tile inside a group, and deleting the group takes it along', async () => {
    const g = await S.saveTile(tile({ type: 'group', title: 'G', config: {}, w: 6, h: 6 }))
    const c = await S.saveTile(tile({ title: 'Kid', parent_id: g.id }))
    expect(S.tiles.value.find((t) => t.id === c.id).parent_id).toBe(g.id)
    // the group grew to hold its child
    expect(S.tiles.value.find((t) => t.id === g.id).h).toBeGreaterThanOrEqual(6)
    await S.deleteTile(g.id)
    expect(S.tiles.value).toEqual([])
    expect(srv.db.tiles).toEqual([])
  })

  it('moves a tile into and out of a group when the layout is applied', async () => {
    const g = await S.saveTile(tile({ type: 'group', title: 'G', config: {}, w: 6, h: 12 }))
    const t = await S.saveTile(tile({ title: 'Mover', x: 8 }))
    await S.applyLayout({ [t.id]: { parent_id: g.id, x: 1, y: 1 } }, t.id)
    expect(srv.db.tiles.find((x) => x.id === t.id)).toMatchObject({ parent_id: g.id, x: 1, y: 1 })
    await S.applyLayout({ [t.id]: { parent_id: null, x: 8, y: 0 } }, t.id)
    expect(srv.db.tiles.find((x) => x.id === t.id).parent_id).toBeNull()
  })

  it('keeps tiles on their own page', async () => {
    await S.saveTile(tile({ title: 'Home tile' }))
    const p = await S.addPage('Work')
    expect(S.currentPage.value.id).toBe(p.id)
    expect(S.pageTiles.value).toEqual([])
    await S.saveTile(tile({ title: 'Work tile' }))
    expect(S.pageTiles.value.map((t) => t.title)).toEqual(['Work tile'])
    S.setPage(1)
    expect(S.pageTiles.value.map((t) => t.title)).toEqual(['Home tile'])
  })

  it('deleting a page removes its tiles and falls back to another page', async () => {
    const p = await S.addPage('Temp')
    await S.saveTile(tile({ title: 'Gone' }))
    await S.removePage(p.id)
    expect(S.currentPage.value.id).toBe(1)
    expect(S.tiles.value.find((t) => t.title === 'Gone')).toBeUndefined()
  })

  it('moves a tile to another page through the editor path', async () => {
    const t = await S.saveTile(tile({ title: 'Traveller' }))
    const p = await S.addPage('Other')
    S.setPage(1)
    await S.saveTile({ ...S.tiles.value.find((x) => x.id === t.id), page_id: p.id })
    expect(srv.db.tiles.find((x) => x.id === t.id).page_id).toBe(p.id)
    expect(S.pageTiles.value).toEqual([])
  })

  it('columns mode spreads tiles over equal columns', async () => {
    for (const n of ['A', 'B', 'C']) await S.saveTile(tile({ title: n }))
    await S.setPageMode('columns', 3)
    const xs = S.pageTiles.value.map((t) => t.x).sort((a, b) => a - b)
    expect(xs).toEqual([0, 4, 8])
    expect(S.pageTiles.value.every((t) => t.w === 4)).toBe(true)
    expect(srv.db.pages[0]).toMatchObject({ mode: 'columns', cols: 3 })
  })

  it('arranges A–Z', async () => {
    for (const n of ['pear', 'apple', 'mango']) await S.saveTile(tile({ title: n, w: 3 }))
    await S.arrangePage('alpha')
    const order = [...S.pageTiles.value].sort((a, b) => a.y - b.y || a.x - b.x).map((t) => t.title)
    expect(order).toEqual(['apple', 'mango', 'pear'])
  })

  it('focusing a tile on another page switches to it and opens its group', async () => {
    const g = await S.saveTile(tile({ type: 'group', title: 'G', config: {}, w: 6, h: 10, collapsed: true }))
    const kid = await S.saveTile(tile({ title: 'Deep', parent_id: g.id }))
    await S.addPage('Elsewhere')
    expect(S.currentPage.value.id).not.toBe(1)
    S.focusTile(kid.id)
    expect(S.currentPage.value.id).toBe(1)
    expect(S.tiles.value.find((t) => t.id === g.id).collapsed).toBe(false)
  })
})
