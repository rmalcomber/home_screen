// Per-kind launcher history (curl commands, JSON, base64…), stored in this browser's localStorage.
// Entries are { key, title, subtitle, fill }: choosing one puts `fill` back into the launcher input.
// remember() also moves the entry to the top of the launcher's "Recent" list.
import { pushRecent } from './registry.js'

const LIMIT = { curl: 15, json: 10, b64: 10, jwt: 10, uuid: 10, hash: 10, regex: 10, color: 10, lorem: 10, ts: 10, diff: 10, cron: 10, csv: 10, qr: 10, md: 10 }
const store = (kind) => `launcher.history.${kind}`

export function listHistory(kind) {
  try {
    return JSON.parse(localStorage.getItem(store(kind)) || '[]')
  } catch {
    return []
  }
}

export function remember(kind, entry) {
  try {
    const list = [entry, ...listHistory(kind).filter((e) => e.key !== entry.key)].slice(0, LIMIT[kind] ?? 10)
    localStorage.setItem(store(kind), JSON.stringify(list))
  } catch {
    /* storage full or unavailable: history is only a convenience */
  }
  pushRecent(entry.key)
}

/** Launcher items for an empty query (so they appear in "Recent"). */
export const historyItems = (kind, badge, icon) => listHistory(kind).map((e) => ({ ...e, kind: badge, icon }))
