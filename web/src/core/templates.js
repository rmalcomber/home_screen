// Starter templates: ready-made arrangements of tiles, groups and widgets.
// A template is data. `children` puts tiles inside a group; sizes default to each tile type's usual size.
import { WIDGETS_META } from './extensions/registry.js'
import { defaultSize } from './tiles/sizes.js'
import { tiles, currentPage, createTileRaw, addPage, applyLayout } from './store.js'
import { effH } from './util.js'

const widget = (kind, title, extra = {}) => ({ type: 'widget', title: title ?? WIDGETS_META[kind].label, icon: WIDGETS_META[kind].icon, config: { ...WIDGETS_META[kind].defaults }, w: 4, ...extra })
const links = (title, list, extra = {}) => ({ type: 'bookmarks', title, config: { links: list.map(([t, url]) => ({ title: t, url })) }, ...extra })
const group = (title, color, children, extra = {}) => ({ type: 'group', title, color, config: {}, children, ...extra })

export const TEMPLATES = [
  {
    id: 'developer',
    name: 'Developer workspace',
    description: 'Environments and dashboards in one group, your repositories beside them, and a toolbox of everyday developer widgets below.',
    tiles: [
      group('Environments', 'blue', [
        { type: 'dev', title: 'My service', h: 9, config: { services: [{ name: 'My service', dev: 'https://dev.example.com', stage: 'https://stage.example.com', prod: 'https://example.com' }] }, x: 0 },
        links('Consoles', [['GitHub status', 'https://www.githubstatus.com'], ['AWS console', 'https://console.aws.amazon.com'], ['Azure portal', 'https://portal.azure.com']], { x: 4 }),
      ], { x: 0, w: 8 }),
      { type: 'github', title: 'Repositories', config: { owner: '', repos: [] }, x: 8, w: 4 },
      group('Toolbox', 'green', [
        widget('tool-json', undefined, { x: 0 }),
        widget('tool-base64', undefined, { x: 4 }),
      ], { x: 0, w: 8 }),
      widget('clock', undefined, { x: 8 }),
    ],
  },
  {
    id: 'links',
    name: 'Link pages',
    description: 'Three plain bookmark tiles to fill with your favourites, work links and reading list. Import your Chrome bookmarks into them.',
    tiles: [
      links('Favourites', [['Hacker News', 'https://news.ycombinator.com'], ['MDN Web Docs', 'https://developer.mozilla.org'], ['Wikipedia', 'https://www.wikipedia.org']], { x: 0, w: 4 }),
      links('Work', [], { x: 4, w: 4 }),
      links('Reading list', [], { x: 8, w: 4 }),
    ],
  },
  {
    id: 'focus',
    name: 'Focus',
    description: 'A calm page for the working day: the time, a todo list, a scratch pad and an interval timer.',
    tiles: [
      widget('clock', undefined, { x: 0 }),
      widget('todo', undefined, { x: 4 }),
      widget('notes', undefined, { x: 8 }),
      widget('tabata', 'Focus timer', { x: 0 }),
      widget('countdown', undefined, { x: 4 }),
    ],
  },
  {
    id: 'glance',
    name: 'At a glance',
    description: 'Time, weather, a countdown and a note together in one coloured group, with links underneath.',
    tiles: [
      group('Today', 'amber', [
        widget('clock', undefined, { x: 0, w: 3 }),
        widget('weather', undefined, { x: 3, w: 3 }),
        widget('countdown', undefined, { x: 6, w: 3 }),
        widget('notes', undefined, { x: 9, w: 3 }),
      ], { x: 0, w: 12 }),
      links('Favourites', [['Hacker News', 'https://news.ycombinator.com'], ['Wikipedia', 'https://www.wikipedia.org']], { x: 0, w: 4 }),
      links('Work', [], { x: 4, w: 4 }),
      links('Reading list', [], { x: 8, w: 4 }),
    ],
  },
  {
    id: 'toolbox',
    name: 'Toolbox',
    description: 'Nine launcher tools as widgets, sorted into three coloured groups: everyday, developer and security.',
    mode: 'columns',
    cols: 3,
    tiles: [
      group('Everyday', 'amber', [widget('tool-calc', undefined, { x: 0 }), widget('tool-units', undefined, { x: 4 }), widget('tool-timestamp', undefined, { x: 8 })], { x: 0, w: 12 }),
      group('Developer', 'blue', [widget('tool-json', undefined, { x: 0 }), widget('tool-regex', undefined, { x: 4 }), widget('tool-diff', undefined, { x: 8 })], { x: 0, w: 12 }),
      group('Security', 'green', [widget('tool-password', undefined, { x: 0 }), widget('tool-hash', undefined, { x: 4 }), widget('tool-jwt', undefined, { x: 8 })], { x: 0, w: 12 }),
    ],
  },
]

const flat = (spec) => [spec, ...(spec.children || [])]
export const countTiles = (tpl) => tpl.tiles.flatMap(flat).length
export const countGroups = (tpl) => tpl.tiles.filter((t) => t.type === 'group').length

function body(spec, extra) {
  const { children: _c, ...rest } = spec
  const probe = { type: spec.type, config: spec.config }
  const [w, h] = defaultSize(probe)
  return { icon: null, color: null, x: 0, y: 0, w, h, collapsed: false, ...rest, ...extra }
}

/**
 * Create a template's tiles, on the current page or (newPage) on a page of its own. Resolves with the page used.
 * Tiles are added below what is already there; the grid then closes any gaps.
 */
export async function applyTemplate(tpl, { newPage = false } = {}) {
  const page = newPage ? await addPage(tpl.name, tpl.mode || 'free', tpl.cols || 3) : currentPage.value
  const below = newPage ? 0 : Math.max(0, ...tiles.value.filter((t) => t.page_id === page.id && t.parent_id == null).map((t) => t.y + effH(t)))
  const made = []
  for (const spec of tpl.tiles) {
    const g = await createTileRaw(body(spec, { page_id: page.id, parent_id: null, y: below + (spec.y || 0) }))
    made.push(g)
    for (const kid of spec.children || []) made.push(await createTileRaw(body(kid, { page_id: page.id, parent_id: g.id })))
  }
  tiles.value = [...tiles.value, ...made]
  await applyLayout({})
  return page
}

