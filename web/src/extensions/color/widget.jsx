import { useState, useEffect, useRef } from 'preact/hooks'
import { patchConfig, parseColor, toHex } from '../../core/extensions/host.js'

import { ColorTool } from './ColorTool.jsx'

const DEFAULT_COLOR = '#3b82f6'
const colorpicker = {
  Body({ tile }) {
    const c = tile.config
    const [color, setColor] = useState(() => ({ ...(parseColor(c.color || DEFAULT_COLOR) || parseColor(DEFAULT_COLOR)), a: c.alpha ?? 1 }))
    const timer = useRef()
    const latest = useRef(tile)
    latest.current = tile

    // Save the working colour shortly after it stops changing.
    const change = (next) => {
      setColor(next)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => patchConfig(latest.current, { ...latest.current.config, color: toHex(next), alpha: next.a }), 600)
    }
    // Copying a value adds the colour to this tile's recent list.
    const copied = (_, col) => {
      const hex = toHex(col, true)
      const history = [hex, ...(latest.current.config.history || []).filter((h) => h !== hex)].slice(0, 12)
      patchConfig(latest.current, { ...latest.current.config, color: toHex(col), alpha: col.a, history })
    }
    const history = c.history || []
    return (
      <div class="grid gap-2">
        <ColorTool color={color} onChange={change} onCopy={copied} compact />
        {history.length > 0 && (
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Recent</div>
            <div class="flex flex-wrap gap-1">
              {history.map((h) => (
                <button key={h} type="button" title={h} class="w-6 h-6 rounded border border-base-content/20 hover:scale-110 transition-transform" style={{ background: h }} onClick={() => change(parseColor(h))} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  },
  Options: () => <p class="text-sm opacity-60">Pick a colour, then click any format to copy it. Copied colours are kept under Recent.</p>,
}

export default colorpicker
