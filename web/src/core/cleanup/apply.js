// Clean up, step 4: apply ticked findings. `planApply` is pure (it works out the new tile configs), `applyPlan` and `undoPlan` write
// through the store. The plan keeps the original tiles, so the last clean up can be undone.

import { devServices } from '../util.js'

const clone = (x) => JSON.parse(JSON.stringify(x ?? {}))

/**
 * Work out what the actions change. → { patches: [{ tile, config }], deletes: [tile], creates: [{ name, links, sourceTile }] }
 * Edits are applied to copies of the tiles' configs; removals are done last, from the end, so indexes stay valid.
 */
export function planApply(tiles, actions) {
  const byId = new Map(tiles.map((t) => [t.id, t]))
  const configs = new Map() // tileId -> working config
  const cfg = (id) => {
    if (!configs.has(id)) configs.set(id, clone(byId.get(id)?.config))
    return configs.get(id)
  }
  const removals = new Map() // tileId -> [{ kind, index, env? }]
  const deletes = new Set()
  const creates = []

  const want = (a) => byId.has(a.tileId) && !deletes.has(a.tileId)
  for (const a of actions) if (a.type === 'delete-tile' && byId.has(a.tileId)) deletes.add(a.tileId)

  const markRemove = (a) => {
    if (!removals.has(a.tileId)) removals.set(a.tileId, [])
    removals.get(a.tileId).push({ ...a.ref })
  }

  for (const a of actions) {
    if (a.type === 'delete-tile' || !(a.type === 'move' || want(a))) continue
    if (a.type === 'url' || a.type === 'title') {
      const c = cfg(a.tileId)
      const k = a.ref
      if (k.kind === 'link' && c.links?.[k.index]) c.links[k.index][a.type === 'url' ? 'url' : 'title'] = a.type === 'url' ? a.url : a.title
      else if (k.kind === 'dev' && a.type === 'url') {
        const s = Array.isArray(c.services) ? c.services : devServices(c)
        if (!Array.isArray(c.services)) c.services = s // migrate the old single-service shape when it is edited
        if (s[k.index]) s[k.index][k.env] = a.url
      } else if (k.kind === 'github' && a.type === 'url' && c.repos?.[k.index]) c.repos[k.index].url = a.url
    } else if (a.type === 'remove') {
      markRemove(a)
    } else if (a.type === 'move') {
      const live = a.refs.filter((r) => want({ tileId: r.tileId }) && byId.get(r.tileId))
      if (!live.length) continue
      for (const r of live) markRemove({ tileId: r.tileId, ref: r.ref })
      creates.push({ name: a.name, links: a.links, sourceTile: byId.get(live[0].tileId) })
    }
  }

  for (const [id, list] of removals) {
    const c = cfg(id)
    const drop = (arr, key) => {
      const idx = new Set(list.filter((r) => r.kind === key).map((r) => r.index))
      return Array.isArray(arr) ? arr.filter((_, i) => !idx.has(i)) : arr
    }
    if (c.links) c.links = drop(c.links, 'link')
    if (c.repos) c.repos = drop(c.repos, 'github')
    const devs = list.filter((r) => r.kind === 'dev')
    if (devs.length && Array.isArray(c.services)) for (const r of devs) if (c.services[r.index]) c.services[r.index][r.env] = ''
  }

  const patches = [...configs]
    .filter(([id]) => !deletes.has(id))
    .map(([id, config]) => ({ tile: byId.get(id), config }))
    .filter((p) => JSON.stringify(p.config) !== JSON.stringify(p.tile.config || {}))
  return { patches, deletes: [...deletes].map((id) => byId.get(id)), creates }
}

/** A readable one-line summary of a plan. */
export function summarise(plan) {
  const n = plan.patches.length
  const parts = []
  if (n) parts.push(`change ${n} tile${n === 1 ? '' : 's'}`)
  if (plan.deletes.length) parts.push(`delete ${plan.deletes.length} tile${plan.deletes.length === 1 ? '' : 's'}`)
  if (plan.creates.length) parts.push(`create ${plan.creates.length} tile${plan.creates.length === 1 ? '' : 's'}`)
  return parts.length ? parts.join(', ') : 'nothing to change'
}

/**
 * Write a plan through the store functions in `io` ({ patchConfig, deleteTile, saveTile }) and return what is needed to undo it.
 * Order: edits, new tiles, deletions last.
 */
export async function applyPlan(plan, io) {
  const undo = { patched: [], created: [], deleted: [] }
  for (const p of plan.patches) {
    await io.patchConfig(p.tile, p.config)
    undo.patched.push({ tile: p.tile, config: clone(p.tile.config) })
  }
  for (const c of plan.creates) {
    const src = c.sourceTile || null
    const made = await io.saveTile({ type: 'bookmarks', title: c.name, icon: null, x: 0, y: 0, w: 4, h: Math.min(16, Math.max(6, c.links.length + 4)), collapsed: false, config: { links: c.links }, ...(src ? { page_id: src.page_id, parent_id: src.parent_id ?? null } : {}) })
    undo.created.push(made.id)
  }
  for (const t of plan.deletes) {
    await io.deleteTile(t.id)
    undo.deleted.push(t)
  }
  return undo
}

/** Reverse `applyPlan`: put edited configs back, remove created tiles, recreate deleted ones (`io.restoreTile(tile)`). */
export async function undoPlan(undo, io) {
  for (const t of undo.deleted) await io.restoreTile(t)
  for (const id of undo.created) await io.deleteTile(id)
  for (const p of undo.patched) await io.patchConfig(p.tile, p.config)
}
