import { useState, useEffect, useRef } from 'preact/hooks'
import { patchConfig, Field } from '../../core/extensions/host.js'

const Num = ({ label, value, onChange, min = 1, max = 3600 }) => (
  <Field label={label}>
    <input type="number" min={min} max={max} class="input input-sm input-bordered w-full" value={value} onInput={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))} />
  </Field>
)

function beep(freq = 880, ms = 150) {
  try {
    const ctx = (beep.ctx ||= new (window.AudioContext || window.webkitAudioContext)())
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = freq
    g.gain.value = 0.15
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + ms / 1000)
  } catch {}
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const tabata = {
  Body({ tile }) {
    const c = tile.config
    const prep = c.prepare ?? 10
    // phase: idle | prep | work | rest | done
    const [s, setS] = useState({ phase: 'idle', left: 0, round: 1, running: false })
    const cfg = useRef(c)
    cfg.current = c

    const begin = (phase, round) => ({ phase, round, left: phase === 'prep' ? prep : phase === 'work' ? cfg.current.work : cfg.current.rest, running: true })

    useEffect(() => {
      if (!s.running) return
      const id = setInterval(() => {
        setS((p) => {
          if (p.left > 1) {
            if (p.left <= 4 && cfg.current.sound) beep(660, 80)
            return { ...p, left: p.left - 1 }
          }
          const snd = cfg.current.sound
          if (p.phase === 'prep') { snd && beep(1100, 300); return begin('work', 1) }
          if (p.phase === 'work') {
            if (p.round >= cfg.current.rounds) { snd && beep(520, 700); return { ...p, phase: 'done', left: 0, running: false } }
            snd && beep(520, 300)
            return cfg.current.rest > 0 ? begin('rest', p.round) : begin('work', p.round + 1)
          }
          snd && beep(1100, 300)
          return begin('work', p.round + 1)
        })
      }, 1000)
      return () => clearInterval(id)
    }, [s.running])

    const start = () => {
      beep(880, 60) // unlock audio on user gesture
      setS(s.phase === 'idle' || s.phase === 'done' ? begin(prep > 0 ? 'prep' : 'work', 1) : { ...s, running: true })
    }
    const reset = () => setS({ phase: 'idle', left: 0, round: 1, running: false })

    const total = c.rounds * (c.work + c.rest) - c.rest
    const style = {
      idle: ['bg-base-200', 'Ready'],
      prep: ['bg-warning/30', 'Get ready'],
      work: ['bg-success/30', 'WORK'],
      rest: ['bg-info/30', 'REST'],
      done: ['bg-primary/30', 'Done!'],
    }[s.phase]

    return (
      <div class={`flex flex-col items-center justify-center h-full gap-2 rounded-box p-2 transition-colors ${style[0]}`}>
        <div class="text-lg font-bold tracking-widest">{style[1]}</div>
        <div class="text-5xl font-mono font-bold tabular-nums">{s.phase === 'idle' ? mmss(c.work) : s.phase === 'done' ? '✓' : mmss(s.left)}</div>
        <div class="text-sm opacity-70">Round {Math.min(s.round, c.rounds)} / {c.rounds}</div>
        <div class="flex gap-2">
          {s.running ? (
            <button class="btn btn-sm btn-warning" onClick={() => setS({ ...s, running: false })}>Pause</button>
          ) : (
            <button class="btn btn-sm btn-primary" onClick={start}>{s.phase === 'idle' || s.phase === 'done' ? 'Start' : 'Resume'}</button>
          )}
          <button class="btn btn-sm btn-ghost" onClick={reset}>Reset</button>
        </div>
        <div class="text-xs opacity-50">{c.work}s on / {c.rest}s off · {mmss(Math.max(0, total))} total</div>
      </div>
    )
  },
  Options({ config, set }) {
    return (
      <div class="grid grid-cols-2 gap-2">
        <Num label="Get-ready (s)" min={0} value={config.prepare ?? 10} onChange={(v) => set({ prepare: v })} />
        <Num label="Rounds" max={99} value={config.rounds} onChange={(v) => set({ rounds: v })} />
        <Num label="Work (s)" value={config.work} onChange={(v) => set({ work: v })} />
        <Num label="Rest (s)" min={0} value={config.rest} onChange={(v) => set({ rest: v })} />
        <label class="label cursor-pointer justify-start gap-2 col-span-2"><input type="checkbox" class="checkbox checkbox-sm" checked={!!config.sound} onChange={(e) => set({ sound: e.target.checked })} /><span class="label-text">Beeps</span></label>
      </div>
    )
  },
}

export default tabata
