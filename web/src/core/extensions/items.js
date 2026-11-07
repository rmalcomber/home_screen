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
