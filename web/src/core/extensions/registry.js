// All manifests (loaded up front, they are tiny) and the widget metadata derived from them.
// The code of an extension is not here: see loader.js.
import { CATEGORIES } from './categories.js'

const found = import.meta.glob('../../extensions/*/manifest.js', { eager: true, import: 'default' })

/** Every extension manifest. */
export const EXTENSIONS = Object.values(found).sort((a, b) => (a.id < b.id ? -1 : 1))
export const extensionById = (id) => EXTENSIONS.find((e) => e.id === id)

// The order widgets appear in the picker within a category. Anything not listed comes after, by name.
const PICKER_ORDER = ['clock', 'weather', 'countdown', 'notes', 'tabata', 'carousel', 'todo', 'colorpicker', 'tool-calc', 'tool-units', 'tool-currency', 'tool-timestamp', 'tool-cron', 'tool-markdown', 'tool-qr', 'tool-lorem', 'tool-password', 'tool-hash', 'tool-base64', 'tool-uuid', 'tool-jwt', 'tool-curl', 'tool-json', 'tool-regex', 'tool-diff', 'tool-csv']

const metas = EXTENSIONS.flatMap((e) =>
  (e.widgets || []).map((w) => ({
    kind: w.kind,
    extension: e.id,
    label: w.name,
    category: w.category,
    icon: w.icon,
    description: w.description,
    size: w.size,
    defaults: w.defaults || { kind: w.kind },
    host: w.host ? { ...w.host, description: w.description } : null,
    tool: !!w.host, // true: a launcher tool shown as a widget
  })),
)
const rank = (k) => {
  const i = PICKER_ORDER.indexOf(k)
  return i < 0 ? PICKER_ORDER.length : i
}
metas.sort((a, b) => rank(a.kind) - rank(b.kind) || (a.kind < b.kind ? -1 : 1))

/** Widget metadata by kind: what the picker, templates, editor and grid need without loading any code. */
export const WIDGETS_META = Object.fromEntries(metas.map((m) => [m.kind, m]))

/** Launcher tools, in the order their results appear. */
export const TOOLS = EXTENSIONS.filter((e) => e.tool)
  .map((e) => ({ ...e.tool, extension: e.id }))
  .sort((a, b) => a.order - b.order)

export { CATEGORIES }
