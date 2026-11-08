// The host API: the one door extensions use to reach core. An extension may import this module, preact, its own
// folder, and the npm packages listed in extensions/README (enforced by extensions.test.js). Keep it small.

// Launcher plumbing
export { useHotkeyScope, HotkeyScope } from '../launcher/hotkeys.js'
export { remember, historyItems } from '../launcher/history.js'

// Tile state
export { patchConfig, settings } from '../store.js'

// UI
export { IconView } from '../ui/IconView.jsx'

// Shared pure helpers
export * from '../lib/text.js'
export * from '../lib/json.js'
export * from '../lib/color.js'

// UI helpers
export { Field, copyText, CopyButton, ListRows } from './ui.jsx'

// Launcher result helpers
export { copyItem, openItem, preview } from './items.js'
