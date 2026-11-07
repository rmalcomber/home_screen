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
