import { useState, useEffect } from 'preact/hooks'
import { useHotkeyScope } from '../core/launcher/hotkeys.js'
import { ColorTool } from '../core/ui/ColorTool.jsx'
import { toHex, formats } from './color.js'
import { remember } from '../core/launcher/history.js'

const DEFAULT = { r: 59, g: 130, b: 246, a: 1 }

export const colorEntry = (c) => ({
  key: `color:${toHex(c, true)}`,
  title: toHex(c, c.a < 1),
  subtitle: formats(c).find((f) => f.id === 'rgb').value,
  swatch: toHex(c, true),
  fill: `color ${toHex(c, true)}`,
})

export function ColorPanel({ item }) {
  const { rgba, error } = item.data
  const [color, setColor] = useState(rgba || DEFAULT)

  // Enter copies the HEX value.
  const onKeydown = useHotkeyScope()
  useEffect(() => {
    const h = async (e) => {
      if (e.key !== 'Enter' || e.isComposing || e.target.closest?.('input,button')) return
      e.preventDefault()
      try {
        await navigator.clipboard.writeText(toHex(color, color.a < 1))
        remember('color', colorEntry(color))
      } catch {}
    }
    return onKeydown(h)
  })

  return (
    <div class="p-3 grid gap-2 max-h-[68vh] overflow-auto">
      {error && <div role="alert" class="alert alert-warning py-1 text-sm">{error}</div>}
      <ColorTool color={color} onChange={setColor} onCopy={(_, c) => remember('color', colorEntry(c))} />
    </div>
  )
}
