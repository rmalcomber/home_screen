// Helpers for building launcher result rows. Exposed through host.js.
import { remember } from '../launcher/history.js'

/**
 * A row that copies `text` when chosen (Enter or click).
 *   history  optional { kind, key, title, subtitle, fill }: saved to Recent when the row is used
 *   mono     show the title in a monospace font
 */
export function copyItem({ key, title, subtitle, icon, text = title, history, mono }) {
  return {
    key,
    title,
    mono,
    subtitle: subtitle ? `${subtitle}  ·  Enter to copy` : 'Enter to copy',
    kind: 'Copy',
    recent: false,
    icon,
    run: () => {
      if (history) remember(history.kind, { key: history.key, title: history.title, subtitle: history.subtitle, fill: history.fill })
      navigator.clipboard?.writeText(text).catch(() => {})
    },
  }
}

/** One line of text for a result title: whitespace collapsed, long text shortened. */
export const preview = (text, max = 80) => {
  const t = String(text).replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

/**
 * A row that opens a web page when chosen: in a new tab on Enter, in the current tab on Shift+Enter. `verb` is what a
 * widget shows on the row. `history` works as in copyItem.
 */
export function openItem({ key, title, subtitle, icon = 'iconify:fa6-solid:arrow-up-right-from-square', url, history, mono }) {
  return {
    key,
    title,
    mono,
    subtitle: subtitle ? `${subtitle}  ·  Enter to open` : 'Enter to open',
    kind: 'Open',
    verb: 'Open',
    recent: false,
    icon,
    run: ({ newTab } = {}) => {
      if (history) remember(history.kind, { key: history.key, title: history.title, subtitle: history.subtitle, fill: history.fill })
      if (newTab === false) window.location.href = url
      else window.open(url, '_blank', 'noopener')
    },
  }
}
