// Clean up, step 2: turn links (and, later, link-check results) into findings the person can tick and apply. Pure; unit tested.
//
// A finding is { id, tab, kind, title, detail, where, actions: [Action], on }:
//   tab      'dup' | 'dead' | 'org'
//   on       whether it is ticked when it first appears (safe, reversible tidy-ups only)
//   actions  what happens if it is applied:
//     { type: 'remove', ref, tileId }            delete one link
//     { type: 'url', ref, tileId, url }          change a link's address
//     { type: 'title', ref, tileId, title }      change a link's title
//     { type: 'delete-tile', tileId }            delete a whole tile
//     { type: 'move', refs: [{ref, tileId}], name, links: [{title,url}] }   move links into a new bookmarks tile

import { hostOf, rootDomain, collectLinks, urlKey, cleanUrl, parseWeb, isLocalHost, whereText } from './links.js'

const refKey = (l) => `${l.tileId}:${l.ref.kind}:${l.ref.index}:${l.ref.env || ''}`

/**
 * Links that go to the same place. Within a group the first link (in dashboard order, https preferred) is kept and the others are
 * offered for removal. Only bookmark links are compared: the same address in two environments of a developer tile is normal.
 */
export function findDuplicates(links) {
  const groups = new Map()
  for (const l of links) {
    if (l.ref.kind !== 'link') continue
    const k = urlKey(l.url)
    if (!k) continue
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(l)
  }
  const out = []
  for (const [key, list] of groups) {
    if (list.length < 2) continue
    const keep = list.find((l) => /^https:/i.test(l.url.trim())) || list[0]
    for (const l of list) {
      if (l === keep) continue
      const same = l.tileId === keep.tileId
      out.push({
        id: `dup:${refKey(l)}`,
        tab: 'dup',
        kind: same ? 'duplicate in tile' : 'duplicate',
        title: l.title || l.url,
        detail: `${l.url}`,
        where: whereText(l),
        note: `Same as "${keep.title || keep.url}" in ${whereText(keep)}`,
        key,
        actions: [{ type: 'remove', ref: l.ref, tileId: l.tileId }],
        on: true,
      })
    }
  }
  return out
}

/** Tidy-ups that need no network: tracking parameters, blank titles, bad addresses, empty tiles, and many links from one site. */
export function findOrganise(tiles, links) {
  const out = []
  const linkTiles = tiles.filter((t) => t.type === 'bookmarks')

  for (const l of links) {
    if (l.ref.kind !== 'link') continue
    const u = parseWeb(l.url)
    if (!u) {
      out.push({ id: `bad:${refKey(l)}`, tab: 'org', kind: 'not a web address', title: l.title || l.url, detail: l.url, where: whereText(l), actions: [{ type: 'remove', ref: l.ref, tileId: l.tileId }], on: false })
      continue
    }
    const cleaned = cleanUrl(l.url)
    if (cleaned !== l.url.trim()) {
      out.push({ id: `track:${refKey(l)}`, tab: 'org', kind: 'tracking parameters', title: l.title || l.url, detail: `${l.url}  →  ${cleaned}`, where: whereText(l), actions: [{ type: 'url', ref: l.ref, tileId: l.tileId, url: cleaned }], on: true })
    }
    if (!l.title.trim() || l.title.trim() === l.url.trim()) {
      const name = u.hostname.replace(/^www\./, '')
      out.push({ id: `title:${refKey(l)}`, tab: 'org', kind: 'no title', title: l.url, detail: `Use "${name}" as the title`, where: whereText(l), actions: [{ type: 'title', ref: l.ref, tileId: l.tileId, title: name }], on: true })
    }
  }

  for (const t of linkTiles) {
    if (!(t.config?.links || []).some((l) => l && l.url)) {
      out.push({ id: `empty:${t.id}`, tab: 'org', kind: 'empty tile', title: t.title || 'Bookmarks', detail: 'This bookmarks tile has no links', where: t.title || '', actions: [{ type: 'delete-tile', tileId: t.id }], on: false })
    }
  }

  // Many links to one site that are spread over tiles: offer one tile for the site.
  const bySite = new Map()
  for (const l of links) {
    if (l.ref.kind !== 'link' || !parseWeb(l.url)) continue
    const d = rootDomain(hostOf(l.url))
    if (!d || isLocalHost(hostOf(l.url))) continue
    if (!bySite.has(d)) bySite.set(d, [])
    bySite.get(d).push(l)
  }
  for (const [domain, list] of bySite) {
    const tilesUsed = new Set(list.map((l) => l.tileId))
    if (list.length < 4) continue
    // Already together: every one of these links is in one tile that is mostly this site.
    if (tilesUsed.size === 1) {
      const t = tiles.find((x) => x.id === list[0].tileId)
      const total = (t?.config?.links || []).length
      if (total && list.length / total >= 0.6) continue
    }
    out.push({
      id: `site:${domain}`,
      tab: 'org',
      kind: 'group by site',
      title: `${list.length} links to ${domain}`,
      detail: `Move them into a new tile called "${domain}"`,
      where: [...tilesUsed].map((id) => tiles.find((x) => x.id === id)?.title || 'tile').join(', '),
      actions: [{ type: 'move', refs: list.map((l) => ({ ref: l.ref, tileId: l.tileId })), name: domain, links: list.map((l) => ({ title: l.title || l.url, url: l.url })) }],
      on: false,
    })
  }
  return out
}

/** The word for a link-check result that the person sees. */
export const STATUS_TEXT = {
  ok: 'Working',
  moved: 'Moved',
  temp: 'Redirects',
  dead: 'Not working',
  blocked: 'Blocked or needs sign-in',
  timeout: 'Too slow',
  error: 'Server error',
  local: 'Local address (not checked)',
}

/**
 * Findings from link-check results (`results`: Map of url → { status, code, to, note, warn }). Dead links are offered for removal
 * (never ticked: a site can be down for an hour), permanent moves for updating (ticked unless the target looks like a sign-in page
 * or the home page), the rest are shown so they can be looked at.
 */
export function findFromChecks(links, results, ignored = new Set()) {
  const out = []
  for (const l of links) {
    const r = results.get(l.url)
    if (!r || r.status === 'ok' || r.status === 'local') continue
    if (ignored.has(urlKey(l.url))) continue
    const base = { title: l.title || l.url, where: whereText(l), url: l.url, status: r.status, code: r.code, to: r.to, key: urlKey(l.url) }
    const remove = l.ref.kind === 'link' ? [{ type: 'remove', ref: l.ref, tileId: l.tileId }] : []
    const setUrl = (to) => [{ type: 'url', ref: l.ref, tileId: l.tileId, url: to }]
    if (r.status === 'moved' && r.to) {
      out.push({ ...base, id: `chk:${refKey(l)}`, tab: 'dead', kind: STATUS_TEXT.moved, detail: `${l.url}  →  ${r.to}`, note: r.note || '', actions: setUrl(r.to), on: !r.warn })
    } else if (r.status === 'temp' && r.to) {
      out.push({ ...base, id: `chk:${refKey(l)}`, tab: 'dead', kind: STATUS_TEXT.temp, detail: `${l.url}  →  ${r.to}`, note: r.note || 'A temporary redirect: usually fine to leave', actions: setUrl(r.to), on: false })
    } else if (r.status === 'dead') {
      out.push({ ...base, id: `chk:${refKey(l)}`, tab: 'dead', kind: STATUS_TEXT.dead, detail: l.url, note: r.note || '', actions: remove, on: false })
    } else {
      out.push({ ...base, id: `chk:${refKey(l)}`, tab: 'dead', kind: STATUS_TEXT[r.status] || 'Unknown', detail: l.url, note: r.note || '', actions: remove, on: false, unsure: true })
    }
  }
  return out
}

/** One call for everything that needs no network. */
export function scan(tiles, pages) {
  const links = collectLinks(tiles, pages)
  return { links, dups: findDuplicates(links), organise: findOrganise(tiles, links) }
}
