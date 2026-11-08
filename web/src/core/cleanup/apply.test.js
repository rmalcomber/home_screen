import { describe, it, expect } from 'vitest'
import { planApply, summarise, applyPlan, undoPlan } from './apply.js'

const tile = (id, type, config, extra = {}) => ({ id, type, title: `T${id}`, config, page_id: 1, parent_id: null, ...extra })
const links = (...u) => u.map((url, i) => ({ title: `L${i}`, url }))

describe('planApply', () => {
  it('removes links by index without disturbing the others, even several in one tile', () => {
    const t = tile(1, 'bookmarks', { links: links('https://a.com', 'https://b.com', 'https://c.com', 'https://d.com') })
    const plan = planApply([t], [
      { type: 'remove', tileId: 1, ref: { kind: 'link', index: 0 } },
      { type: 'remove', tileId: 1, ref: { kind: 'link', index: 2 } },
    ])
    expect(plan.patches).toHaveLength(1)
    expect(plan.patches[0].config.links.map((l) => l.url)).toEqual(['https://b.com', 'https://d.com'])
    expect(t.config.links).toHaveLength(4) // the original is untouched
  })
  it('changes addresses and titles before removing, so indexes stay right', () => {
    const t = tile(1, 'bookmarks', { links: links('https://a.com', 'https://b.com', 'https://c.com') })
    const plan = planApply([t], [
      { type: 'remove', tileId: 1, ref: { kind: 'link', index: 0 } },
      { type: 'url', tileId: 1, ref: { kind: 'link', index: 2 }, url: 'https://new.com' },
      { type: 'title', tileId: 1, ref: { kind: 'link', index: 1 }, title: 'Bee' },
    ])
    expect(plan.patches[0].config.links).toEqual([{ title: 'Bee', url: 'https://b.com' }, { title: 'L2', url: 'https://new.com' }])
  })
  it('edits developer and GitHub tile addresses, and migrates the old developer shape', () => {
    const dev = tile(1, 'dev', { services: [{ name: 'a', dev: 'http://x', prod: 'https://old.com' }] })
    const old = tile(2, 'dev', { name: 'b', prod: 'https://old2.com' })
    const gh = tile(3, 'github', { owner: 'me', repos: [{ url: 'https://github.com/me/a' }, { url: 'me/b' }] })
    const plan = planApply([dev, old, gh], [
      { type: 'url', tileId: 1, ref: { kind: 'dev', index: 0, env: 'prod' }, url: 'https://new.com' },
      { type: 'url', tileId: 2, ref: { kind: 'dev', index: 0, env: 'prod' }, url: 'https://new2.com' },
      { type: 'url', tileId: 3, ref: { kind: 'github', index: 1 }, url: 'https://github.com/me/c' },
    ])
    const by = (id) => plan.patches.find((p) => p.tile.id === id).config
    expect(by(1).services[0].prod).toBe('https://new.com')
    expect(by(2).services[0]).toMatchObject({ name: 'b', prod: 'https://new2.com' })
    expect(by(3).repos[1].url).toBe('https://github.com/me/c')
  })
  it('removing a GitHub repo drops it, removing a developer address blanks it', () => {
    const dev = tile(1, 'dev', { services: [{ name: 'a', dev: 'http://x', prod: 'https://p.com' }] })
    const gh = tile(2, 'github', { owner: 'me', repos: [{ url: 'a' }, { url: 'b' }] })
    const plan = planApply([dev, gh], [
      { type: 'remove', tileId: 1, ref: { kind: 'dev', index: 0, env: 'prod' } },
      { type: 'remove', tileId: 2, ref: { kind: 'github', index: 0 } },
    ])
    expect(plan.patches.find((p) => p.tile.id === 1).config.services[0]).toMatchObject({ dev: 'http://x', prod: '' })
    expect(plan.patches.find((p) => p.tile.id === 2).config.repos).toEqual([{ url: 'b' }])
  })
  it('deletes tiles, and skips edits to a tile that is being deleted', () => {
    const a = tile(1, 'bookmarks', { links: [] })
    const b = tile(2, 'bookmarks', { links: links('https://a.com') })
    const plan = planApply([a, b], [
      { type: 'delete-tile', tileId: 1 },
      { type: 'remove', tileId: 1, ref: { kind: 'link', index: 0 } },
      { type: 'delete-tile', tileId: 99 },
    ])
    expect(plan.deletes.map((t) => t.id)).toEqual([1])
    expect(plan.patches).toEqual([])
  })
  it('moves links into a new tile next to the first source tile', () => {
    const a = tile(1, 'bookmarks', { links: links('https://g.com/1', 'https://x.com') }, { page_id: 2, parent_id: 7 })
    const b = tile(2, 'bookmarks', { links: links('https://g.com/2') })
    const plan = planApply([a, b], [{ type: 'move', name: 'g.com', refs: [{ tileId: 1, ref: { kind: 'link', index: 0 } }, { tileId: 2, ref: { kind: 'link', index: 0 } }], links: [{ title: 'one', url: 'https://g.com/1' }, { title: 'two', url: 'https://g.com/2' }] }])
    expect(plan.creates).toHaveLength(1)
    expect(plan.creates[0]).toMatchObject({ name: 'g.com', sourceTile: { id: 1 } })
    expect(plan.patches.find((p) => p.tile.id === 1).config.links.map((l) => l.url)).toEqual(['https://x.com'])
    expect(plan.patches.find((p) => p.tile.id === 2).config.links).toEqual([])
  })
  it('does not report tiles whose config did not change', () => {
    const t = tile(1, 'bookmarks', { links: links('https://a.com') })
    expect(planApply([t], [{ type: 'url', tileId: 1, ref: { kind: 'link', index: 0 }, url: 'https://a.com' }]).patches).toEqual([])
    expect(summarise(planApply([t], []))).toBe('nothing to change')
  })
  it('ignores actions for tiles that no longer exist', () => {
    expect(planApply([], [{ type: 'remove', tileId: 5, ref: { kind: 'link', index: 0 } }, { type: 'url', tileId: 5, ref: { kind: 'link', index: 0 }, url: 'x' }]).patches).toEqual([])
  })
  it('summarises a plan', () => {
    const a = tile(1, 'bookmarks', { links: links('https://a.com') })
    const b = tile(2, 'bookmarks', { links: [] })
    const plan = planApply([a, b], [{ type: 'remove', tileId: 1, ref: { kind: 'link', index: 0 } }, { type: 'delete-tile', tileId: 2 }])
    expect(summarise(plan)).toBe('change 1 tile, delete 1 tile')
  })
})

describe('applyPlan and undoPlan', () => {
  const makeIo = () => {
    const log = []
    return {
      log,
      patchConfig: async (t, c) => log.push(['patch', t.id, c]),
      deleteTile: async (id) => log.push(['delete', id]),
      saveTile: async (t) => { log.push(['save', t.title]); return { id: 100 + log.length } },
      restoreTile: async (t) => log.push(['restore', t.id]),
    }
  }
  it('writes edits, then new tiles, then deletions, and can undo them all', async () => {
    const a = tile(1, 'bookmarks', { links: links('https://a.com', 'https://b.com') })
    const empty = tile(2, 'bookmarks', { links: [] })
    const plan = planApply([a, empty], [
      { type: 'remove', tileId: 1, ref: { kind: 'link', index: 0 } },
      { type: 'delete-tile', tileId: 2 },
      { type: 'move', name: 'new', refs: [{ tileId: 1, ref: { kind: 'link', index: 1 } }], links: [{ title: 'B', url: 'https://b.com' }] },
    ])
    const io = makeIo()
    const undo = await applyPlan(plan, io)
    expect(io.log.map((l) => l[0])).toEqual(['patch', 'save', 'delete'])
    expect(undo.created).toHaveLength(1)
    const io2 = makeIo()
    await undoPlan(undo, io2)
    expect(io2.log.map((l) => l[0])).toEqual(['restore', 'delete', 'patch'])
    // the edited tile gets its original links back
    expect(io2.log.find((l) => l[0] === 'patch')[2].links).toHaveLength(2)
    expect(io2.log.find((l) => l[0] === 'restore')[1]).toBe(2)
  })
})
