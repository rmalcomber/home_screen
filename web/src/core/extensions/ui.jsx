import { useState } from 'preact/hooks'

// Small UI pieces shared by extensions. Exposed through host.js.

/** A labelled form field for a widget's Options form. */
export const Field = ({ label, children }) => (
  <label class="grid gap-1">
    <span class="text-xs">{label}</span>
    {children}
  </label>
)

/** Copies text to the clipboard. Resolves to true when it worked. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** A button that copies `text` and says "Copied ✓" for a moment. */
export function CopyButton({ text, label = 'Copy', class: cls = 'btn btn-xs btn-ghost', onCopied, disabled }) {
  const [done, setDone] = useState(false)
  const click = async () => {
    if (!(await copyText(text))) return
    onCopied?.()
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }
  return (
    <button type="button" class={cls} disabled={disabled} onClick={click}>
      {done ? 'Copied ✓' : label}
    </button>
  )
}

/**
 * Rows editor for a widget's Options: add, remove and move rows up or down.
 * `rows` is an array and `onChange(next)` gets the new array. `render(row, set, i)` draws one row's fields
 * (`set(patch)` merges into that row). `blank` is the new row. At least `min` rows are kept.
 */
export function ListRows({ rows, onChange, render, blank, addLabel = '+ Add', min = 1 }) {
  const patch = (i, p) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const move = (i, d) => {
    const next = [...rows]
    const t = next[i]
    next[i] = next[i + d]
    next[i + d] = t
    onChange(next)
  }
  return (
    <div class="grid gap-2">
      {rows.map((r, i) => (
        <div key={i} class="flex gap-1 items-start">
          <div class="grid gap-1 flex-1 min-w-0">{render(r, (p) => patch(i, p), i)}</div>
          <div class="flex flex-col">
            <button type="button" class="btn btn-ghost btn-xs px-1 min-h-0 h-5" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
            <button type="button" class="btn btn-ghost btn-xs px-1 min-h-0 h-5" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>▼</button>
          </div>
          {rows.length > min && (
            <button type="button" class="btn btn-ghost btn-xs" aria-label="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
          )}
        </div>
      ))}
      <button type="button" class="btn btn-xs btn-outline justify-self-start" onClick={() => onChange([...rows, typeof blank === 'function' ? blank() : { ...blank }])}>{addLabel}</button>
    </div>
  )
}
