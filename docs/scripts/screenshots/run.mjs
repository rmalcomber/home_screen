// Regenerates every documentation image: starts the release exe with a throw-away database, fills it with the fictional
// "Acme" workspace (demo.mjs), drives the app in the installed Chrome with puppeteer-core, and converts the PNGs to WebP.
//
//   npm run screenshots                      (needs target/release/home_screen[.exe], Chrome, ImageMagick, internet)
//   CHROME_PATH=... HOME_SCREEN_EXE=... npm run screenshots
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { TILES, BOOKMARKS_HTML, COLORS, TEAM_BOARD } from './demo.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const OUT = resolve(here, '../../src/assets/screenshots')
const PUBLIC = resolve(here, '../../public')
const TMP = join(tmpdir(), 'home-screen-docs-shots')
const PNG = join(TMP, 'png')
const PORT = 7991
const BASE = `http://127.0.0.1:${PORT}`
const WIN = process.platform === 'win32'
const EXE = process.env.HOME_SCREEN_EXE || join(root, 'target', 'release', WIN ? 'home_screen.exe' : 'home_screen')
const CHROME = process.env.CHROME_PATH || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(existsSync)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!existsSync(EXE)) throw new Error(`Build the app first (.\\build.ps1): ${EXE} not found`)
if (!CHROME) throw new Error('Chrome not found: set CHROME_PATH')
rmSync(TMP, { recursive: true, force: true })
mkdirSync(PNG, { recursive: true })
mkdirSync(OUT, { recursive: true })

// ------------------------------------------------------------------ server + seed
const server = spawn(EXE, ['--port', String(PORT), '--db', join(TMP, 'demo.db')], { stdio: 'ignore' })
process.on('exit', () => server.kill())
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(`${BASE}/api/tiles`)).ok) break } catch {}
  await sleep(100)
}

const api = async (method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`)
  return r.status === 204 ? null : r.json()
}

// abstract backgrounds and "photos" (deterministic: fixed plasma seeds)
const magick = (...args) => execFileSync('magick', args, { stdio: 'ignore' })
const img = (name, w, h, seed, mod) => { const f = join(TMP, name); magick('-seed', String(seed), '-size', `${w}x${h}`, 'plasma:fractal', '-blur', '0x22', '-modulate', mod, '-quality', '70', f); return f }
const upload = async (file, name) => {
  const r = await fetch(`${BASE}/api/images?name=${name}`, { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: readFileSync(file) })
  return (await r.json()).src
}
const bg = await upload(img('bg.webp', 1600, 1000, 11, '36,65,100'), 'background')
const photos = []
for (const [i, seed] of [21, 34, 55].entries()) photos.push(await upload(img(`p${i}.webp`, 800, 600, seed, '80,55,100'), `photo${i}`))

async function geocode(city) {
  const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)).json()
  const g = j.results?.[0]
  if (!g) throw new Error(`geocode failed for ${city}`)
  return { city, name: g.name, country: g.country_code, lat: g.latitude, lon: g.longitude }
}

const layout = []
const ids = {}
for (const { key, x, y, w, h, tile } of TILES) {
  const t = structuredClone(tile)
  if (t.config.kind === 'weather') t.config.locations = await Promise.all(t.config.locations.map((l) => geocode(l.city)))
  if (t.config.kind === 'carousel') t.config.images = photos
  if (t.config.kind === 'colorpicker') t.config.alpha = 1
  const created = await api('POST', '/api/tiles', { ...t, x, y, w, h, color: COLORS[key] ?? null })
  ids[key] = created.id
  layout.push({ id: created.id, x, y, w, h, collapsed: false })
}
await api('PUT', '/api/layout', layout)
// page two: three equal columns of coloured groups (the layout is applied by the app, so only the order matters here)
const board = await api('POST', '/api/pages', TEAM_BOARD.page)
const boardLayout = []
for (const [i, g] of TEAM_BOARD.groups.entries()) {
  const grp = await api('POST', '/api/tiles', { type: 'group', title: g.title, icon: g.icon, color: g.color, config: {}, x: i * 4, y: 0, w: 4, h: 20, page_id: board.id })
  boardLayout.push({ id: grp.id, x: i * 4, y: 0, w: 4, h: 20, collapsed: false, parent_id: null, page_id: board.id })
  let y = 0
  for (const c of g.children) {
    const t = await api('POST', '/api/tiles', { ...c, x: 0, y, w: 4, h: c.h, page_id: board.id, parent_id: grp.id })
    boardLayout.push({ id: t.id, x: 0, y, w: 4, h: c.h, collapsed: false, parent_id: grp.id, page_id: board.id })
    y += c.h
  }
}
await api('PUT', '/api/layout', boardLayout)
await api('PUT', '/api/settings', { bgImage: bg, glass: 38, autoHideBar: false })

// ------------------------------------------------------------------ browser
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, args: ['--no-first-run', '--disable-extensions', '--hide-scrollbars'] })
const page = await browser.newPage()

// launcher history so the "Recent" list has something real in it
const HISTORY = {
  'launcher.recent': ['calc:(1299*12)/100', 'cron:*/15 9-17 * * 1-5', 'hash:sha256:Hello, Acme!', 'qr:acme', 'regex:/(?<user>[\\w.]+)@(?<host>[\\w.]+)/g', 'ts:1700000000 in Asia/Tokyo'],
  'launcher.calcHistory': [{ expr: '(1299*12)/100', text: '155.88', label: undefined }],
  'launcher.history.cron': [{ key: 'cron:*/15 9-17 * * 1-5', title: 'cron */15 9-17 * * 1-5', subtitle: 'Every 15 minutes, between 09:00 and 17:59, on Monday through Friday', fill: 'cron */15 9-17 * * 1-5' }],
  'launcher.history.hash': [{ key: 'hash:sha256:Hello, Acme!', title: 'SHA-256 of "Hello, Acme!"', subtitle: '6a8b1d0f3c52e4a9b7d1…', fill: 'sha256 Hello, Acme!' }],
  'launcher.history.qr': [{ key: 'qr:acme', title: 'QR · https://acme.dev/status', subtitle: 'error correction M', fill: 'qr https://acme.dev/status' }],
  'launcher.history.regex': [{ key: 'regex:/(?<user>[\\w.]+)@(?<host>[\\w.]+)/g', title: '/(?<user>[\\w.]+)@(?<host>[\\w.]+)/g', subtitle: 'alice@example.com, bob@acme.dev', fill: 're /(?<user>[\\w.]+)@(?<host>[\\w.]+)/g alice@example.com' }],
  'launcher.history.ts': [{ key: 'ts:1700000000 in Asia/Tokyo', title: 'Timestamp · 1700000000 in Asia/Tokyo', subtitle: '2023-11-14T22:13:20.000Z', fill: 'ts 1700000000 in Asia/Tokyo' }],
}
await page.evaluateOnNewDocument((h) => { for (const [k, v] of Object.entries(h)) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} } }, HISTORY)

const shots = []
const png = (name) => join(PNG, `${name}.png`)
const snap = async (name, target) => { await target.screenshot({ path: png(name) }); shots.push(name); console.log('  shot', name) }
const goHome = async () => { await page.goto(BASE, { waitUntil: 'networkidle2' }); await sleep(1800) } // icons, favicons, weather
const setNative = (sel, value) => page.evaluate((s, v) => { const el = document.querySelector(s); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }, sel, value)
const clickText = (sel, text) => page.evaluate((s, t) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim().startsWith(t)); if (!el) throw new Error(`no ${s} "${t}"`); el.click() }, sel, text)
const box = async (pad = 14) => {
  const b = await (await page.$('dialog .modal-box')).boundingBox()
  const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad)
  return { x, y, width: Math.min(1440 - x, b.width + pad * 2), height: Math.min(900 - y, b.height + pad * 2) }
}
const openLauncher = async (text = '', wait = 700) => {
  await page.keyboard.down('Control'); await page.keyboard.press('KeyP'); await page.keyboard.up('Control')
  await page.waitForSelector('dialog textarea')
  if (text) await setNative('dialog textarea', text)
  await sleep(wait)
}
const closeDialog = async () => { await page.keyboard.press('Escape'); await sleep(300) }
const tool = async (name, text, { wait = 800, before } = {}) => {
  await openLauncher(text, wait)
  if (before) await before()
  await snap(name, { screenshot: async ({ path }) => page.screenshot({ path, clip: await box() }) })
  await closeDialog()
}
const tile = (key) => page.$(`[data-tile-id="${ids[key]}"]`)
const tileShot = async (name, key, wait = 400) => { await sleep(wait); const el = await tile(key); const b = await el.boundingBox(); await snap(name, { screenshot: async ({ path }) => page.screenshot({ path, clip: { x: Math.max(0, b.x - 6), y: Math.max(0, b.y - 6), width: b.width + 12, height: b.height + 12 } }) }) }

console.log('Dashboard')
await goHome()
await snap('dashboard-hero', page)

await setNative('input[placeholder^="Search tiles"]', 'prod')
await sleep(500)
await snap('dashboard-search', page)
await setNative('input[placeholder^="Search tiles"]', '')

// the editor, widget picker, settings and import dialogs
await page.evaluate((id) => document.querySelector(`[data-tile-id="${id}"] button[title="Edit tile"]`).click(), ids.services)
await page.waitForSelector('dialog .modal-box'); await sleep(900)
await snap('tile-editor-dev', { screenshot: async ({ path }) => page.screenshot({ path, clip: await box(10) }) })
await closeDialog()

const menu = async (item) => { await page.focus('button[aria-label=Menu]'); await sleep(150); await clickText('.dropdown-content button', item); await page.waitForSelector('dialog .modal-box'); await sleep(600) }
await menu('＋ Add tile'); await clickText('dialog form button', 'Widget'); await sleep(900)
await clickText('dialog [role=tab]', 'Security'); await sleep(500)
await snap('add-tile-widget-picker', { screenshot: async ({ path }) => page.screenshot({ path, clip: await box(10) }) })
await closeDialog()

await menu('Settings'); await snap('settings', { screenshot: async ({ path }) => page.screenshot({ path, clip: await box(10) }) }); await closeDialog()

await goHome()
await menu('Import Bookmarks')
const file = join(TMP, 'bookmarks.html'); writeFileSync(file, BOOKMARKS_HTML)
await (await page.$('dialog input[type=file]')).uploadFile(file); await sleep(800)
await page.evaluate(() => { const s = [...document.querySelectorAll('dialog table select')]; const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })) }; if (s[0]) set(s[0], s[0].options[1].value); if (s[1]) set(s[1], s[1].options[1].value) })
await sleep(500)
await snap('import-bookmarks', { screenshot: async ({ path }) => page.screenshot({ path, clip: await box(10) }) })
await closeDialog()

console.log('Launcher')
await goHome()
await openLauncher('', 600)
await snap('launcher-recent', { screenshot: async ({ path }) => page.screenshot({ path, clip: await box() }) })
await closeDialog()
await tool('launcher-search', 'billing')
await tool('launcher-commands', '>')
await tool('tool-calculator', '(1299*12)/100')
await tool('tool-units', '72 f to c')
await tool('tool-currency', '250 usd to gbp', { wait: 2500 })
await tool('tool-timestamp', 'ts 1700000000 in Asia/Tokyo')
await tool('tool-curl', `curl ${BASE}/api/settings -H 'accept: application/json'`, { before: async () => { await clickText('dialog button', 'Run'); await sleep(1200) } })
await tool('tool-json', '{"service":"checkout","env":"prod","replicas":3,"regions":["eu-west-1","us-east-1"],"limits":{"cpu":"500m","memory":"512Mi"},"healthy":true}')
await tool('tool-csv', 'csv\nname,role,team,active\nAda,Engineer,Platform,true\nBo,SRE,Infra,true\nCy,Designer,Web,false')
await tool('tool-regex', 'regex /(?<user>[\\w.]+)@(?<host>[\\w.]+)/g\nalice@example.com, bob.smith@acme.dev and carol@mail.test', { wait: 1400 })
await tool('tool-diff', "diff\nconst port = 3000\nconst host = 'localhost'\nstart(port)\n=======\nconst port = 8080\nconst host = 'localhost'\nconst debug = true\nstart(port, { debug })", { wait: 1000 })
await tool('tool-cron', 'cron */15 9-17 * * 1-5')
await tool('tool-markdown', 'md # Release notes\n\nVersion **4.2** is out:\n\n- [x] Faster checkout\n- [ ] New billing page\n\n| Area | Status |\n|:--|--:|\n| API | done |\n| Web | in review |\n\n> Ship it carefully.')
await tool('tool-password', 'password 24')
await tool('tool-hash', 'hash Hello, Acme!')
await tool('tool-base64', 'b64 Hello, Acme!')
await tool('tool-uuid', 'uuid')
{
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
  const token = `${b64({ alg: 'RS256', typ: 'JWT', kid: 'acme-2026' })}.${b64({ iss: 'https://auth.acme.dev', sub: 'user-8841', name: 'Ada Lovelace', email: 'ada@acme.dev', roles: ['admin', 'dev'], iat: exp - 3600 * 24 * 30, exp })}.c2lnbmF0dXJlLXBsYWNlaG9sZGVy`
  await tool('tool-jwt', token)
}
await tool('tool-qr', 'qr https://acme.dev/status')
await tool('tool-colour', 'color #4f9d69')
await tool('tool-lorem', 'lorem 2p')
await tool('tool-url', 'url https://acme.dev/search?q=blue+widgets&page=2&utm_source=newsletter#results')
await tool('tool-yaml', 'yaml {"service":"checkout","replicas":3,"env":{"LOG_LEVEL":"info","REGION":"eu-west-1"},"ports":[80,443]}')
await tool('tool-bases', 'hex ff')
await tool('tool-cidr', 'cidr 10.20.0.0/22')
await tool('tool-chmod', 'chmod 755')
await tool('tool-text-case', 'snake Checkout Service Timeout')
await tool('tool-http-status', 'status 429')
await tool('tool-web-search', 'ddg rust lifetimes')
await tool('tool-og', 'og https://github.com/preactjs/preact', { wait: 600, before: async () => { await clickText('dialog button', 'Fetch'); await sleep(4000) } })
await tool('tool-caniuse', 'caniuse grid', { wait: 5000 })

console.log('Widgets')
await goHome()
await page.evaluate(() => window.scrollTo(0, 0))
await tileShot('widget-clock', 'clock')
await tileShot('widget-clock-list', 'clockList')
await tileShot('widget-weather', 'weather')
await tileShot('widget-weather-list', 'weatherList')
await tileShot('widget-countdown', 'countdown')
await tileShot('widget-tabata', 'tabata')
await tileShot('widget-notes', 'notes')
await tileShot('widget-todo', 'todo')
await tileShot('widget-carousel', 'carousel')
await tileShot('widget-colour-picker', 'colour')
await setNative(`[data-tile-id="${ids.hash}"] textarea`, 'Hello, Acme!'); await sleep(900)
await tileShot('widget-tool-hash', 'hash')
await setNative(`[data-tile-id="${ids.json}"] textarea`, '{"service":"checkout","env":"prod","replicas":3,"healthy":true}'); await sleep(900)
await tileShot('widget-tool-json', 'json')

console.log('Groups, colours, pages and layouts')
await goHome()
{
  // the Layout menu, and the starter templates dialog it opens
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Layout')).focus())
  await sleep(400)
  await snap('layout-menu', { screenshot: async ({ path }) => { const menus = await page.$$('.dropdown-content'); const b = await menus[menus.length - 1].boundingBox(); await page.screenshot({ path, clip: { x: b.x - 120, y: 0, width: b.width + 140, height: Math.min(900, b.y + b.height + 20) } }) } })
  await page.evaluate(() => document.activeElement.blur())
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Layout')).focus())
  await page.evaluate(() => [...[...document.querySelectorAll('.dropdown-content')].pop().querySelectorAll('button')].find((b) => b.textContent.startsWith('Starter templates')).click())
  await page.waitForSelector('dialog .modal-box'); await sleep(500)
  await snap('templates-dialog', { screenshot: async ({ path }) => page.screenshot({ path, clip: await box(10) }) })
  await closeDialog()
}

// the title bar's edit button appears when you point at it
{
  const el = await tile('aws')
  const b = await el.boundingBox()
  // headless Chrome drops :hover when it takes a clipped screenshot, so show the hovered state with a style rule
  const hover = await page.addStyleTag({ content: `[data-tile-id="${ids.aws}"] .edit-btn { opacity: 1 !important }` })
  await sleep(300)
  await snap('tile-hover-edit', { screenshot: async ({ path }) => page.screenshot({ path, clip: { x: Math.max(0, b.x - 6), y: Math.max(0, b.y - 6), width: b.width + 12, height: 120 } }) })
  await page.evaluate((el) => el.remove(), hover)
}

// page two in columns mode
await page.evaluate((id) => localStorage.setItem('hs.page', String(id)), board.id)
await goHome()
await snap('groups-board', page)
{
  // editing a group: its colour palette
  const gid = (await api('GET', '/api/tiles')).find((t) => t.type === 'group' && t.title === 'Platform').id
  await page.evaluate((id) => document.querySelector(`[data-tile-id="${id}"] button[title="Edit group"]`).click(), gid)
  await page.waitForSelector('dialog .modal-box'); await sleep(700)
  await snap('group-editor', { screenshot: async ({ path }) => page.screenshot({ path, clip: await box(10) }) })
  await closeDialog()
}

// a new, empty page: the welcome screen with starter templates
{
  const blank = await api('POST', '/api/pages', { name: 'Scratch', mode: 'free', cols: 3 })
  await page.evaluate((id) => localStorage.setItem('hs.page', String(id)), blank.id)
  await goHome()
  await snap('welcome-templates', page)
  await api('DELETE', `/api/pages/${blank.id}`)
  await page.evaluate(() => localStorage.setItem('hs.page', '1'))
}

// social card for link previews (JPEG: chat apps and crawlers don't reliably accept WebP)
console.log('Social card')
const hero = readFileSync(png('dashboard-hero')).toString('base64')
const card = await browser.newPage()
await card.setViewport({ width: 1200, height: 630 })
await card.setContent(`<body style="margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#1c2541,#3b2152);font-family:Segoe UI,system-ui,sans-serif;color:#eef3f8;display:flex;overflow:hidden">
<div style="padding:64px;width:520px;display:flex;flex-direction:column;justify-content:center;gap:18px">
<div style="display:flex;align-items:center;gap:14px"><div style="width:56px;height:56px;border-radius:14px;background:#272c36;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 32 32" width="40" height="40"><path d="M16 6.5 5.5 16H9v8h5.2v-6h3.6v6H23v-8h3.5z" fill="#9fe88d"/></svg></div><div style="font-size:44px;font-weight:700">Home Screen</div></div>
<div style="font-size:30px;line-height:1.3;opacity:.92">Your links, tools and widgets on one fast, private start page.</div>
<div style="font-size:22px;color:#9fe88d">One small binary. No accounts. Beta.</div></div>
<img src="data:image/png;base64,${hero}" style="width:900px;margin:90px 0 0 -40px;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.5);align-self:flex-start"></body>`)
await card.screenshot({ path: join(TMP, 'og.png') })
magick(join(TMP, 'og.png'), '-strip', '-quality', '82', join(PUBLIC, 'og.jpg'))
await card.close()

await browser.close()
server.kill()

// ------------------------------------------------------------------ PNG -> WebP
console.log('Converting to WebP')
let total = 0
const rows = []
for (const f of readdirSync(PNG).filter((n) => n.endsWith('.png')).sort()) {
  const out = join(OUT, f.replace(/\.png$/, '.webp'))
  magick(join(PNG, f), '-define', 'webp:method=6', '-quality', '80', out)
  const size = statSync(out).size
  total += size
  rows.push([f.replace('.png', '.webp'), size])
}
for (const [n, s] of rows) console.log(`  ${(s / 1024).toFixed(0).padStart(5)} KB  ${n}`)
console.log(`${rows.length} images, ${(total / 1024).toFixed(0)} KB total`)
