import { historyItems } from '../../core/extensions/host.js'
import { parseYamlCommand } from './engine.js'
import { YamlPanel } from './Panel.jsx'

const ICON = 'iconify:fa6-solid:file-code'

// JSON, YAML and TOML: "yaml <text>" turns JSON or TOML into YAML (or YAML into JSON); "toml <text>" likewise for TOML;
// "json2yaml", "yaml2json", "json2toml", "toml2json", "yaml2toml", "toml2yaml" pick both formats. The panel lets you change
// either one. Ctrl+Enter copies the result.
export default {
  items(q) {
    if (!q.trim()) return historyItems('yaml', 'Convert', ICON)
    const cmd = parseYamlCommand(q)
    if (!cmd) return []
    return [{ key: 'yaml:' + q, title: 'JSON, YAML and TOML', kind: 'convert', icon: ICON, panel: YamlPanel, hint: 'Ctrl+Enter: copy result', data: cmd }]
  },
}
