// Where do the bytes in home_screen.exe come from?
//
//   node scripts/size-report.mjs              build (into target/size) and report
//   node scripts/size-report.mjs --no-build   report on the last build
//   node scripts/size-report.mjs --top 40     show more crates
//
// Builds the release exe with the MSVC linker's /MAP output, then attributes every public symbol's size
// (distance to the next symbol in the same section) to the C library it came from, or, for Rust code, to the crate
// in its mangled name. Needs no extra tools. Numbers are approximate (inlined and merged code is credited to the
// crate that owns the symbol), but they are consistent from run to run, which is what a size diet needs.
// The previous run is kept in target/size/last.json and the difference is printed.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const top = Number(args[args.indexOf('--top') + 1]) || 25
const SIZE_DIR = resolve(root, 'target/size')
const TARGET = 'x86_64-pc-windows-msvc'
const EXE = resolve(SIZE_DIR, TARGET, 'release/home_screen.exe')
const MAP = resolve(SIZE_DIR, 'home_screen.map')
const LAST = resolve(SIZE_DIR, 'last.json')
const FLOPPY = 1_474_560

if (!args.includes('--no-build')) {
  mkdirSync(SIZE_DIR, { recursive: true })
  // an explicit --target keeps RUSTFLAGS away from build scripts, which would otherwise all write the same map file
  execFileSync('cargo', ['build', '--release', '--target', TARGET], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CARGO_TARGET_DIR: SIZE_DIR, RUSTFLAGS: `-C link-arg=/MAP:${MAP.replace(/\\/g, '/')}` },
    shell: process.platform === 'win32',
  })
}
if (!existsSync(MAP) || !existsSync(EXE)) throw new Error('No build found: run without --no-build')

const lines = readFileSync(MAP, 'utf8').split(/\r?\n/)

// ---- sections: "0001:00000000 000a2980H .text CODE"
const sections = new Map() // name -> bytes
const secEnd = new Map() // index -> end offset
for (const l of lines) {
  const m = l.match(/^\s*([0-9a-f]{4}):([0-9a-f]{8})\s+([0-9a-f]{8})H\s+(\S+)\s+(CODE|DATA)/i)
  if (!m) continue
  const [, idx, off, len, name] = m
  const size = parseInt(len, 16)
  const base = name.split('$')[0]
  sections.set(base, (sections.get(base) || 0) + size)
  secEnd.set(idx, Math.max(secEnd.get(idx) || 0, parseInt(off, 16) + size))
}

// ---- publics: "0001:00100990   name   0000000140101990 f   lib:obj"
const publics = []
let inPublics = false
for (const l of lines) {
  if (l.includes('Publics by Value')) { inPublics = true; continue }
  if (!inPublics) continue
  const m = l.match(/^\s*([0-9a-f]{4}):([0-9a-f]{8})\s+(\S+)\s+[0-9a-f]{16}\s+(?:[fi]\s+)?(.*)$/i)
  if (!m || m[1] === '0000') continue
  publics.push({ sec: m[1], off: parseInt(m[2], 16), name: m[3], obj: m[4].trim() })
}
publics.sort((a, b) => a.sec.localeCompare(b.sec) || a.off - b.off)

// ---- attribution
/** Crate of a v0-mangled symbol (_R…): follow the path to its root, through nested paths, impls and generics. */
function v0Crate(sym) {
  let i = 2
  const skipDisambiguator = () => { if (sym[i] === 's') { const j = sym.indexOf('_', i); i = j < 0 ? sym.length : j + 1 } }
  const ident = () => {
    if (sym[i] === 'u') i++
    let j = i
    while (sym[j] >= '0' && sym[j] <= '9') j++
    const n = Number(sym.slice(i, j))
    if (!n) return null
    i = j
    if (sym[i] === '_') i++
    return sym.slice(i, i + n)
  }
  const path = (depth = 0) => {
    if (depth > 12) return null
    const c = sym[i++]
    if (c === 'C') { skipDisambiguator(); return ident() }
    if (c === 'N') { i++; return path(depth + 1) }
    if (c === 'M' || c === 'X') { skipDisambiguator(); return path(depth + 1) }
    if (c === 'I') return path(depth + 1)
    return null
  }
  return path()
}

/** First path component of a Rust symbol (v0 `_R…` or legacy `_ZN<len><ident>…`), or null. */
function rustCrate(sym) {
  if (sym.startsWith('_R')) return v0Crate(sym)
  if (!sym.startsWith('_ZN')) return null
  let i = 3
  const len = []
  while (i < sym.length) {
    let j = i
    while (j < sym.length && sym[j] >= '0' && sym[j] <= '9') j++
    if (j === i) break
    const n = Number(sym.slice(i, j))
    len.push(sym.slice(j, j + n))
    i = j + n
  }
  const first = len[0]
  if (!first) return null
  if (first.startsWith('_$LT$')) {
    // <Type as Trait>::method: the crate of the implementing type, after stripping &, [, ( and generics
    const t = first.slice(5).replace(/^(\$RF\$|\$BP\$|\$u5b\$|\$LP\$|mut\$u20\$|dyn\$u20\$)+/, '')
    const seg = t.split(/\.\.|\$/)[0]
    return /^[a-z_][a-z0-9_]*$/i.test(seg) && seg.length > 1 ? seg : 'generic impls (blanket)'
  }
  return /^[a-z_][a-z0-9_]*$/i.test(first) ? first : 'other'
}

function owner(p) {
  const o = p.obj
  if (/sqlite3\.o$/.test(o)) return 'sqlite (C)'
  if (/zstd/i.test(o)) return 'zstd (C, legacy formats included)'
  if (/\.dll$|\.lib:|^(kernel32|ucrt|vcruntime|msvcrt|ntdll|bcrypt|ws2_32|secur32|crypt32)/i.test(o) && !/rcgu/.test(o)) return 'windows imports + CRT'
  if (/rcgu\.o$/.test(o)) {
    const n = p.name
    if (n.startsWith('anon.') || n.startsWith('__xmm@') || n.startsWith('__real@')) return 'rust constants and strings (anon)'
    if (/^\$(ip2state|cppxdata|stateUnwind|unwind|chain|tryMap|handlerMap)/.test(n)) return 'exception tables (SEH)'
    return rustCrate(n) || 'rust (other)'
  }
  return `native: ${o.split(/[\\/]/).pop().replace(/-[0-9a-f]{16}.*$/, '')}`
}

const SQLITE_PARTS = [
  ['fts5', /fts5/i],
  ['fts3/fts4', /fts3|porter|^simple|unicode61|snippet|offsets|matchinfo/i],
  ['rtree + geopoly', /rtree|geopoly/i],
  ['json', /json/i],
  ['dbstat / stat4 / analyze', /dbstat|stat4|analyze|stat_/i],
  ['window functions', /window|nth_|ntile|percent_rank|cume_dist|dense_rank|first_value|last_value|lead|lag/i],
  ['load extension', /loadext|load_ext|extension/i],
  ['alter table', /alter|renametable|rename/i],
  ['triggers', /trigger/i],
  ['vacuum / autovacuum', /vacuum/i],
  ['virtual tables', /vtab|vtable/i],
  ['wal', /wal/i],
  ['date / time', /date|julian/i],
  ['foreign keys', /fkey/i],
  ['everything else (pager, btree, vdbe, parser, functions)', /./],
]
const sqliteParts = new Map()
const bySec = { code: new Map(), data: new Map() }
const add = (map, key, n) => map.set(key, (map.get(key) || 0) + n)
let attributed = 0
for (let i = 0; i < publics.length; i++) {
  const p = publics[i]
  const next = publics[i + 1]
  const end = next && next.sec === p.sec ? next.off : secEnd.get(p.sec) ?? p.off
  const size = Math.max(0, end - p.off)
  if (!size) continue
  const kind = p.sec === '0001' ? 'code' : p.sec === '0002' ? 'data' : null
  if (!kind) continue
  const who = owner(p)
  add(bySec[kind], who, size)
  if (who === 'sqlite (C)') add(sqliteParts, SQLITE_PARTS.find(([, re]) => re.test(p.name))[0], size)
  attributed += size
}

// ---- report
const exe = statSync(EXE).size
const merged = new Map()
for (const m of [bySec.code, bySec.data]) for (const [k, v] of m) add(merged, k, v)
const rows = [...merged].sort((a, b) => b[1] - a[1])
const prev = existsSync(LAST) ? JSON.parse(readFileSync(LAST, 'utf8')) : null
const kb = (n) => (n / 1024).toFixed(1).padStart(8)
const delta = (key, n) => (prev?.crates?.[key] != null ? ` ${n - prev.crates[key] >= 0 ? '+' : ''}${((n - prev.crates[key]) / 1024).toFixed(1)}` : '')

console.log(`\nhome_screen.exe  ${exe.toLocaleString()} bytes  (${(exe / 1024).toFixed(1)} KB)`)
console.log(`floppy limit     ${FLOPPY.toLocaleString()} bytes  -> ${exe <= FLOPPY ? 'FITS' : `${(exe - FLOPPY).toLocaleString()} bytes over (${(((exe - FLOPPY) / exe) * 100).toFixed(0)}% to cut)`}`)
if (prev) console.log(`last run         ${prev.exe.toLocaleString()} bytes  -> ${exe - prev.exe >= 0 ? '+' : ''}${(exe - prev.exe).toLocaleString()} bytes`)
console.log('\nsections:  ' + [...sections].filter(([, n]) => n > 4096).map(([k, n]) => `${k} ${(n / 1024).toFixed(0)} KB`).join('   '))
console.log(`\n${'owner'.padEnd(44)}${'KB'.padStart(8)}  share   change vs last (KB)`)
for (const [k, v] of rows.slice(0, top)) console.log(`${k.padEnd(44)}${kb(v)}  ${((v / attributed) * 100).toFixed(1).padStart(4)}%${delta(k, v)}`)
if (args.includes('--sqlite')) {
  console.log('\nsqlite by feature (approximate, grouped by symbol name)')
  for (const [k, v] of [...sqliteParts].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(56)}${kb(v)}`)
}
const rest = rows.slice(top).reduce((s, [, v]) => s + v, 0)
if (rest) console.log(`${`(${rows.length - top} smaller owners)`.padEnd(44)}${kb(rest)}`)
console.log(`${'attributed'.padEnd(44)}${kb(attributed)}   (the rest of the file is headers, padding, resources and unnamed data)`)

mkdirSync(SIZE_DIR, { recursive: true })
writeFileSync(LAST, JSON.stringify({ exe, crates: Object.fromEntries(rows) }, null, 1))
