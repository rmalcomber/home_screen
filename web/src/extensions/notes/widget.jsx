import { useState } from 'preact/hooks'
import { patchConfig } from '../../core/extensions/host.js'

const notes = {
  Body({ tile }) {
    const [v, setV] = useState(tile.config.text || '')
    return (
      <textarea
        class="textarea textarea-ghost w-full h-full resize-none text-sm leading-snug"
        placeholder="Scratch notes…"
        value={v}
        onInput={(e) => setV(e.target.value)}
        onBlur={() => v !== (tile.config.text || '') && patchConfig(tile, { ...tile.config, text: v })}
      />
    )
  },
  Options: () => <p class="text-sm opacity-60">Type directly in the tile; it saves when you click away.</p>,
}



export default notes
