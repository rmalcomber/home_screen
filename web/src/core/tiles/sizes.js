// Default size (in grid columns and rows) of a new tile, by type; widgets bring their own.
import { WIDGETS_META } from '../extensions/registry.js'

export const DEFAULT_SIZE = { bookmarks: [4, 12], dev: [4, 7], github: [4, 10], widget: [3, 8], group: [6, 14] }

export function defaultSize(t) {
  if (t.type === 'widget') return WIDGETS_META[t.config?.kind]?.size || DEFAULT_SIZE.widget
  return DEFAULT_SIZE[t.type] || [4, 6]
}
