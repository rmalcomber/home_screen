// Launcher core: a registry of providers plus ranking. Pure (no UI), so it is unit tested.
//
// To add functionality to the launcher, register a provider:
//
//   registerProvider({
//     id: 'calc',
//     name: 'Calculator',
//     prefix: '=',                 // optional: typing this first char scopes the launcher to this provider
//     filter: true,                // default true: results are fuzzy-filtered/ranked by the launcher.
//                                  // Set false if the provider ranks/filters itself (e.g. computes an answer).
//     items(query, ctx) { return [item] | Promise<[item]> },
//   })
//
// Item: { key, title, subtitle?, group?, kind?, iconSrc?, icon?, run({ newTab }) }
//   key      stable unique id (also used to remember "recent" items)
//   kind     small badge on the right, e.g. 'Link', 'Tile', 'Command'
//   iconSrc  image URL, or icon  'iconify:prefix:name' / 'upload:id'
//   run      what happens on Enter (newTab = Enter, false = Shift+Enter)

const providers = new Map()

export function registerProvider(p) {
  providers.set(p.id, p)
}
export const getProviders = () => [...providers.values()]

/** Score an item for a query; <= 0 means no match. */
export function score(item, query) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return 1
  const title = (item.title || '').toLowerCase()
  const rest = `${item.subtitle || ''} ${item.group || ''}`.toLowerCase()
  let total = 0
  for (const t of tokens) {
    let s = 0
    const ti = title.indexOf(t)
    if (ti === 0) s = 100
    else if (ti > 0) s = /[\s/._-]/.test(title[ti - 1]) ? 80 : 60
    else if (rest.includes(t)) s = 30
    else if (isSubsequence(t, title)) s = 15
    else return 0
    total += s
  }
  return total - Math.min(title.length, 60) * 0.1
}

function isSubsequence(needle, hay) {
  if (needle.length < 3) return false
  let i = 0
  for (const ch of hay) if (ch === needle[i] && ++i === needle.length) return true
  return false
}

export function rank(items, query, limit = 60) {
  return items
    .map((it) => [it, score(it, query)])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([it]) => it)
}

/** Split "> foo" into the matching prefixed provider and the remaining query. */
export function route(input) {
  const first = input.charAt(0)
  const p = first && getProviders().find((x) => x.prefix === first)
  return p ? { scoped: p, query: input.slice(1).trimStart() } : { scoped: null, query: input }
}

/** Run the launcher search. Resolves to [{provider, items}] sections in provider order. */
export async function search(input, ctx = {}) {
  const { scoped, query } = route(input)
  const list = scoped ? [scoped] : getProviders().filter((p) => !p.prefix || p.includeInDefault)
  const sections = await Promise.all(
    list.map(async (p) => {
      let items = []
      try {
        items = (await p.items(query, ctx)) || []
      } catch (e) {
        console.warn('launcher provider failed', p.id, e)
      }
      if (p.filter !== false) items = rank(items, query)
      return { provider: p, items }
    }),
  )
  // When searching across providers keep one flat best-first list per provider, but drop empties.
  return sections.filter((s) => s.items.length)
}

// ---- recents (localStorage; purely a convenience) ----
const RK = 'launcher.recent'
export function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(RK) || '[]')
  } catch {
    return []
  }
}
export function pushRecent(key) {
  try {
    localStorage.setItem(RK, JSON.stringify([key, ...getRecent().filter((k) => k !== key)].slice(0, 12)))
  } catch {}
}
