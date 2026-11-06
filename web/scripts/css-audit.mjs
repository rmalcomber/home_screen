// Guards the `exclude:` list in src/style.css. daisyUI emits CSS for every component unless told otherwise, so the
// list drops the ones no screen uses. This checks that no class used in the source belongs to a dropped component.
//
//   node scripts/css-audit.mjs        (after `npm run build`)
//
// A "used class" is any whitespace-separated word inside a string or template literal in src/**/*.js(x). Plain words
// that happen to match a daisyUI class name (a widget called "countdown", a variable called "list") are listed in
// IGNORE with the reason; anything else found is a real regression and the script exits with an error.
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const IGNORE = {
  countdown: 'widget kind and CSS-free word',
  diff: 'tool kind',
  carousel: 'widget kind',
  collapse: 'verb used in titles and command names',
  list: 'JS identifier and Tailwind list-none',
  steps: 'word in tool text',
  step: 'cron item type',
  toggle: 'word in code',
  filter: 'word in code',
  progress: 'word in code',
  mask: 'word in code',
  stack: 'word in code',
  glass: 'settings key (the tile-glass class is our own)',
  hero: 'word in code',
  footer: 'word in code',
  drawer: 'word in code',
  typography: 'word in code',
}

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]))
const css = readFileSync(join(root, 'dist/assets', readdirSync(join(root, 'dist/assets')).find((f) => f.endsWith('.css'))), 'utf8')
const built = new Set([...css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]))

let strings = readFileSync(join(root, 'index.html'), 'utf8')
for (const f of walk(join(root, 'src')).filter((f) => /\.jsx?$/.test(f) && !/test/.test(f))) {
  const s = readFileSync(f, 'utf8')
  for (const m of s.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)) strings += ' ' + (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ')
}
const used = new Set(strings.split(/\s+/).filter(Boolean))

const dropped = []
for (const dir of ['components', 'utilities']) {
  const base = join(root, 'node_modules/daisyui', dir)
  for (const f of readdirSync(base).filter((n) => n.endsWith('.css'))) {
    const defined = new Set([...readFileSync(join(base, f), 'utf8').matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]))
    for (const c of defined) if (!built.has(c) && used.has(c) && !/^(sm|md|lg|xl|xs|w3|org)$/.test(c)) dropped.push([f.replace('.css', ''), c])
  }
}

const real = dropped.filter(([, c]) => !IGNORE[c])
const ignored = dropped.filter(([, c]) => IGNORE[c])
console.log(`built CSS has ${built.size} class selectors; ${ignored.length} plain words ignored (see IGNORE)`)
if (real.length) {
  console.error('\nClasses used in the source but dropped by the daisyUI exclude list:')
  for (const [comp, c] of real) console.error(`  .${c}  (component: ${comp})`)
  process.exit(1)
}
console.log('ok: every daisyUI class used in the source is still in the build')
