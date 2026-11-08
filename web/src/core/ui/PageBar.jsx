import { pages, currentPage, setPage, addPage, updatePage, removePage, movePage, arrangePage, setPageMode, setAllCollapsed, editing, templatesOpen, pageTiles } from '../store.js'
import { ARRANGE, COLUMN_CHOICES } from '../layout.js'
import { defaultSize } from '../tiles/sizes.js'

const act = (fn) => () => { document.activeElement?.blur(); fn() }

/** Page tabs plus the Layout menu: mode, auto-arrange, groups, templates and page management. */
export function PageBar() {
  const page = currentPage.value
  if (!page) return null
  const list = pages.value
  const idx = list.findIndex((p) => p.id === page.id)
  const columns = page.mode === 'columns'
  const empty = pageTiles.value.length === 0

  const newPage = async () => {
    const name = prompt('Name for the new page', `Page ${list.length + 1}`)
    if (name && name.trim()) await addPage(name.trim())
  }
  const rename = async () => {
    const name = prompt('Rename page', page.name)
    if (name && name.trim() && name.trim() !== page.name) await updatePage({ ...page, name: name.trim() })
  }
  const remove = async () => {
    const n = pageTiles.value.length
    if (confirm(`Delete page "${page.name}"${n ? ` and its ${n} tile${n === 1 ? '' : 's'}` : ''}?`)) await removePage(page.id)
  }
  const setMode = (mode, cols = page.cols) => setPageMode(mode, cols)

  return (
    <div class="flex items-center gap-2 mb-2 flex-wrap">
      <div role="tablist" aria-label="Pages" class="flex items-center gap-1 flex-wrap">
        {list.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === page.id}
            class={`btn btn-sm ${p.id === page.id ? 'btn-primary' : 'btn-ghost tile-glass'}`}
            onClick={() => setPage(p.id)}
            onDblClick={() => p.id === page.id && rename()}
            title={p.id === page.id ? 'Double-click to rename' : undefined}
          >
            {p.name}
          </button>
        ))}
        <button class="btn btn-sm btn-ghost btn-square tile-glass" title="New page" aria-label="New page" onClick={newPage}>＋</button>
      </div>

      <div class="ml-auto flex items-center gap-1">
        <button class="btn btn-sm btn-primary" title="Add a bookmark, widget, developer or GitHub tile to this page" onClick={() => (editing.value = { id: null, page_id: page.id })}>＋ Add tile</button>
        <button class="btn btn-sm btn-ghost tile-glass" title="Add a coloured group that holds other tiles" onClick={() => (editing.value = { id: null, type: 'group', page_id: page.id })}>＋ Group</button>
        <div class="dropdown dropdown-end">
          <button tabIndex={0} class="btn btn-sm btn-ghost tile-glass" aria-haspopup="menu">Layout ▾</button>
          <ul tabIndex={0} class="menu menu-sm dropdown-content bg-base-100 rounded-box shadow-lg border border-base-300 w-64 mt-1 z-50 max-h-[80vh] overflow-auto flex-nowrap">
            <li class="menu-title">Layout mode</li>
            <li><button class={!columns ? 'menu-active' : ''} onClick={act(() => setMode('free'))}>Free grid <span class="opacity-60 text-xs ml-auto">drag anywhere</span></button></li>
            {COLUMN_CHOICES.map((n) => (
              <li key={n}><button class={columns && page.cols === n ? 'menu-active' : ''} onClick={act(() => setMode('columns', n))}>{n} columns <span class="opacity-60 text-xs ml-auto">equal width</span></button></li>
            ))}
            <li class="menu-title">Arrange now</li>
            {ARRANGE.map((a) => (
              <li key={a.id}><button title={a.hint} disabled={empty} onClick={act(() => arrangePage(a.id, defaultSize))}>{a.label}</button></li>
            ))}
            <li><button disabled={empty} onClick={act(() => setAllCollapsed(true))}>Collapse all tiles</button></li>
            <li><button disabled={empty} onClick={act(() => setAllCollapsed(false))}>Expand all tiles</button></li>
            <li class="menu-title">Start from</li>
            <li><button onClick={act(() => (templatesOpen.value = true))}>Starter templates…</button></li>
            <li class="menu-title">This page</li>
            <li><button onClick={act(rename)}>Rename…</button></li>
            <li><button disabled={idx <= 0} onClick={act(() => movePage(page.id, -1))}>Move left</button></li>
            <li><button disabled={idx >= list.length - 1} onClick={act(() => movePage(page.id, 1))}>Move right</button></li>
            <li><button class="text-error" disabled={list.length < 2} onClick={act(remove)}>Delete page…</button></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
