// A launcher tool as a dashboard widget: a text box on top, the tool's results below. It hosts the same tool (and result
// panel) the launcher uses. Input is not stored (it can hold tokens, JSON, curl commands...).
import { useState, useEffect, useRef } from 'preact/hooks'
import { HotkeyScope } from '../launcher/hotkeys.js'
import { loadExtension } from './loader.js'
import { FileButton, FileDrop } from './ui.jsx'
import { readTextFile, readBytesFile, formatBytes } from '../lib/file.js'

/**
 * `def` is the widget's `host` block from its manifest:
 *   provider    the extension's tool id
 *   prefix      command word added in front of the text (the tool recognises it); '' = raw text
 *   input       'line' | 'multi' | 'none' (none: the result panel has its own fields)
 *   allowEmpty  show results with no text (generators)
 *   regenerate  show a "Generate again" button
 *   files       true: the text box also takes a text file (Open file… or drop it); 'bytes': any file is read as raw bytes
 *               and handed to the tool's fileItems(bytes, name). Only for input 'multi'.
 *   accept      the file picker's accept list
 */

/** The launcher text for a given widget input, or null when there is nothing to run yet. */
export function buildQuery(def, text) {
  const t = text.trim()
  if (def.prefix) return t ? `${def.prefix} ${text}` : def.input === 'none' || def.allowEmpty ? def.prefix : null
  return t ? text : null
}

export function ToolHost({ extension, def }) {
  const root = useRef()
  const [text, setText] = useState(def.default || '')
  const [items, setItems] = useState([])
  const [nonce, setNonce] = useState(0)
  const [flash, setFlash] = useState('')
  const [file, setFile] = useState(null) // { name, size, bytes? } of a loaded file
  const [fileError, setFileError] = useState('')
  const q = buildQuery(def, text)
  const bytesFile = file?.bytes ? file : null

  useEffect(() => {
    if (q === null && !bytesFile) { setItems([]); return }
    let dead = false
    const t = setTimeout(async () => {
      try {
        const mod = await loadExtension(extension)
        const out = bytesFile ? await mod.tool.fileItems(bytesFile.bytes, bytesFile.name) : await mod.tool.items(q, {})
        if (!dead) setItems(out || [])
      } catch {
        if (!dead) setItems([])
      }
    }, bytesFile ? 0 : 150)
    return () => { dead = true; clearTimeout(t) }
  }, [q, nonce, bytesFile])

  const onFiles = async ([f]) => {
    setFileError('')
    if (def.files === 'bytes') {
      const r = await readBytesFile(f)
      if (!r.ok) return setFileError(r.error)
      setText('')
      setFile({ name: r.name, size: r.size, bytes: r.bytes })
    } else {
      const r = await readTextFile(f)
      if (!r.ok) return setFileError(r.error)
      setText(r.text)
      setFile({ name: r.name, size: r.size })
    }
  }
  const clearFile = () => { setFile(null); setFileError(''); setText('') }
  const edit = (v) => { setText(v); if (file) setFile(null) }

  const panelItem = items.find((i) => i.panel)
  const Panel = panelItem?.panel
  const run = async (it) => {
    try { await it.run({ newTab: true }) } catch {}
    setFlash(it.key)
    setTimeout(() => setFlash((k) => (k === it.key ? '' : k)), 1200)
  }

  return (
    <HotkeyScope.Provider value={root}>
      <div ref={root} class="tool-host grid grid-cols-[minmax(0,1fr)] gap-2">
        {def.input !== 'none' && (
          <FileDrop onFiles={def.files ? onFiles : () => {}} class="grid gap-1 min-w-0">
            <div class="flex gap-1 items-start min-w-0">
              {def.input === 'multi' ? (
                <textarea class="textarea textarea-bordered textarea-sm font-mono w-full leading-snug" rows={def.rows || 3} placeholder={def.placeholder} value={text} onInput={(e) => edit(e.target.value)} spellcheck={false} />
              ) : (
                <input class="input input-sm input-bordered w-full min-w-0 flex-1" placeholder={def.placeholder} value={text} onInput={(e) => edit(e.target.value)} spellcheck={false} autocomplete="off" />
              )}
              {def.regenerate && <button class="btn btn-sm btn-ghost shrink-0" title="Generate again" onClick={() => setNonce((n) => n + 1)}>↻</button>}
            </div>
            {def.files && (
              <div class="flex items-center gap-1 text-xs min-w-0">
                <FileButton onFiles={onFiles} accept={def.accept} />
                {file ? (
                  <>
                    <span class="truncate opacity-70" title={file.name}>{file.name} · {formatBytes(file.size)}</span>
                    <button type="button" class="btn btn-xs btn-ghost" onClick={clearFile}>Clear</button>
                  </>
                ) : (
                  <span class="opacity-50 truncate">or drop a file here</span>
                )}
              </div>
            )}
            {fileError && <div role="alert" class="alert alert-warning py-1 text-xs">{fileError}</div>}
          </FileDrop>
        )}
        {Panel ? (
          <Panel key={panelItem.key} item={panelItem} input={q} />
        ) : q === null && !bytesFile ? (
          <p class="text-sm opacity-60 px-1">{def.hint || def.description}</p>
        ) : items.length === 0 ? (
          <p class="text-sm opacity-60 px-1">Nothing recognised yet. {def.placeholder ? `Try: ${def.placeholder.replace(/^e\.g\. /, '')}` : ''}</p>
        ) : (
          <ul class="grid grid-cols-[minmax(0,1fr)] gap-0.5">
            {items.map((it) => (
              <li key={it.key}>
                <button type="button" class="w-full flex items-start gap-2 px-2 py-1 rounded text-left hover:bg-base-300" onClick={() => run(it)} title={`Click to ${(it.verb || 'Copy').toLowerCase()}`}>
                  <span class="min-w-0 flex-1">
                    <span class={`block text-sm break-all line-clamp-3 ${it.mono || def.provider !== 'calc' ? 'font-mono' : 'font-semibold'}`}>{it.title}</span>
                    {it.subtitle && <span class="block text-xs opacity-60 truncate">{it.subtitle.replace(/\s*·\s*Enter to copy$/, '')}</span>}
                  </span>
                  {it.kind !== 'Info' && it.kind !== 'Error' && <span class="text-xs opacity-60 shrink-0 mt-0.5">{flash === it.key ? (it.verb ? 'Opened ✓' : 'Copied ✓') : it.verb || 'Copy'}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </HotkeyScope.Provider>
  )
}

/** The generic "settings" text for a tool widget. */
export const ToolOptions = ({ def }) => (
  <p class="text-sm opacity-60">
    {def.description} Use the text box inside the tile{def.input === 'none' ? ' (this tool has its own fields)' : ''}.
    {def.input !== 'none' && ' What you type is not saved.'}
    {def.files && ' You can also open or drop a file; it is read in your browser and never uploaded.'}
  </p>
)
