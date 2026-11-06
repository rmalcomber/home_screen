import { Menu } from '../components/Menu.jsx'
import { WIDGETS } from './widgets.jsx'
import { faviconUrl, parseGithub, devServices, githubLinks, ENVS, matches } from '../util.js'

export function BookmarksBody({ tile, q }) {
  const links = tile.config?.links || []
  if (!links.length) return <Empty text="No bookmarks yet — edit this tile to add some." />
  return (
    <ul class="flex flex-col">
      {links.map((l, i) => {
        const hit = q && (matches(l.title, q) || matches(l.url, q))
        return (
          <li key={i}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              title={l.url}
              class={`flex items-center gap-2 px-2 py-1 rounded hover:bg-base-300 ${hit ? 'bg-warning/20' : ''}`}
            >
              <img src={faviconUrl(l.url)} width="16" height="16" class="shrink-0" alt="" loading="lazy" />
              <span class="truncate text-sm">{l.title || l.url}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

export function DevBody({ tile, q }) {
  const services = devServices(tile.config).filter((v) => ENVS.some(([k]) => v[k]))
  if (!services.length) return <Empty text="No services yet — edit this tile to add some." />
  return (
    <div class="flex flex-col gap-2">
      {services.map((v, i) => {
        const name = v.name || tile.title
        const hit = q && (matches(v.name, q) || ENVS.some(([k]) => matches(v[k], q)))
        return (
          <div key={i} class={`flex flex-wrap gap-2 p-1 rounded ${hit ? 'bg-warning/20' : ''}`}>
            {ENVS.filter(([k]) => v[k]).map(([k, label, cls]) => (
              <a key={k} href={v[k]} target="_blank" rel="noopener noreferrer" title={v[k]} class={`btn btn-sm ${cls}`}>
                {name} <span class="badge badge-sm badge-neutral font-bold">{label}</span>
              </a>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export function GithubBody({ tile, q }) {
  const repos = (tile.config?.repos || []).map((r) => ({ ...r, gh: parseGithub(r.url, tile.config?.owner) }))
  if (!repos.length) return <Empty text="No repos yet — edit this tile and add repo names or GitHub URLs." />
  return (
    <ul class="flex flex-col">
      {repos.map((r, i) => (
        <li key={i} class={`flex items-center justify-between gap-1 px-2 py-0.5 rounded hover:bg-base-300 ${q && (matches(r.url, q) || matches(r.gh?.base, q)) ? 'bg-warning/20' : ''}`}>
          {r.gh ? (
            <>
              <a href={r.gh.base} target="_blank" rel="noopener noreferrer" class="truncate text-sm" title={r.gh.base}>
                <span class="opacity-60">{r.gh.owner}/</span>
                <span class="font-semibold">{r.gh.repo}</span>
              </a>
              <Menu label="▾" items={githubLinks(r.gh.base)} />
            </>
          ) : (
            <span class="text-sm text-error truncate" title={r.url}>Can’t read repo: {r.url} (set an owner or use owner/repo)</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function WidgetBody({ tile }) {
  const w = WIDGETS[tile.config?.kind]
  if (!w) return <Empty text="Unknown widget." />
  return <w.Body tile={tile} />
}

export const BODIES = { bookmarks: BookmarksBody, dev: DevBody, github: GithubBody, widget: WidgetBody }

function Empty({ text }) {
  return <p class="text-sm opacity-60 p-2">{text}</p>
}
