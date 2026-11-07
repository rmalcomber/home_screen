// Measures the shipped binary and the code base and writes docs/src/data/metrics.json.
// The docs use these values through {{metric:key}} tokens, so the numbers on the site are never typed by hand.
//
//   npm run metrics                  static numbers (sizes, counts, tests: runs the Vitest suite)
//   npm run metrics -- --runtime     also start the exe and measure start-up time and idle memory
//   npm run metrics -- --build       also time a clean `cargo build --release` in a temporary target directory
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { tmpdir, platform, cpus, totalmem } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const dataFile = resolve(here, '../src/data/metrics.json')
const WIN = process.platform === 'win32'
const EXE = process.env.HOME_SCREEN_EXE || join(root, 'target', 'release', WIN ? 'home_screen.exe' : 'home_screen')
const args = new Set(process.argv.slice(2))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let prev = {}
try { prev = JSON.parse(readFileSync(dataFile, 'utf8')) } catch {}
const m = { ...prev }

const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`)
const read = (p) => readFileSync(p, 'utf8')
const walk = (dir, filter, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!['node_modules', 'dist', 'target', '.git'].includes(e.name)) walk(p, filter, out) } else if (filter(p)) out.push(p)
  }
  return out
}
const lines = (files) => files.reduce((n, f) => n + read(f).split('\n').length, 0)

// ---- the binary
if (!existsSync(EXE)) throw new Error(`Build the app first (.\\build.ps1): ${EXE} not found`)
const exe = readFileSync(EXE)
m.exe_bytes = exe.length
m.exe_bytes_fmt = exe.length.toLocaleString('en-GB')
m.exe_size = fmtBytes(exe.length)
m.exe_gzip = fmtBytes(gzipSync(exe, { level: 9 }).length)

// ---- the embedded web app
const assets = join(root, 'web', 'dist', 'assets')
const sizes = { js: [0, 0], css: [0, 0] }
for (const f of readdirSync(assets)) {
  const ext = f.endsWith('.js') ? 'js' : f.endsWith('.css') ? 'css' : null
  if (!ext) continue
  const buf = readFileSync(join(assets, f))
  sizes[ext][0] += buf.length
  sizes[ext][1] += gzipSync(buf, { level: 9 }).length
}
m.js_size = fmtBytes(sizes.js[0])
m.js_gzip = fmtBytes(sizes.js[1])
m.css_size = fmtBytes(sizes.css[0])
m.css_gzip = fmtBytes(sizes.css[1])

// ---- dependencies and code
const lock = read(join(root, 'Cargo.lock'))
m.crates = (lock.match(/^\[\[package\]\]/gm) || []).length - 1 // minus the app itself
const cargo = read(join(root, 'Cargo.toml'))
m.direct_deps = (cargo.split(/^\[dependencies\]/m)[1].split(/^\[/m)[0].match(/^[a-z][\w-]*\s*=/gm) || []).length
m.runtime_npm = Object.keys(JSON.parse(read(join(root, 'web', 'package.json'))).dependencies).length
const rs = walk(join(root, 'src'), (p) => p.endsWith('.rs'))
const web = walk(join(root, 'web', 'src'), (p) => /\.(jsx?|css)$/.test(p))
const tests = web.filter((p) => /\.test\.jsx?$/.test(p))
m.rust_loc = lines(rs)
m.web_loc = lines(web.filter((p) => !tests.includes(p)))
m.test_loc = lines(tests)
m.rust_tests = rs.reduce((n, f) => n + (read(f).match(/#\[test\]/g) || []).length, 0)

// ---- widgets and tools (counted from the extension manifests, not remembered)
const extDir = join(root, 'web', 'src', 'extensions')
const manifests = []
for (const d of readdirSync(extDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  manifests.push((await import(pathToFileURL(join(extDir, d.name, 'manifest.js')).href)).default)
}
m.extensions = manifests.length
m.widgets = manifests.reduce((n, e) => n + (e.widgets || []).length, 0)
// A launcher tool is each extension tool; the calculator extension counts three (maths, units, currency).
m.tools = manifests.filter((e) => e.tool).reduce((n, e) => n + Math.max(1, (e.widgets || []).filter((w) => w.host).length), 0)
m.launcher_features = m.tools + 2 // plus search and commands

// ---- tests (runs the real suite)
if (!args.has('--skip-tests')) {
  const out = join(tmpdir(), 'hs-vitest.json')
  spawnSync(WIN ? 'npx.cmd' : 'npx', ['vitest', 'run', '--reporter=json', `--outputFile=${out}`], { cwd: join(root, 'web'), stdio: 'ignore', shell: WIN })
  const r = JSON.parse(readFileSync(out, 'utf8'))
  m.web_tests = r.numTotalTests
  m.web_tests_passed = r.numPassedTests
  m.test_files = r.numTotalTestSuites
}
m.tests_total = (m.web_tests ?? 0) + m.rust_tests

// ---- runtime: start-up time and idle memory
if (args.has('--runtime')) {
  const dir = mkdtempSync(join(tmpdir(), 'hs-metrics-'))
  const port = 7992
  const t0 = performance.now()
  const child = spawn(EXE, ['--port', String(port), '--db', join(dir, 'm.db')], { stdio: 'ignore' })
  let ready = 0
  for (let i = 0; i < 200 && !ready; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/api/tiles`)).ok) ready = performance.now() - t0 } catch {}
    if (!ready) await sleep(5)
  }
  m.startup_ms = Math.round(ready)
  m.startup = `${Math.round(ready)} ms`
  for (let i = 0; i < 20; i++) { await fetch(`http://127.0.0.1:${port}/`); await fetch(`http://127.0.0.1:${port}/api/tiles`) }
  await sleep(1500)
  const rssBytes = WIN
    ? Number(execFileSync('powershell', ['-NoProfile', '-Command', `(Get-Process -Id ${child.pid}).WorkingSet64`]).toString().trim())
    : Number(execFileSync('ps', ['-o', 'rss=', '-p', String(child.pid)]).toString().trim()) * 1024
  m.idle_memory = `${(rssBytes / 1048576).toFixed(1)} MB`
  child.kill()
  await sleep(200)
  rmSync(dir, { recursive: true, force: true })
}

// ---- a clean release build, in a throw-away target directory so your own target/ is untouched
if (args.has('--build')) {
  const target = mkdtempSync(join(tmpdir(), 'hs-build-'))
  const t0 = performance.now()
  execFileSync('cargo', ['build', '--release'], { cwd: root, env: { ...process.env, CARGO_TARGET_DIR: target }, stdio: 'ignore' })
  const s = Math.round((performance.now() - t0) / 1000)
  m.build_seconds = s
  m.build_seconds = s
  rmSync(target, { recursive: true, force: true })
}

if (m.build_seconds) m.build_time = m.build_seconds < 60 ? `${m.build_seconds} seconds` : `${Math.floor(m.build_seconds / 60)} min ${String(m.build_seconds % 60).padStart(2, '0')} s`
m.measured = new Date().toISOString().slice(0, 10)
m.machine = `${platform()} · ${cpus().length} logical CPUs · ${(totalmem() / 2 ** 30).toFixed(0)} GB RAM`
mkdirSync(dirname(dataFile), { recursive: true })
writeFileSync(dataFile, JSON.stringify(m, null, 2) + '\n')
console.log(JSON.stringify(m, null, 2))
