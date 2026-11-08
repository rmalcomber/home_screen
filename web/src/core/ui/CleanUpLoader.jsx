import { useState, useEffect } from 'preact/hooks'
import { cleaning } from '../store.js'

// The Clean up dialog is rarely used, so its code is fetched the first time it is opened instead of with every page.
let loaded = null

export function CleanUp() {
  const open = cleaning.value
  const [Dialog, setDialog] = useState(() => loaded)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!open || Dialog) return
    import('./CleanUp.jsx')
      .then((m) => {
        loaded = m.CleanUp
        setDialog(() => m.CleanUp)
      })
      .catch(() => setFailed(true))
  }, [open])
  if (!open) return null
  if (failed) {
    return (
      <dialog class="modal modal-open">
        <div class="modal-box">
          <p>Clean up could not be loaded. If Home Screen was just updated, reload the page.</p>
          <div class="modal-action">
            <button class="btn" onClick={() => { setFailed(false); cleaning.value = false }}>Close</button>
          </div>
        </div>
      </dialog>
    )
  }
  return Dialog ? <Dialog /> : null
}
