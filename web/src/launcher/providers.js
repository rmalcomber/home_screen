// Built-in launcher providers. Register new ones here (or from any module that imports registerProvider).
import { registerProvider } from './registry.js'
import { calculate } from './calc.js'
import { convert } from './convert.js'
import { parseCurl, looksLikeCurl } from './curl.js'
import { CurlPanel } from './CurlPanel.jsx'
import { parseJson, looksLikeJson } from './json.js'
import { encode, decode, parseB64Command } from './base64.js'
import { historyItems, remember as rememberHistory } from './history.js'
import { v4, v7, NIL, forms, parseUuidCommand } from './uuid.js'
import { extractToken, parseJwt } from './jwt.js'
import { digest, parseHashCommand, ALGOS } from './hash.js'
import { parseRegexCommand } from './regex.js'
import { parseColorCommand } from './color.js'
import { generate, toHtml, parseLoremCommand, unitLabel } from './lorem.js'
import { parseTimestampCommand, formatRows } from './timestamp.js'
import { parseDiffCommand } from './diff.js'
import { DiffPanel } from './DiffPanel.jsx'
import { parseCronCommand } from './cron.js'
import { CronPanel } from './CronPanel.jsx'
import { parseCsvCommand } from './csv.js'
import { CsvPanel } from './CsvPanel.jsx'
import { parseMarkdownCommand } from './md.js'
import { MarkdownPanel } from './MarkdownPanel.jsx'
import { parseQrCommand } from './qr.js'
import { QrPanel } from './QrPanel.jsx'
import { parsePasswordCommand, generate as genPassword, pin as genPin, hexToken, urlToken, pools as passwordPools, entropyBits, strengthLabel } from './password.js'
import { ColorPanel } from './ColorPanel.jsx'
import { RegexPanel } from './RegexPanel.jsx'
import { JwtPanel } from './JwtPanel.jsx'
import { JsonPanel } from './JsonPanel.jsx'
import { parseCurrency, convertCurrency, getRates } from './currency.js'
import { tiles, editing, importing, settingsOpen, settings, saveSettings, focusTile, setAllCollapsed } from '../store.js'
import { devServices, ENVS, faviconUrl, parseGithub, githubLinks } from '../util.js'

const open = (url, newTab) => (newTab ? window.open(url, '_blank', 'noopener') : (window.location.href = url))

// Curl runner: paste a curl command to see it organised (params, headers, body), then Enter to run it.
registerProvider({
  id: 'curl',
  name: 'Curl runner',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('curl', 'curl', 'iconify:fa6-solid:terminal') // shows under Recent
    if (!looksLikeCurl(q)) return []
    const data = parseCurl(q)
    return [{ key: 'curl:' + q, title: data.ok ? `${data.method} ${data.url}` : 'curl', kind: 'curl', icon: 'iconify:fa6-solid:terminal', panel: CurlPanel, hint: 'Enter: run', data }]
  },
})

// JSON formatter: paste JSON (or a JS-style object literal) to pretty-print / minify / sort it. Enter copies the result.
registerProvider({
  id: 'json',
  name: 'JSON formatter',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('json', 'JSON', 'iconify:fa6-solid:code')
    if (!looksLikeJson(q)) return []
    const data = parseJson(q)
    // Don't hijack short searches like "[wip]": only show the error view for input that is clearly meant to be JSON.
    const t = q.trim()
    const clearlyJson = t[0] === '{' ? t.includes(':') : /[,\n]/.test(t)
    if (!data.ok && t.length < 30 && !clearlyJson) return []
    return [{ key: 'json:' + q, title: 'Format JSON', kind: 'json', icon: 'iconify:fa6-solid:code', panel: JsonPanel, hint: 'Enter: copy', data }]
  },
})

// Base64: "b64 <text>" encodes (standard + URL-safe) and, when the text is valid base64, decodes. Enter copies the result.
registerProvider({
  id: 'b64',
  name: 'Base64',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('b64', 'Base64', 'iconify:fa6-solid:key')
    const text = parseB64Command(q)
    if (text === null) return []
    const preview = (t) => (t.length > 80 ? t.slice(0, 80) + '…' : t).replace(/\s+/g, ' ')
    const mk = (label, result, copyText) => ({
      key: `b64:${label}:${text}`,
      title: preview(result),
      subtitle: `${label}  ·  Enter to copy`,
      kind: 'Copy',
      recent: false,
      icon: 'iconify:fa6-solid:key',
      run: () => {
        rememberHistory('b64', { key: `b64:${label}:${text.slice(0, 300)}`, title: `b64 ${preview(text)}`, subtitle: label, fill: q.trim() })
        navigator.clipboard?.writeText(copyText ?? result).catch(() => {})
      },
    })
    const dec = decode(text)
    // Decoded text goes first; a binary decode is rarely what you meant for ordinary words, so it comes last.
    return [
      ...(dec?.kind === 'text' ? [mk('Decode base64', dec.text)] : []),
      mk('Encode to base64', encode(text)),
      mk('Encode to URL-safe base64 (no padding)', encode(text, { url: true })),
      ...(dec?.kind === 'binary' ? [mk(`Decode base64 → ${dec.bytes.length} bytes of binary (hex)`, dec.hex)] : []),
    ]
  },
})

// JWT decoder: paste a token (optionally "Bearer …") to see header, payload, claim times and expiry. Decode only, never sent anywhere.
registerProvider({
  id: 'jwt',
  name: 'JWT decoder',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('jwt', 'JWT', 'iconify:fa6-solid:key')
    const token = extractToken(q)
    if (!token) return []
    return [{ key: 'jwt:' + q, title: 'Decode JWT', kind: 'jwt', icon: 'iconify:fa6-solid:key', panel: JwtPanel, hint: 'Enter: copy payload', data: parseJwt(token) }]
  },
})

// UUID: "uuid" → v4 / v7 and common spellings, "uuid 5" → five at once, "uuid <uuid>" → inspect (version, time) and re-format.
registerProvider({
  id: 'uuid',
  name: 'UUID',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('uuid', 'UUID', 'iconify:fa6-solid:fingerprint')
    const cmd = parseUuidCommand(q)
    if (!cmd) return []
    // `fill` is what reopens this value from Recent (as "uuid <value>", which offers every spelling again)
    const item = (key, title, subtitle, text, fill) => ({
      key: `uuid:${key}:${text}`,
      title,
      subtitle: `${subtitle}  ·  Enter to copy`,
      kind: 'Copy',
      recent: false,
      icon: 'iconify:fa6-solid:fingerprint',
      run: () => {
        if (fill) rememberHistory('uuid', { key: `uuid:${text}`, title: text, subtitle, fill })
        navigator.clipboard?.writeText(text).catch(() => {})
      },
    })
    if (cmd.inspect) {
      const p = cmd.inspect
      const f = forms(p.canonical)
      const detail = p.nil ? 'Nil UUID (all zeros)' : `Version ${p.version} · ${p.versionName}`
      const extra = p.nil ? '' : `${p.variant}${p.time ? ` · created ${p.time.toISOString()}` : ''}`
      return [
        item('info', detail, extra || 'canonical form', f.lower, `uuid ${p.canonical}`),
        item('upper', f.upper, 'UPPERCASE', f.upper, `uuid ${p.canonical}`),
        item('compact', f.compact, 'No hyphens', f.compact, `uuid ${p.canonical}`),
        item('braces', f.braces, 'Braces (GUID style)', f.braces, `uuid ${p.canonical}`),
      ]
    }
    if (cmd.count > 1) {
      const many = (gen, label) => {
        const list = Array.from({ length: cmd.count }, gen)
        return item(`${label}${cmd.count}`, `${cmd.count} × ${label}  (${list[0]}, …)`, 'One per line', list.join('\n'))
      }
      return [many(() => v4(), 'UUID v4'), many(() => v7(), 'UUID v7')]
    }
    const u = v4()
    const u7 = v7()
    const f = forms(u)
    return [
      item('v4', u, 'UUID v4 · random', u, `uuid ${u}`),
      item('v7', u7, 'UUID v7 · time-ordered (sorts by creation time)', u7, `uuid ${u7}`),
      item('compact', f.compact, 'v4, no hyphens', f.compact, `uuid ${u}`),
      item('upper', f.upper, 'v4, UPPERCASE', f.upper, `uuid ${u}`),
      item('braces', f.braces, 'v4, braces (GUID style)', f.braces, `uuid ${u}`),
      item('nil', NIL, 'Nil UUID', NIL, `uuid ${NIL}`),
    ]
  },
})

// Hash: "hash <text>" gives MD5 + SHA-1/256/384/512; "sha256 <text>" / "md5 <text>" gives one (hex, UPPERCASE hex, base64). Enter copies.
registerProvider({
  id: 'hash',
  name: 'Hash',
  filter: false,
  async items(q) {
    if (!q.trim()) return historyItems('hash', 'Hash', 'iconify:fa6-solid:hashtag')
    const cmd = parseHashCommand(q)
    if (!cmd) return []
    const results = await digest(cmd.text, cmd.ids ?? undefined)
    const preview = (t) => (t.length > 40 ? t.slice(0, 40) + '…' : t).replace(/\s+/g, ' ')
    const mk = (algo, form, value) => ({
      key: `hash:${algo.id}:${form}:${cmd.text}`,
      title: value,
      subtitle: `${algo.label}${form === 'hex' ? '' : ' · ' + form}  ·  Enter to copy`,
      kind: 'Copy',
      recent: false,
      icon: 'iconify:fa6-solid:hashtag',
      run: () => {
        rememberHistory('hash', { key: `hash:${algo.id}:${cmd.text.slice(0, 200)}`, title: `${algo.label} of "${preview(cmd.text)}"`, subtitle: results[algo.id].hex.slice(0, 24) + '…', fill: `${algo.id} ${cmd.text}` })
        navigator.clipboard?.writeText(value).catch(() => {})
      },
    })
    const out = []
    for (const algo of ALGOS) {
      const r = results[algo.id]
      if (!r) continue
      out.push(mk(algo, 'hex', r.hex))
      if (cmd.ids) out.push(mk(algo, 'UPPERCASE', r.hex.toUpperCase()), mk(algo, 'base64', r.b64))
    }
    return out
  },
})

// Regex tester: "regex" / "re " opens an editor; "re /\\d+/g some text" pre-fills pattern, flags and test text. Ctrl+Enter copies /regex/.
registerProvider({
  id: 'regex',
  name: 'Regex tester',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('regex', 'Regex', 'iconify:fa6-solid:asterisk')
    const data = parseRegexCommand(q)
    if (!data) return []
    return [{ key: 'regex:' + q, title: 'Regex tester', kind: 'regex', icon: 'iconify:fa6-solid:asterisk', panel: RegexPanel, hint: 'Ctrl+Enter: copy /regex/', data }]
  },
})

// Colour picker: "color", "color red", "#ff8800", "rgb(255, 136, 0)", "hsl(…)" open a picker with every format, shades,
// harmonies and WCAG contrast. Click any value to copy; Enter copies the HEX.
registerProvider({
  id: 'color',
  name: 'Colour picker',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('color', 'Colour', 'iconify:fa6-solid:palette')
    const data = parseColorCommand(q)
    if (!data) return []
    return [{ key: 'color:' + q, title: 'Colour picker', kind: 'color', icon: 'iconify:fa6-solid:palette', panel: ColorPanel, hint: 'Enter: copy HEX · click a value to copy it', data }]
  },
})

// Lorem ipsum: "lorem" shows presets; "lorem 50" = 50 words (like Emmet), "lorem 3p", "lorem 2 sentences", "lorem 200 chars".
// Each request offers plain text, HTML (<p>…</p>) and a version without the classic opening. Enter copies.
registerProvider({
  id: 'lorem',
  name: 'Lorem ipsum',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('lorem', 'Lorem', 'iconify:fa6-solid:align-left')
    const cmd = parseLoremCommand(q)
    if (!cmd) return []
    const preview = (t) => (t.length > 90 ? t.slice(0, 90) + '…' : t).replace(/\s+/g, ' ')
    const mk = (spec, variant, label) => {
      const text = generate(spec, { classic: variant !== 'random' })
      const out = variant === 'html' ? toHtml(text) : text
      const what = unitLabel(spec.count, spec.unit)
      return {
        key: `lorem:${spec.count}${spec.unit}:${variant}`,
        title: preview(out),
        subtitle: `${what} · ${label}  ·  Enter to copy`,
        kind: 'Copy',
        recent: false,
        icon: 'iconify:fa6-solid:align-left',
        run: () => {
          rememberHistory('lorem', { key: `lorem:${spec.count}${spec.unit}:${variant}`, title: `Lorem ipsum · ${what}`, subtitle: label, fill: `lorem ${spec.count} ${spec.unit}` })
          navigator.clipboard?.writeText(out).catch(() => {})
        },
      }
    }
    if (cmd.menu) {
      return [
        [1, 'sentences'], [1, 'paragraphs'], [3, 'paragraphs'], [5, 'paragraphs'], [10, 'words'], [50, 'words'], [100, 'words'],
      ].map(([count, unit]) => mk({ count, unit }, 'plain', 'plain text'))
    }
    return [mk(cmd, 'plain', 'plain text'), mk(cmd, 'html', 'HTML paragraphs'), mk(cmd, 'random', 'no "Lorem ipsum dolor" opening')]
  },
})

// Timestamp converter: "now", "1700000000" (s/ms/µs/ns by length), "2026-11-06T12:00:00Z", "ts +3d", "ts 1700000000 in Asia/Tokyo".
// Shows unix seconds/ms, ISO (UTC + local), a time zone of your choice, RFC 2822 and a relative time. Enter copies a row.
registerProvider({
  id: 'ts',
  name: 'Timestamp',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('ts', 'Time', 'iconify:fa6-solid:clock')
    const now = Date.now()
    const cmd = parseTimestampCommand(q, now)
    if (!cmd) return []
    const rows = formatRows(cmd.ms, { zone: cmd.zone, now })
    if (cmd.alt !== undefined) {
      const utc = formatRows(cmd.alt, { now })
      rows.push({ id: 'unix-utc', label: 'Unix seconds, if that was UTC', value: utc[0].value }, { id: 'iso-utc', label: 'ISO 8601, if that was UTC', value: utc[2].value })
    }
    const input = q.trim().replace(/^(?:ts|timestamp|epoch|unix)\s*/i, '') || 'now'
    const iso = rows.find((r) => r.id === 'iso').value
    return rows.map((r, i) => ({
      key: `ts:${r.id}:${cmd.ms}`,
      title: r.value,
      subtitle: `${r.label}${i === 0 ? ' · ' + cmd.note : ''}  ·  Enter to copy`,
      kind: 'Copy',
      recent: false,
      icon: 'iconify:fa6-solid:clock',
      run: () => {
        rememberHistory('ts', { key: `ts:${input}`, title: `Timestamp · ${input.length > 50 ? input.slice(0, 50) + '…' : input}`, subtitle: iso, fill: `ts ${input}` })
        navigator.clipboard?.writeText(r.value).catch(() => {})
      },
    }))
  },
})

// Text diff: "diff" opens two boxes; "diff <old>⏎=======⏎<new>" pre-fills both (a line of 7 "=" separates them).
// Line diff with word-level highlights, unified or side by side. Ctrl+Enter copies a standard unified diff.
registerProvider({
  id: 'diff',
  name: 'Text diff',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('diff', 'Diff', 'iconify:fa6-solid:code-compare')
    const data = parseDiffCommand(q)
    if (!data) return []
    return [{ key: 'diff:' + q, title: 'Text diff', kind: 'diff', icon: 'iconify:fa6-solid:code-compare', panel: DiffPanel, hint: 'Ctrl+Enter: copy unified diff', data }]
  },
})

// Cron explainer: "cron */5 * * * *", "@daily", or just paste an expression like "0 9 * * 1-5". Plain-English description,
// per-field breakdown and the next run times (local or UTC). Standard 5-field, Spring/Quartz/AWS flavours, L/W/# specials.
registerProvider({
  id: 'cron',
  name: 'Cron explainer',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('cron', 'Cron', 'iconify:fa6-solid:clock-rotate-left')
    const data = parseCronCommand(q)
    if (!data) return []
    return [{ key: 'cron:' + q, title: 'Cron explainer', kind: 'cron', icon: 'iconify:fa6-solid:clock-rotate-left', panel: CronPanel, hint: 'Enter: copy description', data }]
  },
})

// CSV <-> JSON: "csv" + data (or paste multi-line CSV/TSV, e.g. copied from a spreadsheet) converts to JSON;
// JSON pasted after "csv" converts to CSV. Ctrl+Enter copies.
registerProvider({
  id: 'csv',
  name: 'CSV ⇄ JSON',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('csv', 'CSV', 'iconify:fa6-solid:table')
    const data = parseCsvCommand(q)
    if (!data) return []
    return [{ key: 'csv:' + q, title: 'CSV ⇄ JSON', kind: 'csv', icon: 'iconify:fa6-solid:table', panel: CsvPanel, hint: 'Ctrl+Enter: copy result', data }]
  },
})

// Password generator: "password", "password 32", "pw 16 nosymbols easy" (flags: nosymbols nonum noupper nolower easy).
// Offers a strong password, letters+numbers only, an easy-to-read one (no 0/O/1/l), a PIN, a hex token and a URL-safe token,
// each with an entropy estimate. Generated with crypto.getRandomValues. Deliberately NOT saved to Recent.
registerProvider({
  id: 'password',
  name: 'Password generator',
  filter: false,
  items(q) {
    const cmd = parsePasswordCommand(q)
    if (!cmd) return []
    const { length, lengthGiven, opts } = cmd
    const size = (o) => passwordPools(o).join('').length
    const mk = (label, text, poolSize) => {
      const bits = entropyBits(text.length, poolSize)
      return {
        key: `password:${label}:${text}`,
        title: text,
        mono: true,
        subtitle: `${label} · ≈${bits} bits (${strengthLabel(bits)})  ·  Enter to copy`,
        kind: 'Copy',
        recent: false,
        icon: 'iconify:fa6-solid:lock',
        run: () => navigator.clipboard?.writeText(text).catch(() => {}),
      }
    }
    const pinLen = lengthGiven && length <= 12 ? length : 6
    return [
      mk(`${length} characters`, genPassword({ length, ...opts }), size(opts)),
      ...(opts.symbol !== false ? [mk('Letters and numbers only', genPassword({ length, ...opts, symbol: false }), size({ ...opts, symbol: false }))] : []),
      ...(!opts.easy ? [mk('Easy to read (no 0/O or 1/l look-alikes)', genPassword({ length, ...opts, easy: true }), size({ ...opts, easy: true }))] : []),
      mk(`${pinLen}-digit PIN`, genPin(pinLen), 10),
      mk('Hex token', hexToken(length), 16),
      mk('URL-safe token', urlToken(length), 64),
    ]
  },
})

// QR code: "qr <text or URL>" shows a live code with error-correction, size, colour and quiet-zone options, a Wi-Fi tab,
// and Copy / Download as PNG or SVG. Ctrl+Enter copies the PNG.
registerProvider({
  id: 'qr',
  name: 'QR code',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('qr', 'QR', 'iconify:fa6-solid:qrcode')
    const data = parseQrCommand(q)
    if (!data) return []
    return [{ key: 'qr:' + q, title: 'QR code', kind: 'qr', icon: 'iconify:fa6-solid:qrcode', panel: QrPanel, hint: 'Ctrl+Enter: copy PNG', data }]
  },
})

// Markdown previewer: "md <markdown>" (or "markdown …") renders it live. Copy as rich text (pastes formatted into email and
// docs), as HTML, or download a standalone page. Raw HTML in the source is shown as text, never rendered.
registerProvider({
  id: 'md',
  name: 'Markdown preview',
  filter: false,
  items(q) {
    if (!q.trim()) return historyItems('md', 'Markdown', 'iconify:fa6-brands:markdown')
    const data = parseMarkdownCommand(q)
    if (!data) return []
    return [{ key: 'md:' + q, title: 'Markdown preview', kind: 'md', icon: 'iconify:fa6-brands:markdown', panel: MarkdownPanel, hint: 'Ctrl+Enter: copy rich text', data }]
  },
})

// Calculator, unit and currency converter: math (1+1, (2+3)*4), units (10 km to miles, 100f to c), money (100 usd to gbp).
// Registered first so the answer shows above link results. Enter copies the result.
registerProvider({
  id: 'calc',
  name: 'Calculator & converters',
  filter: false,
  async items(q) {
    const cv = q.trim() ? convert(q) : null
    if (cv) return [calcItem(q.trim(), cv.text, cv.label, cv.label)]
    const fx = q.trim() ? parseCurrency(q) : null
    if (fx) {
      const data = await getRates() // cached for hours; only fetched when the input looks like a currency conversion
      if (!data) return [{ key: 'fx:offline', title: 'Currency rates unavailable', subtitle: 'Needs internet access (api.frankfurter.dev)', kind: 'Offline', icon: 'iconify:fa6-solid:coins', run() {} }]
      const r = convertCurrency(fx, data.rates)
      if (!r) return []
      return [calcItem(q.trim(), r.text, r.label, r.label, `${r.note} · rates ${data.date}${data.stale ? ' (offline, cached)' : ''}`)]
    }
    const r = calculate(q)
    // Empty query: expose past calculations so they show up under "Recent" and can be re-copied.
    if (!q.trim()) return calcHistory().map((h) => calcItem(h.expr, h.text, h.label || `${h.expr} = ${h.text}`, h.label))
    if (!r) return []
    return [calcItem(q.trim().replace(/^=/, '').trim(), r.text, `= ${r.text}`)]
  },
})

const HK = 'launcher.calcHistory'
function calcHistory() {
  try {
    return JSON.parse(localStorage.getItem(HK) || '[]')
  } catch {
    return []
  }
}
function remember(expr, text, label) {
  try {
    localStorage.setItem(HK, JSON.stringify([{ expr, text, label }, ...calcHistory().filter((h) => h.expr !== expr)].slice(0, 25)))
  } catch {}
}
function calcItem(expr, text, title, label, note) {
  return {
    key: `calc:${expr}`,
    title,
    subtitle: `${note || expr}  ·  Enter to copy`,
    kind: 'Copy',
    icon: note ? 'iconify:fa6-solid:coins' : 'iconify:fa6-solid:calculator',
    run: () => {
      remember(expr, text, label)
      navigator.clipboard?.writeText(text).catch(() => {})
    },
  }
}

// Default provider: tiles, bookmarks, dev environments and GitHub repos (+ their quick links).
registerProvider({
  id: 'links',
  name: 'Links & tiles',
  items() {
    const out = []
    for (const t of tiles.value) {
      const c = t.config || {}
      out.push({ key: `tile:${t.id}`, title: t.title, subtitle: tileLabel(t), kind: 'Tile', icon: t.icon, run: () => focusTile(t.id) })

      if (t.type === 'bookmarks') {
        for (const l of c.links || []) {
          if (!l.url) continue
          out.push({ key: `link:${t.id}:${l.url}`, title: l.title || l.url, subtitle: l.url, group: t.title, kind: 'Link', iconSrc: faviconUrl(l.url), run: ({ newTab }) => open(l.url, newTab) })
        }
      } else if (t.type === 'dev') {
        for (const v of devServices(c)) {
          for (const [k, label] of ENVS) {
            if (!v[k]) continue
            const name = v.name || t.title
            out.push({ key: `dev:${t.id}:${name}:${k}`, title: `${name} ${label}`, subtitle: v[k], group: t.title, kind: label, kindClass: k === 'prod' ? 'badge-error' : k === 'stage' ? 'badge-warning' : 'badge-info', iconSrc: faviconUrl(v[k]), run: ({ newTab }) => open(v[k], newTab) })
          }
        }
      } else if (t.type === 'github') {
        for (const r of c.repos || []) {
          const gh = parseGithub(r.url, c.owner)
          if (!gh) continue
          const name = `${gh.owner}/${gh.repo}`
          for (const [label, href] of githubLinks(gh.base)) {
            out.push({ key: `gh:${href}`, title: label === 'Code' ? name : `${name} · ${label}`, subtitle: href, group: t.title, kind: label === 'Code' ? 'Repo' : 'Repo link', iconSrc: faviconUrl('https://github.com'), run: ({ newTab }) => open(href, newTab) })
          }
        }
      }
    }
    return out
  },
})

const tileLabel = (t) => ({ bookmarks: 'Bookmarks tile', dev: 'Developer tile', github: 'GitHub tile', widget: `${t.config?.kind || 'Widget'} widget` })[t.type] || t.type

// ">" prefix: commands.
registerProvider({
  id: 'commands',
  name: 'Commands',
  prefix: '>',
  items() {
    const cmd = (id, title, run, subtitle) => ({ key: `cmd:${id}`, title, subtitle, kind: 'Command', icon: 'iconify:fa6-solid:terminal', run })
    return [
      cmd('add', 'Add tile', () => (editing.value = { id: null })),
      cmd('import', 'Import Bookmarks', () => (importing.value = true)),
      cmd('settings', 'Open Settings', () => (settingsOpen.value = true)),
      cmd('collapse', 'Collapse all tiles', () => setAllCollapsed(true)),
      cmd('expand', 'Expand all tiles', () => setAllCollapsed(false)),
      cmd('bar', `${settings.value.autoHideBar === false ? 'Enable' : 'Disable'} title bar auto-hide`, () => saveSettings({ autoHideBar: settings.value.autoHideBar === false })),
    ]
  },
})
