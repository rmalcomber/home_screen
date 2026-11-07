// Registers one launcher provider per extension tool. Each is a thin stand-in that loads the extension's code the
// first time the launcher asks it for results, so opening the launcher loads the tools and nothing else does.
import { registerProvider } from '../launcher/registry.js'
import { TOOLS } from './registry.js'
import { loadExtension } from './loader.js'

export function registerExtensionTools() {
  for (const t of TOOLS) {
    registerProvider({
      id: t.id,
      name: t.name,
      order: t.order,
      filter: false,
      async items(q, ctx) {
        const mod = await loadExtension(t.extension)
        return mod.tool.items(q, ctx)
      },
    })
  }
}
