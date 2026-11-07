import { Fragment } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { useHotkeyScope, remember, CopyButton, copyText } from '../../core/extensions/host.js'
import { toOctal, toSymbolic, fromOctal, describeMode, knownMode } from './engine.js'

const CLASSES = [['Owner', 6], ['Group', 3], ['Others', 0]]
const BITS = [['Read', 4], ['Write', 2], ['Execute', 1]]
const SPECIAL = [['setuid', 0o4000], ['setgid', 0o2000], ['sticky', 0o1000]]

/** An editor for Unix permissions: tick boxes, or type the octal, and copy the result. */
export function ChmodPanel({ item }) {
  const start = item.data
  const [mode, setMode] = useState(start.ok ? start.mode : 0o644)
  const [octal, setOctal] = useState(toOctal(start.ok ? start.mode : 0o644))
  const [file, setFile] = useState('file')

  const apply = (m) => {
    setMode(m)
    setOctal(toOctal(m))
  }
  const toggle = (mask) => apply(mode ^ mask)
  const typed = (v) => {
    setOctal(v)
    const m = fromOctal(v)
    if (m !== null) setMode(m)
  }
  const command = `chmod ${toOctal(mode)} ${file || 'file'}`
  const d = describeMode(mode)
  const hint = knownMode(mode)

  const remembered = () => remember('chmod', { key: `chmod:${toOctal(mode)}`, title: `chmod ${toOctal(mode)}`, subtitle: toSymbolic(mode), fill: `chmod ${toOctal(mode)}` })
  const copyCommand = async () => {
    if (await copyText(command)) remembered()
  }
  const onKeydown = useHotkeyScope()
  useEffect(() => {
    const h = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); copyCommand() } }
    return onKeydown(h)
  })

  return (
    <div class="p-3 grid gap-3 max-h-[70vh] overflow-auto">
      {!start.ok && <p class="text-sm text-warning">{start.error}. Showing 644; use the boxes or type a mode.</p>}
      <div class="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-x-4 gap-y-1 items-center text-sm w-fit">
        <span />
        {BITS.map(([label]) => <span key={label} class="text-xs opacity-60">{label}</span>)}
        {CLASSES.map(([name, shift]) => (
          <Fragment key={name}>
            <span class="font-semibold">{name}</span>
            {BITS.map(([label, bit]) => (
              <input key={name + label} type="checkbox" class="checkbox checkbox-sm" aria-label={`${name} ${label}`} checked={!!(mode & (bit << shift))} onChange={() => toggle(bit << shift)} />
            ))}
          </Fragment>
        ))}
      </div>
      <div class="flex flex-wrap gap-3">
        {SPECIAL.map(([label, mask]) => (
          <label key={label} class="label cursor-pointer gap-1 p-0">
            <input type="checkbox" class="checkbox checkbox-xs" checked={!!(mode & mask)} onChange={() => toggle(mask)} />
            <span class="label-text text-xs">{label}</span>
          </label>
        ))}
      </div>

      <div class="grid gap-2 sm:grid-cols-2">
        <label class="grid gap-1 text-xs">Octal
          <input class="input input-sm input-bordered font-mono w-28" value={octal} onInput={(e) => typed(e.target.value)} spellcheck={false} />
        </label>
        <div class="grid gap-1 text-xs">Symbolic
          <div class="flex items-center gap-2">
            <code class="font-mono text-sm">{toSymbolic(mode)}</code>
            <CopyButton text={toSymbolic(mode)} />
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <code class="font-mono text-sm">chmod {toOctal(mode)}</code>
        <input class="input input-xs input-bordered w-32 font-mono" value={file} onInput={(e) => setFile(e.target.value)} aria-label="File name" spellcheck={false} />
        <CopyButton text={command} label="Copy command" class="btn btn-primary btn-sm" onCopied={remembered} />
        <kbd class="kbd kbd-xs">Ctrl ⏎</kbd>
      </div>

      <ul class="text-sm grid gap-0.5">
        {d.lines.map(([who, what]) => <li key={who}><span class="font-semibold">{who}:</span> {what}</li>)}
        {d.special.map((s) => <li key={s} class="text-warning">{s}</li>)}
        {hint && <li class="opacity-70 mt-1">{toOctal(mode)} is {hint}.</li>}
      </ul>
    </div>
  )
}
