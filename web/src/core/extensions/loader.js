// Loads an extension's code the first time it is needed, once. Each extension is its own chunk in the build.
import { useState, useEffect } from 'preact/hooks'

const entries = import.meta.glob('../../extensions/*/index.js')
const idOf = (path) => path.split('/').slice(-2)[0]
const importers = Object.fromEntries(Object.entries(entries).map(([p, f]) => [idOf(p), f]))

const state = new Map() // id -> { status: 'loading' | 'ready' | 'error', promise, mod?, error? }

/** Start (or reuse) loading an extension. Resolves to its entry: { tool?, widgets? }. A failed load can be retried. */
export function loadExtension(id, importer = importers[id]) {
  const have = state.get(id)
  if (have && have.status !== 'error') return have.promise
  const rec = { status: 'loading' }
  rec.promise = (importer ? importer() : Promise.reject(new Error(`No extension called "${id}"`))).then(
    (m) => {
      rec.status = 'ready'
      rec.mod = m.default
      return rec.mod
    },
    (e) => {
      rec.status = 'error'
      rec.error = e
      throw e
    },
  )
  state.set(id, rec)
  return rec.promise
}

/** What is known right now, without loading anything: { status, mod?, error? } (status 'idle' = never asked). */
export const peek = (id) => state.get(id) || { status: 'idle' }

/** For components: starts loading on first use and re-renders when it finishes. Returns { status, mod, retry }. */
export function useExtension(id) {
  const [, tick] = useState(0)
  const rec = peek(id)
  useEffect(() => {
    if (rec.status === 'ready') return
    let dead = false
    const done = () => { if (!dead) tick((n) => n + 1) }
    if (rec.status === 'idle') loadExtension(id).then(done, done)
    else if (rec.status === 'loading') rec.promise.then(done, done)
    return () => { dead = true }
  }, [id, rec.status])
  const retry = () => {
    const done = () => tick((n) => n + 1)
    loadExtension(id).then(done, done)
    done()
  }
  return { status: rec.status === 'idle' ? 'loading' : rec.status, mod: rec.mod, retry }
}

/** Tests only: forget everything that was loaded. */
export const _reset = () => state.clear()
