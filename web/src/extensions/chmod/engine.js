// Unix permissions for the launcher: octal <-> symbolic, chmod clauses, and umask. Pure; unit tested in engine.test.js.
//
//   chmod 755 | chmod rwxr-xr-x | chmod -rw-r--r-- | chmod 644 u+x,g+w | chmod u=rwx,go=rx
//   umask 022

/** { word, text } for "chmod …", "perm …", "umask …", or null. */
export function parseChmodCommand(q) {
  const m = /^\s*(chmod|perm|umask)(?:[ \t]+([\s\S]*))?$/i.exec(q || '')
  return m ? { word: m[1].toLowerCase(), text: (m[2] || '').trim() } : null
}

// bit masks per class
const CLASS = {
  u: { r: 0o400, w: 0o200, x: 0o100, s: 0o4000 },
  g: { r: 0o040, w: 0o020, x: 0o010, s: 0o2000 },
  o: { r: 0o004, w: 0o002, x: 0o001, s: 0 },
}
const STICKY = 0o1000
const SHIFT = { u: 6, g: 3, o: 0 }

/** "rwxr-xr-x" (or with a leading file type, or s/S/t/T) -> mode number, or null. */
export function fromSymbolic(s) {
  let t = String(s).trim()
  if (/^[-dlcbps][-rwxsStT]{9}$/.test(t)) t = t.slice(1)
  if (!/^[-r][-w][-xsS][-r][-w][-xsS][-r][-w][-xtT]$/.test(t)) return null
  let mode = 0
  const cls = ['u', 'g', 'o']
  for (let i = 0; i < 3; i++) {
    const [r, w, x] = t.slice(i * 3, i * 3 + 3)
    const c = CLASS[cls[i]]
    if (r === 'r') mode |= c.r
    if (w === 'w') mode |= c.w
    if (x === 'x' || x === 's' || x === 't') mode |= c.x
    if (x === 's' || x === 'S') mode |= c.s
    if (x === 't' || x === 'T') mode |= STICKY
  }
  return mode
}

/** Mode number -> "rwxr-xr-x", with s/S/t/T for setuid, setgid and sticky. */
export function toSymbolic(mode) {
  const out = []
  for (const k of ['u', 'g', 'o']) {
    const c = CLASS[k]
    let x = mode & c.x ? 'x' : '-'
    if (k !== 'o' && mode & c.s) x = x === 'x' ? 's' : 'S'
    if (k === 'o' && mode & STICKY) x = x === 'x' ? 't' : 'T'
    out.push(mode & c.r ? 'r' : '-', mode & c.w ? 'w' : '-', x)
  }
  return out.join('')
}

/** Mode number -> "755" (or "4755" when a special bit is set). */
export const toOctal = (mode) => (mode & 0o7000 ? mode.toString(8).padStart(4, '0') : (mode & 0o777).toString(8).padStart(3, '0'))

/** "755" / "0644" / "4755" -> mode number, or null. */
export const fromOctal = (s) => (/^[0-7]{3,4}$/.test(String(s).trim()) ? parseInt(s, 8) : null)

/**
 * Applies symbolic clauses such as "u+x,g-w,o=r" or "a+rX" to a mode. No umask is applied: an empty "who" means all.
 * Returns the new mode, or null when a clause is malformed.
 */
export function applySymbolic(mode, spec) {
  let m = mode
  for (const clause of String(spec).split(',')) {
    const c = /^([ugoa]*)([-+=])([rwxXst]*|[ugo])$/.exec(clause.trim())
    if (!c) return null
    const who = [...new Set(c[1] ? (c[1].includes('a') ? ['u', 'g', 'o'] : [...c[1]]) : ['u', 'g', 'o'])]
    const op = c[2]
    const perms = c[3]
    let add = 0
    let clear = 0
    for (const k of who) clear |= CLASS[k].r | CLASS[k].w | CLASS[k].x | CLASS[k].s
    if (who.includes('o') || c[1] === '' || c[1].includes('a')) clear |= STICKY
    if (/^[ugo]$/.test(perms)) {
      const from = (m >> SHIFT[perms]) & 7
      for (const k of who) add |= from << SHIFT[k]
    } else {
      for (const p of perms) {
        if (p === 'X') { if (m & 0o111) for (const k of who) add |= CLASS[k].x }
        else if (p === 's') { for (const k of who) add |= CLASS[k].s }
        else if (p === 't') add |= STICKY
        else for (const k of who) add |= CLASS[k][p]
      }
    }
    if (op === '+') m |= add
    else if (op === '-') m &= ~add
    else m = (m & ~clear) | add
  }
  return m
}

/**
 * Reads the argument of "chmod …": an octal mode, a symbolic string, or clauses, optionally a mode first and clauses after.
 * Returns { ok, mode } or { ok: false, error }.
 */
export function parseMode(text) {
  const tokens = String(text).trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return { ok: true, mode: 0o644, empty: true }
  let mode = 0
  let rest = tokens
  const first = fromOctal(tokens[0]) ?? fromSymbolic(tokens[0])
  if (first !== null) { mode = first; rest = tokens.slice(1) }
  for (const t of rest) {
    const next = applySymbolic(mode, t)
    if (next === null) return { ok: false, error: `Cannot read "${t}" as a permission` }
    mode = next
  }
  if (first === null && !rest.length) return { ok: false, error: `Cannot read "${tokens[0]}" as a permission` }
  return { ok: true, mode }
}

const WORDS = ['no access', 'execute only', 'write only', 'write and execute', 'read only', 'read and execute', 'read and write', 'read, write and execute']

/** Plain-English lines for a mode: [['Owner', 'read, write and execute'], ...] plus any special bits. */
export function describeMode(mode) {
  const lines = [
    ['Owner', WORDS[(mode >> 6) & 7]],
    ['Group', WORDS[(mode >> 3) & 7]],
    ['Everyone else', WORDS[mode & 7]],
  ]
  const special = []
  if (mode & 0o4000) special.push('setuid: runs as the file owner')
  if (mode & 0o2000) special.push('setgid: runs as the file group (or new files inherit the directory group)')
  if (mode & STICKY) special.push('sticky: only owners can delete files in the directory')
  return { lines, special }
}

const KNOWN = {
  '644': 'the usual mode for a file',
  '755': 'the usual mode for a program or directory',
  '600': 'private: only the owner can read and write',
  '700': 'private: only the owner has access',
  '664': 'group-writable file',
  '775': 'group-writable program or directory',
  '640': 'owner writes, group reads',
  '750': 'owner full, group reads and enters',
  '400': 'read-only for the owner',
  '444': 'read-only for everyone',
  '777': 'anyone can change it: rarely a good idea',
  '666': 'anyone can write it: rarely a good idea',
}

/** A short hint for well-known modes, or ''. */
export const knownMode = (mode) => KNOWN[toOctal(mode)] || ''

/** "022" -> { umask, file, dir }: the permissions new files (666) and directories (777) get. Null when invalid. */
export function fromUmask(text) {
  const m = /^0?([0-7]{3})$/.exec(String(text).trim())
  if (!m) return null
  const u = parseInt(m[1], 8)
  return { umask: m[1], file: 0o666 & ~u, dir: 0o777 & ~u }
}

/** The launcher text that reopens a mode. */
export const chmodFill = (text) => `chmod ${text}`.trim()
