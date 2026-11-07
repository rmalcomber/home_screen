import { useEffect, useRef, useState } from 'preact/hooks'
import { pageTiles, query, editing, importing, loaded, error, settings, settingsOpen, launcher, templatesOpen, load } from './store.js'
import { Launcher } from './launcher/Launcher.jsx'
import { SettingsDialog } from './ui/SettingsDialog.jsx'
import { Grid } from './ui/Grid.jsx'
import { TileEditor } from './ui/TileEditor.jsx'
import { PageBar } from './ui/PageBar.jsx'
import { TemplatePicker, TemplateCards } from './ui/TemplatePicker.jsx'
import { ImportBookmarks } from './ui/ImportBookmarks.jsx'

export function App() {
  const search = useRef()
  const st = settings.value
  const auto = st.autoHideBar !== false
  const [peek, setPeek] = useState(false)
  const leaveTimer = useRef()
  useEffect(() => {
    const b = document.body.style
    const bg = typeof st.bgImage === 'string' && st.bgImage
    b.backgroundColor = st.bgColor || ''
    b.backgroundImage = bg ? `url("${bg}")` : ''
    b.backgroundSize = 'cover'
    b.backgroundPosition = 'center'
    b.backgroundAttachment = 'fixed'
    document.documentElement.style.setProperty('--glass', String(Number(st.glass) || 0))
  }, [st.bgColor, st.bgImage, st.glass])
  const act = (fn) => () => { document.activeElement?.blur(); fn() }
  useEffect(() => {
    load().catch(() => {})
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        launcher.value = { q: '>', stamp: Date.now() }
        return
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'p' || e.key === 'k')) {
        e.preventDefault()
        launcher.value = launcher.value ? null : { q: '', stamp: Date.now() }
        return
      }
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        e.preventDefault()
        search.current.focus()
      }
      if (e.key === 'Escape' && document.activeElement === search.current) { query.value = ''; search.current.blur() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  return (
    <>
      {auto && <div class="fixed top-0 inset-x-0 h-2 z-50 bg-primary/20" onMouseEnter={() => { clearTimeout(leaveTimer.current); setPeek(true) }} onClick={() => setPeek(true)} />}
      <div
        class={`navbar tile-glass border-b border-base-300 gap-2 px-4 transition-transform duration-200 ${auto ? 'fixed top-0 inset-x-0 z-50' : 'sticky top-0 z-40'} ${auto && !peek ? '-translate-y-full focus-within:translate-y-0' : ''}`}
        onMouseEnter={() => clearTimeout(leaveTimer.current)}
        onMouseLeave={() => { clearTimeout(leaveTimer.current); leaveTimer.current = setTimeout(() => setPeek(false), 350) }}
      >
        <div class="flex-none text-lg font-bold">🏠 Home</div>
        <div class="flex-1 flex justify-center">
          <label class="input input-sm input-bordered flex items-center gap-2 w-full max-w-md">
            <span class="opacity-60">🔍</span>
            <input ref={search} class="grow" placeholder="Search tiles, links, URLs…  ( / )" value={query.value} onInput={(e) => (query.value = e.target.value)} />
            {query.value && <button class="opacity-60 hover:opacity-100" onClick={() => (query.value = '')}>✕</button>}
          </label>
        </div>
        <div class="flex-none dropdown dropdown-end">
          <button tabIndex={0} class="btn btn-ghost btn-square" aria-label="Menu" aria-haspopup="menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <ul tabIndex={0} class="menu dropdown-content bg-base-100 rounded-box shadow-lg border border-base-300 w-56 mt-2 z-50">
            <li><button onClick={act(() => (launcher.value = { q: '', stamp: Date.now() }))}>Launcher <kbd class="kbd kbd-xs ml-auto">Ctrl+P</kbd></button></li>
            <div class="divider my-0"></div>
            <li><button onClick={act(() => (editing.value = { id: null }))}>＋ Add tile</button></li>
            <li><button onClick={act(() => (editing.value = { id: null, type: 'group' }))}>＋ Add group</button></li>
            <li><button onClick={act(() => (templatesOpen.value = true))}>Starter templates</button></li>
            <li><button onClick={act(() => (importing.value = true))}>Import Bookmarks</button></li>
            <div class="divider my-0"></div>
            <li><button onClick={act(() => (settingsOpen.value = true))}>Settings</button></li>
          </ul>
        </div>
      </div>

      {error.value && (
        <div role="alert" class="alert alert-error mx-4 mt-2 py-2">
          <span>{error.value}</span>
          <button class="btn btn-xs" onClick={() => (error.value = '')}>Dismiss</button>
        </div>
      )}

      <main class={`p-3 ${auto ? 'pt-4' : ''}`}>
        {loaded.value && <PageBar />}
        {loaded.value && pageTiles.value.length === 0 && (
          <div class="py-10 grid gap-6 max-w-5xl mx-auto text-center">
            <div class="grid gap-2">
              <h1 class="text-3xl font-bold">Nothing here yet</h1>
              <p class="opacity-70">Start from a template, add a tile, or import your Chrome bookmarks.</p>
              <div class="flex gap-2 justify-center">
                <button class="btn btn-primary" onClick={() => (editing.value = { id: null })}>+ Add tile</button>
                <button class="btn btn-outline" onClick={() => (editing.value = { id: null, type: 'group' })}>+ Add group</button>
                <button class="btn btn-outline" onClick={() => (importing.value = true)}>Import Bookmarks</button>
              </div>
            </div>
            <TemplateCards compact />
          </div>
        )}
        <Grid />
      </main>

      <TileEditor />
      <TemplatePicker />
      <ImportBookmarks />
      <SettingsDialog />
      <Launcher />
    </>
  )
}
