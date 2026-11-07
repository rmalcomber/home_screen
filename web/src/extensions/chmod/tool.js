import { copyItem, historyItems } from '../../core/extensions/host.js'
import { parseChmodCommand, parseMode, fromUmask, toOctal, toSymbolic, chmodFill } from './engine.js'
import { ChmodPanel } from './Panel.jsx'

const ICON = 'iconify:fa6-solid:lock-open'

// Unix permissions: "chmod 755", "chmod rwxr-xr-x", "chmod 644 u+x,g+w" open an editor with a grid of permission boxes;
// "umask 022" shows what new files and directories get. Ctrl+Enter copies the chmod command.
export default {
  items(q) {
    if (!q.trim()) return historyItems('chmod', 'chmod', ICON)
    const cmd = parseChmodCommand(q)
    if (!cmd) return []
    const { word, text } = cmd
    if (word === 'umask') {
      const u = fromUmask(text)
      if (!u) return text ? [{ key: `chmod:bad:${q}`, title: 'Not a umask', subtitle: 'Three octal digits, such as 022 or 077', kind: 'Error', icon: ICON, run() {} }] : []
      const history = { kind: 'chmod', key: `chmod:umask:${u.umask}`, title: `umask ${u.umask}`, subtitle: `files ${toOctal(u.file)}, directories ${toOctal(u.dir)}`, fill: `umask ${u.umask}` }
      return [
        copyItem({ key: `chmod:umask-file:${u.umask}`, title: toOctal(u.file), subtitle: `New files get ${toSymbolic(u.file)} with umask ${u.umask}`, icon: ICON, mono: true, history }),
        copyItem({ key: `chmod:umask-dir:${u.umask}`, title: toOctal(u.dir), subtitle: `New directories get ${toSymbolic(u.dir)} with umask ${u.umask}`, icon: ICON, mono: true, history }),
      ]
    }
    const r = parseMode(text)
    return [{ key: `chmod:${q.trim()}`, title: r.ok ? `chmod ${toOctal(r.mode)}` : 'chmod', kind: 'chmod', icon: ICON, panel: ChmodPanel, hint: 'Ctrl+Enter: copy command', data: r, fill: chmodFill(text) }]
  },
}
