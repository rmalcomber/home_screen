// A launcher tool as a dashboard widget: a text box on top, the tool's results below. It hosts the same tool (and result
// panel) the launcher uses. Input is not stored (it can hold tokens, JSON, curl commands...).
import { useState, useEffect, useRef } from 'preact/hooks'
import { HotkeyScope } from '../launcher/hotkeys.js'
import { loadExtension } from './loader.js'

/**
 * `def` is the widget's `host` block from its manifest:
 *   provider    the extension's tool id
 *   prefix      command word added in front of the text (the tool recognises it); '' = raw text
 *   input       'line' | 'multi' | 'none' (none: the result panel has its own fields)
 *   allowEmpty  show results with no text (generators)
 *   regenerate  show a "Generate again" button
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
  const q = buildQuery(def, text)

  useEffect(() => {
    if (q === null) { setItems([]); return }
    let dead = false
    const t = setTimeout(async () => {
      try {
        const mod = await loadExtension(extension)
        const out = await mod.tool.items(q, {})
        if (!dead) setItems(out || [])
      } catch {
        if (!dead) setItems([])
      }
    }, 150)
    return () => { dead = true; clearTimeout(t) }
  }, [q, nonce])

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
          <div class="flex gap-1 items-start min-w-0">
            {def.input === 'multi' ? (
              <textarea class="textarea textarea-bordered textarea-sm font-mono w-full leading-snug" rows={def.rows || 3} placeholder={def.placeholder} value={text} onInput={(e) => setText(e.target.value)} spellcheck={false} />
            ) : (
              <input class="input input-sm input-bordered w-full min-w-0 flex-1" placeholder={def.placeholder} value={text} onInput={(e) => setText(e.target.value)} spellcheck={false} autocomplete="off" />
            )}
            {def.regenerate && <button class="btn btn-sm btn-ghost shrink-0" title="Generate again" onClick={() => setNonce((n) => n + 1)}>↻</button>}
          </div>
        )}
        {Panel ? (
          <Panel key={panelItem.key} item={panelItem} input={q} />
        ) : q === null ? (
          <p class="text-sm opacity-60 px-1">{def.hint || def.description}</p>
        ) : items.length === 0 ? (
          <p class="text-sm opacity-60 px-1">Nothing recognised yet. {def.placeholder ? `Try: ${def.placeholder.replace(/^e\.g\. /, '')}` : ''}</p>
        ) : (
          <ul class="grid grid-cols-[minmax(0,1fr)] gap-0.5">
            {items.map((it) => (
              <li key={it.key}>
                <button type="button" class="w-full flex items-start gap-2 px-2 py-1 rounded text-left hover:bg-base-300" onClick={() => run(it)} title="Click to copy">
                  <span class="min-w-0 flex-1">
                    <span class={`block text-sm break-all line-clamp-3 ${it.mono || def.provider !== 'calc' ? 'font-mono' : 'font-semibold'}`}>{it.title}</span>
                    {it.subtitle && <span class="block text-xs opacity-60 truncate">{it.subtitle.replace(/\s*·\s*Enter to copy$/, '')}</span>}
                  </span>
                  <span class="text-xs opacity-60 shrink-0 mt-0.5">{flash === it.key ? 'Copied ✓' : 'Copy'}</span>
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
  </p>
)
