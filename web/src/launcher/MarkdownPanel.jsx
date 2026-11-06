import { useState, useMemo, useRef, useEffect } from 'preact/hooks'
import { useHotkeyScope } from './hotkeys.js'
import { parseMarkdown, renderMarkdown, docStats, htmlDocument, mdFill, SAMPLE } from './md.js'
import { shortHash } from './diff.js'
import { remember } from './history.js'

export function MarkdownPanel({ item, setInput }) {
  const text = item.data.text
  const [note, setNote] = useState('')
  const view = useRef()
  const onKeydown = useHotkeyScope()

  const rendered = useMemo(() => renderMarkdown(parseMarkdown(text)), [text])
  const stats = useMemo(() => docStats(text), [text])

  const flash = (m) => { setNote(m); setTimeout(() => setNote(''), 1800) }
  const record = () => {
    if (text.length > 40000) return
    const heading = text.match(/^\s{0,3}#{1,6}\s+(.+)$/m)?.[1] || text.trim().split('\n')[0]
    remember('md', { key: `md:${shortHash(text)}`, title: `Markdown · ${heading.slice(0, 50)}`, subtitle: `${stats.words} words`, fill: mdFill(text) })
  }
  const bodyHtml = () => view.current.innerHTML

  const copyRich = async () => {
    if (!text.trim()) return
    const html = bodyHtml()
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })])
      flash('Rich text copied ✓')
      record()
    } catch { flash('Could not copy rich text: use Copy HTML') }
  }
  const copyHtml = async () => {
    if (!text.trim()) return
    try { await navigator.clipboard.writeText(bodyHtml()); flash('HTML copied ✓'); record() } catch {}
  }
  const download = () => {
    if (!text.trim()) return
    const title = view.current.querySelector('h1,h2,h3')?.textContent || 'Document'
    const url = URL.createObjectURL(new Blob([htmlDocument(title, bodyHtml())], { type: 'text/html' }))
    Object.assign(document.createElement('a'), { href: url, download: 'document.html' }).click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    record()
  }

  useEffect(() => onKeydown((e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); copyRich() } }))

  // #anchor links scroll inside the preview instead of changing the page address
  const onClick = (e) => {
    const a = e.target.closest?.('a[href^="#"]')
    if (!a) return
    e.preventDefault()
    view.current.querySelector(`[id="${CSS.escape(decodeURIComponent(a.getAttribute('href').slice(1)))}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  return (
    <div class="p-3 grid gap-2 max-h-[70vh] overflow-auto">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs opacity-70">{stats.words} words · {stats.chars} characters · {stats.lines} line{stats.lines === 1 ? '' : 's'} · ~{stats.minutes} min read</span>
        {note && <span class="text-xs text-success">{note}</span>}
        <div class="ml-auto flex flex-wrap gap-1">
          <button class="btn btn-primary btn-sm" disabled={!text.trim()} onClick={copyRich}>Copy rich text <kbd class="kbd kbd-xs text-base-content">Ctrl ⏎</kbd></button>
          <button class="btn btn-sm" disabled={!text.trim()} onClick={copyHtml}>Copy HTML</button>
          <button class="btn btn-sm btn-ghost" disabled={!text.trim()} onClick={download}>Download .html</button>
        </div>
      </div>

      {rendered.raw > 0 && <div class="text-xs text-info">{rendered.raw} raw HTML snippet{rendered.raw === 1 ? '' : 's'} shown as text (HTML in Markdown is not rendered, for safety).</div>}

      {!text.trim() && (
        <div class="text-sm opacity-70 grid gap-2">
          <div>Type or paste Markdown in the box above and the preview appears here.</div>
          {setInput && <button class="btn btn-sm btn-outline w-fit" onClick={() => setInput(mdFill(SAMPLE))}>Insert an example</button>}
        </div>
      )}

      <div ref={view} onClick={onClick} class={`md-preview rounded border border-base-300 bg-base-100/60 p-3 overflow-auto max-h-[52vh] ${text.trim() ? '' : 'hidden'}`}>
        {rendered.nodes}
      </div>
    </div>
  )
}
