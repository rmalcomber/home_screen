// Core launcher providers: your tiles and links, and the ">" commands. Tools (calculator, cron, hash...) are extensions.
// They register themselves from their manifest, see core/extensions/launcher.js.
import { registerProvider } from './registry.js'
import { registerExtensionTools } from '../extensions/launcher.js'
import { tiles, pages, editing, importing, cleaning, settingsOpen, settings, saveSettings, focusTile, setAllCollapsed, setPage, arrangePage, setPageMode, templatesOpen } from '../store.js'
import { ARRANGE, COLUMN_CHOICES } from '../layout.js'
import { defaultSize } from '../tiles/sizes.js'
import { devServices, ENVS, faviconUrl, parseGithub, githubLinks } from '../util.js'

const open = (url, newTab) => (newTab ? window.open(url, '_blank', 'noopener') : (window.location.href = url))


// Default provider: tiles, bookmarks, dev environments and GitHub repos (+ their quick links).
registerProvider({
  id: 'links',
  order: 100,
  name: 'Links & tiles',
  items() {
    const out = []
    for (const t of tiles.value) {
      const c = t.config || {}
      out.push({ key: `tile:${t.id}`, title: t.title, subtitle: tileLabel(t), kind: 'Tile', icon: t.icon, run: () => focusTile(t.id) })

      if (t.type === 'bookmarks') {
        for (const l of c.links || []) {
          if (!l.url) continue
          out.push({ key: `link:${t.id}:${l.url}`, title: l.title || l.url, subtitle: l.url, group: t.title, kind: 'Link', iconSrc: faviconUrl(l.url), run: ({ newTab }) => open(l.url, newTab) })
        }
      } else if (t.type === 'dev') {
        for (const v of devServices(c)) {
          for (const [k, label] of ENVS) {
            if (!v[k]) continue
            const name = v.name || t.title
            out.push({ key: `dev:${t.id}:${name}:${k}`, title: `${name} ${label}`, subtitle: v[k], group: t.title, kind: label, kindClass: k === 'prod' ? 'badge-error' : k === 'stage' ? 'badge-warning' : 'badge-info', iconSrc: faviconUrl(v[k]), run: ({ newTab }) => open(v[k], newTab) })
          }
        }
      } else if (t.type === 'github') {
        for (const r of c.repos || []) {
          const gh = parseGithub(r.url, c.owner)
          if (!gh) continue
          const name = `${gh.owner}/${gh.repo}`
          for (const [label, href] of githubLinks(gh.base)) {
            out.push({ key: `gh:${href}`, title: label === 'Code' ? name : `${name} · ${label}`, subtitle: href, group: t.title, kind: label === 'Code' ? 'Repo' : 'Repo link', iconSrc: faviconUrl('https://github.com'), run: ({ newTab }) => open(href, newTab) })
          }
        }
      }
    }
    return out
  },
})

const tileLabel = (t) => {
  const where = pages.value.length > 1 ? ` · ${pages.value.find((p) => p.id === t.page_id)?.name || ''}` : ''
  const parent = t.parent_id != null ? tiles.value.find((x) => x.id === t.parent_id) : null
  const base = { bookmarks: 'Bookmarks tile', dev: 'Developer tile', github: 'GitHub tile', group: 'Group', widget: `${t.config?.kind || 'Widget'} widget` }[t.type] || t.type
  return `${base}${parent ? ` in ${parent.title}` : ''}${where}`
}

// ">" prefix: commands.
registerProvider({
  id: 'commands',
  order: 110,
  name: 'Commands',
  prefix: '>',
  items() {
    const cmd = (id, title, run, subtitle) => ({ key: `cmd:${id}`, title, subtitle, kind: 'Command', icon: 'iconify:fa6-solid:terminal', run })
    return [
      cmd('add', 'Add tile', () => (editing.value = { id: null })),
      cmd('add-group', 'Add group', () => (editing.value = { id: null, type: 'group' })),
      cmd('templates', 'Starter templates', () => (templatesOpen.value = true)),
      ...ARRANGE.map((a) => cmd(`arrange:${a.id}`, `Arrange: ${a.label}`, () => arrangePage(a.id, defaultSize), a.hint)),
      cmd('mode-free', 'Layout: free grid', () => setPageMode('free')),
      ...COLUMN_CHOICES.map((n) => cmd(`mode-${n}`, `Layout: ${n} columns`, () => setPageMode('columns', n))),
      ...pages.value.map((pg) => cmd(`page:${pg.id}`, `Go to page: ${pg.name}`, () => setPage(pg.id))),
      cmd('import', 'Import Bookmarks', () => (importing.value = true)),
      cmd('cleanup', 'Clean up links: duplicates, dead links, tidy-ups', () => (cleaning.value = true)),
      cmd('settings', 'Open Settings', () => (settingsOpen.value = true)),
      cmd('collapse', 'Collapse all tiles', () => setAllCollapsed(true)),
      cmd('expand', 'Expand all tiles', () => setAllCollapsed(false)),
      cmd('bar', `${settings.value.autoHideBar === false ? 'Enable' : 'Disable'} title bar auto-hide`, () => saveSettings({ autoHideBar: settings.value.autoHideBar === false })),
    ]
  },
})

// Tools from extensions: stand-in providers that load the extension on demand.
registerExtensionTools()
