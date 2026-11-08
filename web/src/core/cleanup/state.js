// Clean up state that outlives the dialog (but not a page reload): link-check answers and the last clean up, so it can be undone.
import { signal } from '@preact/signals'

/** url -> check result, filled by "Check links". */
export const checkCache = new Map()

/** The last applied clean up: { undo, summary, at } or null. */
export const lastCleanup = signal(null)
