import { useState } from 'preact/hooks'
import { templatesOpen, currentPage, pageTiles, error } from '../store.js'
import { TEMPLATES, applyTemplate, countTiles, countGroups } from '../templates.js'
import { colorValue } from '../colors.js'

const swatches = (tpl) => [...new Set(tpl.tiles.filter((t) => t.color).map((t) => t.color))]

/** The cards themselves, also used on the empty-dashboard welcome screen. */
export function TemplateCards({ onDone, compact }) {
  const [busy, setBusy] = useState(null)
  const empty = pageTiles.value.length === 0
  const use = async (tpl, newPage) => {
    setBusy(tpl.id)
    try { await applyTemplate(tpl, { newPage }); onDone?.() } catch (e) { error.value = e.message } finally { setBusy(null) }
  }
  return (
    <div class={`grid gap-3 ${compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'} text-left`}>
      {TEMPLATES.map((tpl) => (
        <div key={tpl.id} class="card tile-glass border border-base-300 p-4 gap-2">
          <div class="flex items-center gap-2">
            <h4 class="font-semibold flex-1">{tpl.name}</h4>
            {swatches(tpl).map((c) => <span key={c} class="w-3 h-3 rounded-full" style={{ background: colorValue(c) }} />)}
          </div>
          <p class="text-sm opacity-75 flex-1">{tpl.description}</p>
          <p class="text-xs opacity-60">{countTiles(tpl)} tiles{countGroups(tpl) ? `, ${countGroups(tpl)} group${countGroups(tpl) === 1 ? '' : 's'}` : ''}{tpl.mode === 'columns' ? `, ${tpl.cols} columns` : ''}</p>
          <div class="flex gap-2 mt-1">
            <button class={`btn btn-sm ${empty ? 'btn-primary' : 'btn-outline'} ${busy ? 'btn-disabled' : ''}`} onClick={() => use(tpl, false)}>{busy === tpl.id ? 'Adding…' : empty ? 'Use this' : `Add to “${currentPage.value?.name}”`}</button>
            <button class={`btn btn-sm btn-ghost ${busy ? 'btn-disabled' : ''}`} onClick={() => use(tpl, true)}>New page</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function TemplatePicker() {
  if (!templatesOpen.value) return null
  const close = () => (templatesOpen.value = false)
  return (
    <dialog class="modal modal-open" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div class="modal-box max-w-3xl grid gap-3">
        <h3 class="font-bold text-lg">Starter templates</h3>
        <p class="text-sm opacity-70">Ready-made arrangements of tiles, groups and widgets. Add one to this page or give it a page of its own, then change anything you like.</p>
        <TemplateCards onDone={close} />
        <div class="modal-action mt-0"><button class="btn" onClick={close}>Close</button></div>
      </div>
      <div class="modal-backdrop" onClick={close} />
    </dialog>
  )
}
