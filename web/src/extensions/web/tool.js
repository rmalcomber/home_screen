import { openItem, preview, historyItems } from '../../core/extensions/host.js'
import { ENGINES, parseWebCommand, searchUrl, webFill } from './engine.js'

const ICON = 'iconify:fa6-solid:magnifying-glass'

// Web search: "google rust lifetimes" opens that search in a new tab. Other words: bing, ddg (duckduckgo), brave, ecosia, startpage,
// yahoo, kagi, images, maps, translate, youtube (yt), wikipedia (wiki), github (gh), stackoverflow (so), mdn, npm, crates, docsrs,
// pypi, reddit, hn, amazon, imdb, wolfram. "search <text>" lists every engine to choose from. Enter opens in a new tab,
// Shift+Enter in this one.
export default {
  items(q) {
    if (!q.trim()) return historyItems('web', 'Search', ICON)
    const cmd = parseWebCommand(q)
    if (!cmd) return []
    const { term } = cmd
    return (cmd.engine ? [cmd.engine] : ENGINES).map((e) => {
      const url = searchUrl(e, term)
      const host = new URL(url).hostname
      return openItem({
        key: `web:${e.id}:${term}`,
        title: `Search ${e.name} for “${preview(term, 60)}”`,
        subtitle: host,
        icon: ICON,
        url,
        history: { kind: 'web', key: `web:${e.id}:${term.slice(0, 200)}`, title: `${e.name}: ${preview(term, 50)}`, subtitle: host, fill: webFill(e, term.slice(0, 300)) },
      })
    })
  },
}
