# Home Screen

A personal, self-hosted start page for Chrome: a grid of collapsible **tiles** (bookmarks, dev environments, GitHub repos, widgets) plus a **VS Code–style launcher** (`Ctrl+P`) that searches everything and doubles as a calculator, converter, curl runner, JSON formatter, JWT decoder, regex tester and more.

It ships as **one Windows `.exe`** (about 2 MB): a small Rust server with the web app and SQLite built in. No installer, no runtime, no accounts. Run it, point Chrome's home page at it, done.

> The full documentation site (with screenshots, a page per tool and widget, a roadmap and release notes) lives in [`docs/`](docs/README.md): `cd docs && npm run dev`.

- [Quick start](#quick-start)
- [Using the dashboard](#using-the-dashboard)
  - [Tiles](#tiles) · [Layout](#layout) · [Icons](#icons) · [Search](#search) · [Importing Chrome bookmarks](#importing-chrome-bookmarks) · [Settings](#settings)
- [The launcher](#the-launcher)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Where your data lives](#where-your-data-lives)
- [Privacy and security](#privacy-and-security)
- [Building from source](#building-from-source)
- [Project layout](#project-layout)
- [Extending it](#extending-it)
- [HTTP API](#http-api)
- [Troubleshooting](#troubleshooting)

---

## Quick start

Downloads for Windows, Linux (x64, arm64) and macOS (Apple silicon, Intel) are attached to each [GitHub release](https://github.com/rmalcomber/home_screen/releases), and there is a multi-arch Alpine Docker image: see [Docker](#docker).

1. Run `home_screen.exe`. A console window opens and prints something like:
   ```
   Home Screen running at http://localhost:7878  (db: C:\...\home_screen.db)
   ```
   Leave that window open (minimise it). Closing it stops the app.
2. Open <http://localhost:7878>.
3. Make it your Chrome home page:
   - **Settings → Appearance → Show home button → Enter custom web address**, and enter `http://localhost:7878`.
   - **Settings → On startup → Open a specific page**, and add the same address, if you want it on every launch.
4. Optional: start it with Windows. Press `Win+R`, run `shell:startup`, and drop a shortcut to `home_screen.exe` in that folder (set it to run *Minimized*).

### Command-line options

| Option | Environment | Default | Meaning |
|---|---|---|---|
| `--port <n>` | `PORT` | `7878` | Port to listen on |
| `--db <path>` | `HOME_SCREEN_DB` | `home_screen.db` next to the exe | SQLite database file |
| `--host <addr>` | `HOME_SCREEN_HOST` | `127.0.0.1` | Address to listen on |
| `--allowed-hosts <names>` | `HOME_SCREEN_ALLOWED_HOSTS` | | Extra host names allowed to use the curl runner (comma separated) |

By default the server only listens on `127.0.0.1`, so it is not reachable from other machines. If you use `--host 0.0.0.0`, put authentication in front of it.

### Docker

```bash
docker run -d --name home-screen -p 127.0.0.1:7878:7878 -v home-screen-data:/data ghcr.io/rmalcomber/home_screen:latest
```

The image is Alpine-based (no SSH server), runs as an unprivileged user and supports amd64 and arm64. Compose files are in `docker/`: `compose.yml` (on its own), `compose.caddy.yml` (behind Caddy with HTTPS and basic authentication) and `compose.build.yml` (build from this checkout). The `Dockerfile` builds from source with `docker build .`. See `docker/env.example` and the documentation site.

---

## Using the dashboard

The top bar holds the title, a **tile search box** and the **☰ menu** (Launcher, Add tile, Import Bookmarks, Settings). By default the bar auto-hides: move the mouse to the top edge of the page to reveal it (see [Settings](#settings)).

### Tiles

Create one from **☰ → + Add tile**. Pick a type, give it a title and an optional icon, then fill in the type-specific form. Click the ✎ on a tile to edit or delete it. You can have as many tiles as you like.

| Type | What it is |
|---|---|
| **Bookmarks** | A titled list of links, each with its site favicon. |
| **Developer** | One or more *services*, each with optional **Dev**, **Stage** and **Prod** URLs shown as coloured buttons labelled `{Name} {Env}`: Dev is blue, Stage is amber, **Prod is red**. Use **+ Add service** to put several services in one tile. |
| **GitHub repos** | A list of repositories. Each row links to the repo and has a **▾** dropdown with **Code, README, Compare, Pull requests, Issues, Actions**. Set an optional **default owner** (for example `rmalcomber`) and then enter just repo names; `owner/repo` or a full GitHub URL also work and override the default owner. |
| **Widget** | One of the built-in widgets, chosen from a categorised picker (below). |

**Widgets**

| Widget | Notes |
|---|---|
| **Clock** | Local time and **any number of time zones in one tile**. Each zone shows its name, IANA zone, abbreviation and UTC offset, and (with several zones) "Tomorrow"/"Yesterday" when the date differs from yours. You can name each zone, add popular ones with one click, and choose 12/24 hour and seconds. |
| **Weather** | Current conditions and today's high/low for **one or more places in one tile**, always labelled with the location ("London, GB"), from [Open-Meteo](https://open-meteo.com) (no API key). Each city is looked up when you save. Celsius or Fahrenheit. |
| **Countdown** | Days until (or since) a date. |
| **Notes** | A scratch pad. Type in the tile; it saves when you click away. |
| **Tabata timer** | Configurable get-ready, work and rest seconds and rounds, with Start/Pause/Reset, a colour per phase and optional beeps. |
| **Image carousel** | Upload images (PNG, JPEG, GIF, WebP, AVIF) or paste URLs. Set seconds per image (0 = manual) and fill/fit. Auto-advance pauses on hover; arrows and dots appear on hover. |
| **Todo list** | Keyboard-driven (see below). Click the list or Tab into it first. |
| **Colour picker** | A colour picker with an eyedropper (pick any colour on your screen), hex entry (also `rgb()`, `hsl()` and colour names), an alpha slider, every format ready to copy (HEX, RGB, HSL, HSV, OKLCH, float RGB) and a row of shades. Click a format to copy it; copied colours are kept in a *Recent* row. The working colour is saved with the tile. |

**Adding a widget.** In **☰ → + Add tile** choose **Widget**. A picker lists every widget with an icon and a one-line description. Browse by category (*Time & weather*, *Notes & tasks*, *Media & design*, *Calculators & converters*, *Security & encoding*, *Developer tools*) or search across all of them. Picking one fills in the **title and icon** for you (type or choose your own to override) and shows that widget's settings, if it has any, underneath.

**Every launcher tool is also a widget.** These host the same engine as the launcher, with a text box on top and the result below; click a result to copy it. They are: Calculator, Unit converter, Currency converter, Timestamp converter, Cron explainer, Lorem ipsum, Markdown previewer, QR code generator, Password generator, Hash generator, Base64, UUID generator, JWT decoder, Curl runner, JSON formatter, Regex tester, Text diff and CSV ⇄ JSON (the colour tool is the Colour picker widget above). Generators have a ↻ button to make new values. What you type into a tool widget is **not saved** (it can contain tokens, JSON or commands), so the box is empty after a reload. Keyboard shortcuts in a tool widget only apply while focus is inside that widget, and they use **Ctrl+Enter** rather than plain Enter, which stays free for typing.

**Several clocks or places.** The Clock and Weather widgets can show many time zones or cities at once, either as a stacked **list** or as **mini tiles** laid out side by side (wrapping onto further rows when the tile is narrow). Choose the layout under *Layout when there is more than one* in the widget's settings; with a single zone or place the widget shows the large single view.

Todo shortcuts: `n` new item · `↑ ↓` or `j k` move · `Space` or `x` toggle done · `e` or `Enter` edit · `d` or `Del` delete · `Shift+↑ ↓` reorder · `c` clear completed · `?` show help.

### Layout

- **Move** a tile by dragging its title bar.
- **Resize** it with the handle in the bottom-right corner.
- **Collapse / expand** it by clicking its title bar or the ▾ button. It behaves like an accordion: collapsed tiles shrink to just the header and the tiles below move up.
- The grid is 12 columns wide. Tiles you drop on top of others push them down, and gaps close up automatically. Positions, sizes and collapsed state are saved.
- On narrow windows (under 640 px) tiles stack in a single column and dragging is disabled.

### Icons

Tiles can have an optional icon. In the tile editor you can:

- **Search** thousands of icons by name (for example `github`, `aws`, `jira`). They come from the [Iconify](https://iconify.design) service, which includes Font Awesome (including all the brand icons), Simple Icons, Material and coloured logos. Nothing is bundled; icons are fetched when used.
- **Paste a name** such as `fa6-brands:github`.
- **Upload your own SVG.** It is sanitised (scripts and event handlers removed) and stored in the database. Your uploads are listed for re-use.

Link favicons in Bookmarks tiles are fetched from Google's favicon service.

### Search

- The **search box** in the top bar (press `/` to focus it) filters the grid live by tile title, link title and **partial URL**. Matching tiles open up and highlight the matching links; other tiles fade. `Esc` clears it.
- The **launcher** (`Ctrl+P`) searches the same things as a list you can jump from. See below.

### Importing Chrome bookmarks

**☰ → Import Bookmarks** turns a Chrome export into tiles:

1. In Chrome open the Bookmark Manager (`Ctrl+Shift+O`), then **⋮ → Export bookmarks**. This saves an HTML file.
2. In the dialog, choose that file. Links are **grouped by domain with subdomains merged** (`docs.github.com` and `github.com` land together; multi-part suffixes like `bbc.co.uk` are handled).
3. Decide where each group goes: use the dropdown on a row, or tick several rows and use **Move selected to** (a new tile with a name you choose, a tile per domain, or an existing Bookmarks tile). Everything starts as *Skip*, so you only import what you pick.
4. Click **Import**. Duplicate URLs are skipped, and groups sent to the same new tile name are merged into one tile.

### Settings

**☰ → Settings** (changes apply instantly and are saved):

- **Background colour**: a colour picker and swatches, or *Theme default* for the `dim` theme colour.
- **Background image**: upload an image or paste a URL. It covers the page and stays fixed when scrolling.
- **Glass**: a 0–100% slider. At 0% tiles and the top bar are solid; higher makes them see-through and blurs the background behind them.
- **Auto-hide title bar**: on by default.
- **Reset all** clears colour, image and glass.

---

## The launcher

Press **`Ctrl+P`** (or `Ctrl+K`, or **☰ → Launcher**) from the dashboard. It opens a search box in the middle of the page. `Esc` closes it. The box grows for pasted multi-line text.

- **Navigate**: `↑ ↓`, `PageUp/PageDown`. **`Enter`** opens in a new tab, **`Shift+Enter`** in the current tab. You can also click.
- With an empty box it shows your **Recent** items. Everything below that you copy or run is added to Recent, and choosing a recent item puts it back in the box so you can use it again.
- Several features are triggered by what you type. Anything that doesn't match one of them is a normal search.

### Search everything

Type to search tile titles, bookmark titles and URLs, Developer environment URLs and GitHub repos, including each repo's quick links (`rmal pull` finds `rmalcomber/YouTV · Pull requests`). Multiple words must all match. Choosing a tile scrolls to it, expands it and flashes it.

### Commands: `>`

Start with `>` (or press **`Ctrl+Shift+P`**, which opens the launcher with `>` already typed) to run commands: *Add tile*, *Import Bookmarks*, *Open Settings*, *Collapse all tiles*, *Expand all tiles*, *Enable/Disable title bar auto-hide*.

### Calculator

`1+1`, `(2+3)*4`, `2^10`, `sqrt(16)+max(1,2)`, `7%4`. Supports `+ - * / % ^ **`, brackets, `×` `÷`, and `sqrt abs round floor ceil sin cos tan log ln exp min max pow` plus `pi` and `e`. `Enter` copies the answer.

### Unit converter

`10 km to miles`, `5 ft in cm`, `100f to c`, `2h in min`, `1.5 gb to mb`, `60 mph to km/h`. Separators: `to`, `in`, `as`, `->`, `=>`, `→`. The number can be an expression (`2*5 km to m`). Covers length, mass, volume (US and UK gallons/pints), time, data (decimal and binary), speed, area and temperature.

### Currency converter

`100 usd to gbp`, `£50 in eur`, `20 dollars to yen`, `usd to gbp`. Rates come from [Frankfurter](https://frankfurter.dev) (central-bank reference rates, about 150 currencies, updated once per working day) and are cached in the browser for 6 hours. Offline it falls back to the last cached rates. `$` means US dollars; use a code (`cad`, `aud`) for others.

### Curl runner

Paste a curl command, for example one copied with **Chrome DevTools → Network → right-click a request → Copy → Copy as cURL (bash)**. The launcher lays it out:

- the method and URL,
- the **query parameters** as a table,
- the **headers** as a table (headers curl would add itself are marked *implied*),
- the **body**, pretty-printed if it is JSON or shown as a table if it is a form,
- badges for follow-redirects, insecure TLS, basic auth and timeout.

Press **`Enter`** to run it. You get the status (coloured), time and size, a **Body** tab (JSON pretty-printed) and a **Headers** tab, and a Copy button.

Supported options: `-X`, `-H`, `-d` / `--data-raw` / `--data-binary` / `--data-urlencode`, `--json`, `-u`, `-A`, `-e`, `-b`, `-L`, `-k`, `-I`, `-G`, `-m`, `--url`, and bundles like `-sSL`. Multipart forms (`-F`) and `-d @file` are not supported. The tables are read-only: edit the command text to change the request. Responses over 2 MB are truncated and binary responses aren't displayed.

The request is made by the **server** (browsers can't call arbitrary sites because of CORS), so it runs from your machine with your network access. See [Privacy and security](#privacy-and-security).

### JSON formatter

Paste JSON (starting with `{` or `[`). You get pretty-printed, colour-highlighted output with a **Pretty / Minified** toggle, 2/4-space or tab indent, **Sort keys**, and stats (type, depth, size). `Enter` copies exactly what is shown. It also fixes JavaScript-style input (comments, trailing commas, single quotes, unquoted keys), unwraps JSON that has been encoded as a string, and reports errors with line, column and a caret.

### Base64

`b64 hello world` (or `base64 …`) shows the standard and URL-safe encodings. If the text is valid base64 (standard or URL-safe, padding optional), the decoded text is shown first; binary results are offered as hex. Text containing spaces is never treated as base64.

### JWT decoder

Paste a token (optionally `Bearer …` or `Authorization: Bearer …`). You get a status badge (**valid / expired / not valid yet / no expiry**), the algorithm, human-readable **times** (`iat`, `exp`, `nbf`) with relative text such as "2 days ago", the header and payload as JSON, a table of known claims, and warnings for unsigned tokens. `Enter` copies the payload. **It only decodes; it does not verify the signature.**

### UUID

`uuid` (or `guid`) gives a v4 (random) and a v7 (time-ordered) UUID, plus no-hyphens, UPPERCASE and `{braces}` forms and the nil UUID. `uuid 5` gives five at once (up to 100), one per line. `uuid <existing uuid>` inspects it (version, variant, creation time for v1/v6/v7) and re-formats it.

### Hash

`hash hello` shows MD5, SHA-1, SHA-256, SHA-384 and SHA-512. `sha256 hello` or `md5 hello` shows one algorithm as hex, UPPERCASE hex and base64. Text is hashed as UTF-8; trailing whitespace is ignored.

### Regex tester

`regex` or `re ` opens an editor with a pattern box, flag toggles (`g i m s u y`), a test-text box, and live results: the text highlighted with every match, a table of positions, matches and capture groups (numbered and named), and an optional **Replace** preview. `Ctrl+Enter` copies `/pattern/flags`. You can pre-fill it: `re /(\w+)=(\d+)/g a=1, b=2`. Matching runs in a background worker with a 1.5 s limit, so a catastrophic pattern shows a warning instead of freezing the page.

### Markdown previewer

`md <markdown>` (or `markdown …`) renders what you type live. It understands GitHub-flavoured Markdown: headings (with working `#anchor` links), bold, italic, ~~strikethrough~~, inline code, fenced and indented code blocks, block quotes, ordered, unordered, nested and **task lists**, tables with column alignment, links, images, horizontal rules and line breaks. A status line shows words, characters, lines and an estimated reading time. Buttons: **Copy rich text** (`Ctrl+Enter`: the formatted result goes on the clipboard so it pastes with its formatting into email, Google Docs or Word, with the plain Markdown as the fallback), **Copy HTML** (the markup as text) and **Download .html** (a standalone page). `md` alone offers an example to start from.

The previewer is **safe by construction**: the Markdown is parsed to a token tree and turned into elements directly, so no HTML is ever injected. Raw HTML in your Markdown (`<script>`, `<div>`, `<img onerror=…>`) is shown as text and counted, and links and images with `javascript:` or other unsafe addresses are dropped. Images that use `http(s)` addresses are loaded from the internet when previewed. Footnotes and maths are not supported. Copied documents of up to 40 KB appear in Recent.

### QR code generator

`qr <text or URL>` (or `qrcode`) shows a live QR code. The **Text / URL** tab encodes whatever you typed after `qr`; the **Wi-Fi** tab takes a network name, password, security type and hidden flag and makes the code phones read as "join this network". Options: **error correction** (7%, 15%, 25% or 30%: more correction survives damage but makes a denser code), **PNG size** (256 to 2048 px), **quiet zone** (the blank border, 4 modules is the standard) and **colours** (dark on light scans most reliably, and a warning appears for light-on-dark). Buttons: **Copy PNG** (`Ctrl+Enter`, copies the image itself so you can paste it into chat or a document), **Copy SVG** (the markup), and **Download PNG / SVG**. Text is encoded as UTF-8, so accents, € and emoji scan correctly, and it tells you if the data is too long for a QR code (about 2,900 bytes at the lowest correction level). Text and URL codes you copy or download appear in Recent; **Wi-Fi codes never do** because they contain the password.

### Password generator

`password` (also `pw`, `passwd`) gives a fresh set of options, each copied with `Enter`: a **strong password** (20 characters with upper, lower, digits and symbols), **letters and numbers only**, an **easy-to-read** one (no `0/O` or `1/l/I` look-alikes), a **PIN**, a **hex token** and a **URL-safe token**, each with an entropy estimate in bits and a strength label. Add a length and flags: `password 32`, `pw 16 nosymbols`, `password 24 noupper easy` (flags: `nosymbols`, `nonum`, `noupper`, `nolower`, `easy`). Lengths run from 4 to 256. Passwords are generated in your browser with `crypto.getRandomValues` (unbiased sampling) and always contain every character kind you left enabled. **They are never saved to Recent or anywhere else.**

### CSV ⇄ JSON

Copy rows from a spreadsheet (tab-separated) or paste CSV straight into the launcher: multi-line data where every line has the same number of columns is recognised on its own. You can also type `csv` (or `tsv`) followed by the data. The panel converts it to JSON and shows how the data was read.

**CSV → JSON** options: delimiter (auto-detects comma, tab, semicolon and pipe, or choose), first row is a header, detect numbers and booleans (leading zeros and huge integers stay strings), empty cells as `null`, trim spaces, and the output shape: **array of objects**, **array of arrays** or **keyed by first column**. Output can be pretty-printed (2/4 spaces or tabs), minified or **JSON Lines**. Quoted fields, doubled quotes, embedded line breaks, CRLF and a BOM are handled. Duplicate or empty headers are renamed (`a_2`, `column_3`) and ragged rows are reported.

**JSON → CSV**: paste JSON after `csv`, or press **→ CSV** in the JSON formatter. An array of objects becomes one row each with the union of all keys as columns. Nested objects are flattened to `a.b` columns (optional) and arrays are written as JSON text. Choose the delimiter, header row and whether to quote every field. Arrays of arrays, plain arrays and a single object also work.

`Ctrl+Enter` (or **Copy**) copies the result and **Download** saves `data.json`, `data.jsonl` or `data.csv`. Conversions you copy appear in Recent and reopen with the same data.

### Cron expression explainer

Paste a cron expression, or type `cron <expression>` (also `crontab`). A bare expression such as `0 9 * * 1-5` or a macro such as `@daily` is recognised on its own, as long as it is clearly cron (it has a `*` or `/` and every field is valid). You get:

- a **plain-English description** (`*/15 9-17 * * 1-5` becomes "Every 15 minutes, between 09:00 and 17:59, on Monday through Friday"),
- a **field-by-field table** with each field's meaning,
- the **next 5, 10 or 25 run times**, in your local time or UTC, each with a relative time ("in 3 hours"),
- precise **error messages** that name the bad field (for example "Minute: 61 is out of range for minute (0–59)").

Supported syntax: `*`, lists (`1,15`), ranges (`9-17`), steps (`*/5`, `10-40/10`, `5/15`), month and weekday names (`JAN`, `MON-FRI`), `?`, the `@yearly @monthly @weekly @daily @midnight @hourly` macros and `@reboot`, and the Quartz specials `L` (last day), `LW`, `L-3`, `15W` (nearest weekday), `5L` (last Thursday) and `6#3` (third Friday). When both day-of-month and day-of-week are set, classic cron runs on either match, and the panel says so.

Five fields are read as standard cron and seven as Quartz. **Six fields are ambiguous**, so the panel offers a switch: *Seconds first · Spring* (day of week 0–7, Sunday is 0 or 7), *Seconds first · Quartz* (1–7, Sunday is 1) or *Year last · AWS* (EventBridge, 1–7 with Sunday as 1). `Enter` copies the description and copied expressions appear in Recent.

### Text diff

`diff` opens two boxes, **Original** and **Changed**, with **Paste** and **Clear** buttons on each and a **Swap** button. Paste (or type) both texts and the differences appear below:

- a **line diff** (Myers algorithm) with the changed words highlighted inside modified lines,
- **Unified** or **Side by side** view, with long runs of unchanged lines collapsed (click a "⋯ N unchanged lines" bar to expand it, or tick *Show unchanged*),
- options to **ignore whitespace** and **ignore case**,
- a `+added −removed` summary, or "Identical".

`Ctrl+Enter` (or **Copy diff**) copies a standard **unified diff** (`--- / +++ / @@` hunks with 3 lines of context) that tools like `patch` and `git apply` understand. You can also pre-fill both boxes from the launcher: `diff`, then the old text, a line containing only `=======`, and the new text. Copied diffs appear in Recent and reopen with both texts.

Very different texts (more than about 2,000 edits) are shown as a straight replacement rather than aligned.

### Timestamp converter

Paste or type a time and see it in every form, each row copyable with `Enter`: **Unix seconds**, **Unix milliseconds**, **ISO 8601** (UTC and your local zone with offset), your local date, **RFC 2822 / HTTP date**, and a **relative** description ("3 days ago").

- `now` (or `ts`) shows the current time.
- A bare number of 9+ digits is read by its length: 10 digits are seconds, 13 are milliseconds, 16 are microseconds, 19 are nanoseconds. With a prefix you can use any number, decimals, negatives and a unit: `ts 1700000000.5`, `ts 1700000000000 ms`, `ts 86400`.
- ISO dates: `2026-11-06T12:00:00Z`, `2026-11-06T13:00:00+01:00`, `2026-11-06 12:00`, `2026-11-06`. With no zone given it reads the time as **your local time** and also lists the Unix and ISO values if it had been UTC.
- Offsets from now: `ts +3d`, `now - 90 minutes`, `ts +1.5h` (units `s m h d w`).
- Other date text with the `ts` prefix is parsed by the browser (`ts Nov 6 2026 12:00 UTC`).
- Add `in <time zone>` for an extra row in that zone: `1700000000 in Asia/Tokyo`.

Copied conversions appear in Recent; reopening one re-runs it (so `now` is the current time again).

### Lorem ipsum

`lorem` shows quick presets (a sentence, 1/3/5 paragraphs, 10/50/100 words). Ask for an amount with `lorem 50` (**words**, like Emmet), `lorem 3p` / `lorem 3 paragraphs`, `lorem 2 sentences` or `lorem 200 chars` (the unit can be `w`, `s`, `p` or `c`). Each request offers **plain text**, **HTML** (`<p>…</p>` per paragraph) and a version **without the classic "Lorem ipsum dolor sit amet" opening**. Paragraphs are separated by a blank line, character counts are exact, and limits are 5000 words, 500 sentences, 100 paragraphs and 20,000 characters. `Enter` copies; copied requests appear in Recent and regenerate fresh text when reopened.

### Colour picker

`color` (or `colour`, `picker`) opens a picker. You can also type a colour directly: `#ff8800`, `rgb(255, 136, 0)`, `hsl(32 100% 50%)`, or `color rebeccapurple` (any CSS colour name or modern syntax such as `oklch(…)`). The panel shows:

- the native colour picker, a hex/CSS text box, an alpha slider and an **eyedropper** button (Chrome's EyeDropper: click it, then click any pixel on screen),
- every format, **click to copy**: HEX (and HEX + alpha), RGB, HSL, HSV, OKLCH and float RGB (`(1, 0.533, 0)`, handy for shaders),
- 9 **shades**, and **harmonies** (complementary, analogous, triad, split complementary). Click any swatch to make it the current colour,
- **WCAG contrast** of the colour as text on white and on black, with AA / AAA / large-text badges.

`Enter` copies the HEX. Copied colours go to Recent with a colour swatch; choosing one reopens it.

---

## Keyboard shortcuts

| Keys | Where | Action |
|---|---|---|
| `Ctrl+P` / `Ctrl+K` | Dashboard | Open / close the launcher |
| `Ctrl+Shift+P` | Dashboard | Open the launcher in command mode (`>`) |
| `/` | Dashboard | Focus the tile search box |
| `Esc` | Search box / launcher | Clear and leave / close |
| `↑ ↓`, `PageUp/PageDown` | Launcher | Move selection |
| `Enter` / `Shift+Enter` | Launcher | Open or copy / open in the same tab |
| `Enter` | Curl, JSON, JWT, colour panels | Run / copy / copy payload / copy HEX |
| `Ctrl+Enter` | Regex, diff and CSV panels | Copy `/pattern/flags` / the unified diff / the converted data |
| `n j k x e d c ?`, `Shift+↑↓` | Todo widget | See [Widgets](#tiles) |

---

## Where your data lives

- **`home_screen.db`** (SQLite, next to the exe unless you pass `--db`) holds everything that matters: tiles and their layout, uploaded icons, uploaded images (carousel and background) and settings. To **back up or move** your setup, stop the app and copy this file (and any `home_screen.db-wal` / `-shm` next to it). The tables are created automatically on first run.
- **Browser storage** (Chrome's local storage for `localhost:7878`) holds only conveniences: the launcher's Recent list and history (curl, JSON, base64, JWT, UUID, hash, regex, colour, lorem ipsum, timestamp, diff, cron, CSV, calculator), cached currency rates and your JSON format preferences. It is per browser profile and isn't part of the database.

Because the app is addressed as `localhost:7878`, changing the port gives Chrome a different origin and an empty history.

---

## Privacy and security

There is **no authentication**: anyone who can reach the port can edit your tiles. That is why the server binds to `127.0.0.1` only. Don't expose it to a network without putting something in front of it.

External services contacted by your browser, only when the feature is used:

| Service | For |
|---|---|
| `api.iconify.design` | Tile icons and icon search |
| `www.google.com/s2/favicons` | Link favicons (reveals the domains of your bookmarks to Google) |
| `api.open-meteo.com`, `geocoding-api.open-meteo.com` | Weather widget |
| `api.frankfurter.dev` | Currency rates |

Things to be aware of:

- **The curl runner makes requests from your machine**, with whatever URL, headers and credentials are in the command. The `/api/run` endpoint only accepts requests from this page opened via `localhost` or `127.0.0.1`: other websites (including DNS-rebinding tricks) get a `403`. It follows redirects only with `-L` and checks TLS certificates unless the command has `-k`.
- **Saved launcher history can contain secrets.** Curl commands (headers, tokens, URLs with keys) and JWTs are stored in plain text in your browser's local storage so they can appear in Recent. Clear it from Chrome's site data for `localhost:7878` if needed.
- JWTs, base64, hashes and JSON are processed entirely in your browser. They are not sent to the server.
- Uploaded SVG icons are sanitised and served with a restrictive content-security policy; image uploads accept raster formats only.

---

## Building from source

Requirements: **Rust** (stable, MSVC toolchain), **Node.js** 18+ (only to build the web app) and **npm**.

```powershell
.\build.ps1
```

This runs `npm ci && npm run build` in `web/`, then `cargo build --release`, and copies the result to `dist\home_screen.exe`. The web app is embedded into the exe at compile time (`rust-embed`), so the exe is fully self-contained: SQLite is bundled and TLS uses Windows' own certificate store.

If copying fails because the exe is in use, stop the running app first.

### Development

```powershell
# terminal 1: the server (needs web/dist to exist at least once: run `npm run build` in web/)
cargo run
# terminal 2: the web app with hot reload; /api is proxied to the server on :7878
cd web
npm run dev
```

### Tests

```powershell
cargo test              # database layer and SVG sanitiser
cd web; npm test        # parsers, converters, launcher logic (Vitest)
```

---

## Project layout

```
home_screen/
├─ Cargo.toml, build.ps1, Dockerfile
├─ docker/                   Compose files (plain, and behind Caddy with basic auth)
├─ src/                      Rust server (axum + rusqlite)
│  ├─ main.rs                routes, embedded static files, CLI args
│  ├─ db.rs                  schema, queries, SVG sanitiser (+ tests)
│  └─ api.rs                 JSON handlers, image/icon storage, curl runner
├─ docs/                     documentation site (Astro + Starlight, all content in Markdown)
├─ .github/workflows/        docs.yml (GitHub Pages) and release.yml (binaries, GitHub release, Docker image)
└─ web/                      Preact + Tailwind + DaisyUI (theme: dim), built with Vite
   └─ src/
      ├─ app.jsx, store.js, util.js        shell, state (signals), grid maths, bookmark parsing
      ├─ components/                       Grid, TileEditor, IconPicker, ImportBookmarks, SettingsDialog, ColorTool…
      ├─ tiles/                            tile bodies and widgets (widgets.jsx, widgets_extra.jsx)
      └─ launcher/                         the launcher
         ├─ registry.js, providers.js      provider registry and the built-in providers
         ├─ Launcher.jsx, history.js       the UI and per-feature history
         └─ calc / convert / currency / curl / json / base64 / jwt / uuid / hash / regex / color / lorem / timestamp / diff / cron / csv  (+ panels)
```

Stack: Rust, axum, rusqlite (bundled SQLite), rust-embed, ureq (native TLS); Preact with signals, Tailwind CSS 4, DaisyUI 5. Release builds are size-optimised (`opt-level = "z"`, LTO, stripped).

---

## Extending it

### Add a widget

Widgets are registered in `web/src/tiles/widgets.jsx` / `widgets_extra.jsx`. An entry looks like:

```js
const myWidget = {
  label: 'My widget',
  size: [3, 8],                       // default grid width and height
  defaults: { kind: 'mine' },         // initial config
  Body({ tile }) { /* render using tile.config */ },
  Options({ config, set }) { /* editor fields; call set({ ... }) */ },
}
```

Add it to the `WIDGETS` export and it appears in the tile editor.

### Add a launcher feature

Launcher features are *providers* registered in `web/src/launcher/providers.js` (see the header of `registry.js`):

```js
registerProvider({
  id: 'demo',
  name: 'Demo',
  prefix: '!',          // optional: typing this first character scopes the launcher to this provider
  filter: false,        // false if the provider does its own matching (default: results are fuzzy-ranked)
  async items(query) {
    return [{
      key: 'demo:1',                    // stable id (used for Recent)
      title: 'Hello', subtitle: 'World', kind: 'Demo',
      icon: 'iconify:fa6-solid:star',   // or iconSrc: 'https://…'
      run({ newTab }) { /* Enter / click */ },
    }]
  },
})
```

Two extras for richer features:

- **`panel`**: return an item with `panel: MyComponent` (and `data`, `hint`) to take over the results area with your own UI, as the curl, JSON, JWT and regex features do.
- **History**: call `remember(kind, { key, title, subtitle, fill })` from `launcher/history.js` when the user copies or runs something. It then shows under Recent, and choosing it puts `fill` back into the launcher box. Return `historyItems(kind, badge, icon)` from `items('')` so it can be listed.

---

## HTTP API

JSON over HTTP on the same port. There is no authentication.

| Method and path | Purpose |
|---|---|
| `GET /api/tiles` | List tiles |
| `POST /api/tiles` | Create a tile |
| `PUT /api/tiles/{id}` | Replace a tile |
| `DELETE /api/tiles/{id}` | Delete a tile |
| `PUT /api/layout` | Bulk-update `x, y, w, h, collapsed` for many tiles |
| `GET /api/icons`, `POST /api/icons` | List / upload SVG icons (`{ name, svg }`) |
| `GET /api/icons/{id}`, `DELETE /api/icons/{id}` | Serve / delete an icon |
| `POST /api/images?name=…` | Upload a raster image (raw body, `Content-Type: image/png` etc.) |
| `GET /api/images/{id}`, `DELETE /api/images/{id}` | Serve / delete an image |
| `GET /api/settings`, `PUT /api/settings` | Read / merge settings (`bgColor`, `bgImage`, `glass`, `autoHideBar`) |
| `POST /api/run` | Execute an HTTP request for the curl runner (localhost origin only) |

A tile looks like `{ "id", "type", "title", "icon", "x", "y", "w", "h", "collapsed", "config" }`, where `type` is `bookmarks`, `dev`, `github` or `widget` and `config` depends on the type.

---

## Troubleshooting

- **"Failed to fetch" in the page**: the app isn't running (or is on a different port). Start `home_screen.exe`.
- **"Cannot bind 127.0.0.1:7878"**: something else is using the port, or a second copy is running. Use `--port`.
- **A new build doesn't show up**: hard-refresh with `Ctrl+F5`; the app also has to be restarted after replacing the exe.
- **`Ctrl+P` opens Chrome's print dialog**: click into the page first so it has focus. The page overrides the shortcut only while it is focused.
- **Icons, favicons or weather are missing**: they need internet access (see [Privacy and security](#privacy-and-security)).
- **The curl runner says it only works via localhost**: open the app as `http://localhost:7878` or `http://127.0.0.1:7878`, or list the name you use in `--allowed-hosts` / `HOME_SCREEN_ALLOWED_HOSTS`.
- **Lost your layout after changing the port or folder**: data lives in `home_screen.db` next to the exe; make sure you are starting the copy that has your database, or pass `--db`.
