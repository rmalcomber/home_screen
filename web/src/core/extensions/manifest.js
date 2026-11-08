// What a manifest looks like, and a checker for it (used by the tests and handy when writing a new extension).
//
//   export default {
//     id: 'cron',                                   // the folder name; unique
//     name: 'Cron explainer',
//     tool: { id: 'cron', name: 'Cron explainer', order: 12 },      // optional: a launcher tool (see tool.js)
//     widgets: [{                                                   // optional: dashboard widgets
//       kind: 'tool-cron',                          // saved inside tiles, so never rename it
//       name, category, icon, description, size: [w, h],
//       defaults: { kind: 'tool-cron' },            // optional; the kind alone is the default
//       host: { provider, prefix, input, placeholder, ... },        // a launcher tool shown as a widget; no Body needed
//     }],
//   }
import { CATEGORIES } from './categories.js'

const INPUTS = ['line', 'multi', 'none']

/** Returns a list of problems; empty when the manifest is fine. */
export function validateManifest(m) {
  const bad = []
  const need = (ok, msg) => { if (!ok) bad.push(msg) }
  need(m && typeof m === 'object', 'manifest must be an object')
  if (bad.length) return bad
  need(typeof m.id === 'string' && /^[a-z][a-z0-9-]*$/.test(m.id), 'id must be lowercase letters, digits and dashes')
  need(typeof m.name === 'string' && m.name.length > 1, 'name is required')
  need(m.tool || m.widgets?.length, 'an extension needs a tool, a widget, or both')
  if (m.tool) {
    need(typeof m.tool.id === 'string' && m.tool.id, 'tool.id is required')
    need(typeof m.tool.name === 'string' && m.tool.name, 'tool.name is required')
    need(Number.isFinite(m.tool.order), 'tool.order must be a number (the order of launcher results)')
  }
  for (const w of m.widgets || []) {
    const at = `widget ${w?.kind}`
    need(typeof w.kind === 'string' && w.kind, 'widget.kind is required')
    need(typeof w.name === 'string' && w.name, `${at}: name is required`)
    need(CATEGORIES.includes(w.category), `${at}: category must be one of ${CATEGORIES.join(', ')}`)
    need(/^iconify:[\w-]+:[\w-]+$/.test(w.icon || ''), `${at}: icon must look like iconify:set:name`)
    need((w.description || '').length > 10, `${at}: description is required`)
    need(Array.isArray(w.size) && w.size.length === 2 && w.size.every((n) => Number.isInteger(n) && n > 0), `${at}: size must be [columns, rows]`)
    if (w.defaults) need(w.defaults.kind === w.kind, `${at}: defaults.kind must equal kind`)
    if (w.host) {
      need(m.tool, `${at}: host widgets need the extension to have a tool`)
      need(w.host.provider === m.tool?.id, `${at}: host.provider must be the extension's tool id`)
      need(INPUTS.includes(w.host.input), `${at}: host.input must be one of ${INPUTS.join(', ')}`)
      if (w.host.files !== undefined) {
        need(w.host.files === true || w.host.files === 'bytes', `${at}: host.files must be true or 'bytes'`)
        need(w.host.input === 'multi', `${at}: host.files needs host.input 'multi'`)
      }
    }
  }
  return bad
}
