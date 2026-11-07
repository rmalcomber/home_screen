import { useState, useEffect, useRef } from 'preact/hooks'
import { patchConfig } from '../../core/extensions/host.js'

function useNow(ms) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

const Field = ({ label, children }) => (
  <label class="form-control w-full">
    <span class="label-text text-xs mb-1 block">{label}</span>
    {children}
  </label>
)

const countdown = {
  Body({ tile }) {
    const c = tile.config
    const now = useNow(60000)
    if (!c.date) return <p class="text-sm opacity-60 p-2">Edit this tile and set a date.</p>
    const diff = new Date(c.date + 'T00:00:00') - now
    const days = Math.ceil(diff / 86400000)
    return (
      <div class="flex flex-col items-center justify-center h-full">
        <div class="text-5xl font-bold tabular-nums">{Math.abs(days)}</div>
        <div class="text-sm opacity-70">{days === 0 ? 'today' : days > 0 ? `day${days === 1 ? '' : 's'} until` : `day${days === -1 ? '' : 's'} since`}</div>
        <div class="font-semibold text-center">{c.label}</div>
      </div>
    )
  },
  Options({ config, set }) {
    return (
      <div class="grid gap-2">
        <Field label="Label"><input class="input input-sm input-bordered w-full" value={config.label || ''} onInput={(e) => set({ label: e.target.value })} /></Field>
        <Field label="Date"><input type="date" class="input input-sm input-bordered w-full" value={config.date || ''} onInput={(e) => set({ date: e.target.value })} /></Field>
      </div>
    )
  },
}

export default countdown
