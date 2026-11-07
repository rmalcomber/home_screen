---
title: Extending Home Screen
description: Add a widget or a launcher tool as an extension, a folder with a manifest, an entry and an engine.
sidebar:
  order: 4
---

Every widget and launcher tool is an **extension**: one folder in `web/src/extensions/`. There is no plugin system you install into a running program. You add a folder and rebuild, and the build turns each extension into its own chunk that the browser fetches only when it is needed. See [Tech stack and build](/reference/tech-stack/).

## How the code is organised

```
web/src/
  core/                 the app itself, always loaded
    ui/                 grid, tile editor, dialogs
    tiles/              built-in tile types: bookmarks, developer, GitHub, group
    launcher/           the launcher window, history, and the Links and Commands providers
    extensions/         the extension runtime: registry, loader, host API
    lib/                small pure helpers shared by several extensions (JSON, colour, text)
  extensions/           one folder per extension
    cron/
      manifest.js       what it is (data only)
      index.js          the entry, loaded on demand
      engine.js         the logic: pure functions, unit tested
      tool.js           the launcher side: turns a query into results
      Panel.jsx         the result panel
```

An extension is described from the outside in:

1. **Manifest** (`manifest.js`): its name and what it contributes. It is loaded with the app, so it stays small and holds no code.
2. **Widget and/or tool**: a *widget* is a dashboard tile, a *tool* is a launcher feature. An extension may offer either or both.
3. **Engine**: the logic behind them, written as plain functions with no user interface, so it is easy to test. Panels, widgets and tools all build on it.

## What loads when

- The manifests load with the app. They are enough to fill the widget gallery, size new tiles and apply templates.
- A widget's code loads when its tile first appears (or when you open its settings). While it loads the tile says *Loading…*. If the file cannot be fetched, which can happen in a tab left open across an upgrade, the tile offers *Try again*.
- Launcher tools load when you open the launcher. Dashboards that never open it never download them.

## The manifest

```js
// web/src/extensions/hello/manifest.js
export default {
  id: 'hello',                    // the folder name; unique
  name: 'Hello',
  tool: { id: 'hello', name: 'Hello', order: 20 },    // optional: a launcher tool
  widgets: [{                                         // optional: dashboard widgets
    kind: 'tool-hello',           // saved inside tiles, so never rename it once released
    name: 'Hello',
    category: 'Developer tools',  // one of the gallery categories
    icon: 'iconify:fa6-solid:hand',
    description: 'Says hello to whatever you type.',
    size: [3, 6],                 // default grid columns and rows
    host: { provider: 'hello', prefix: 'hello', input: 'line', placeholder: 'e.g. hello world' },
  }],
}
```

- `tool.order` sets where the tool's results appear in the launcher. Lower comes first, and the built-in Links and Commands providers come last.
- `defaults` (optional) is a widget's starting config. It must contain `kind`; `{ kind }` alone is the default.
- `host` says "show my launcher tool as a widget": a text box on top and the tool's results below, with no widget code to write. `input` is `line`, `multi` or `none` (the tool's panel has its own fields). Other keys: `prefix` (the command word added before the text), `default`, `hint`, `rows`, `allowEmpty` and `regenerate` for generators.
- A widget without `host` is a custom widget and needs a `Body` and `Options` in the entry (below).

The tests check every manifest, so a typo in a category or a duplicate `kind` fails the build.

## A launcher tool

```js
// web/src/extensions/hello/engine.js: the logic, pure and testable
export const parseHelloCommand = (q) => /^\s*hello\s+(.+)$/i.exec(q || '')?.[1]?.trim() || null
export const greet = (name) => `Hello, ${name}!`
```

```js
// web/src/extensions/hello/tool.js: the launcher side
import { remember } from '../../core/extensions/host.js'
import { parseHelloCommand, greet } from './engine.js'

export default {
  async items(query) {
    const name = parseHelloCommand(query)
    if (!name) return []
    return [{
      key: `hello:${name}`,                  // stable id (used for Recent)
      title: greet(name), subtitle: 'Enter to copy', kind: 'Copy',
      icon: 'iconify:fa6-solid:hand',
      run() {
        remember('hello', { key: `hello:${name}`, title: greet(name), fill: `hello ${name}` })
        navigator.clipboard?.writeText(greet(name))
      },
    }]
  },
}
```

```js
// web/src/extensions/hello/index.js: the entry, loaded on demand
import tool from './tool.js'
export default { tool }
```

That is a complete extension. It answers `hello world` in the launcher, and it is in the widget gallery as **Hello**.

Two extras make richer tools:

- **`panel`**: return an item with `panel: MyComponent` (plus `data` and `hint`) to take over the results area with your own UI, as the curl, JSON, JWT and regex tools do.
- **History**: call `remember(kind, { key, title, subtitle, fill })` when the user copies or runs something. It then shows under **Recent**, and choosing it puts `fill` back into the launcher box. When the launcher is asked with an empty query, return `historyItems(kind, badge, icon)` so Recent can list it.

A tool answers every query, so return `[]` quickly for input that is not yours.

## A custom widget

When a plain text box is not enough, give the extension its own widget code:

```js
// web/src/extensions/hello/widget.jsx
import { patchConfig } from '../../core/extensions/host.js'

export default {
  Body({ tile }) { /* render using tile.config; call patchConfig(tile, { ...tile.config, x }) to save */ },
  Options({ config, set }) { /* editor fields; call set({ ... }) */ },
  async prepare(config) { /* optional: finish the config before it is saved */ },
}
```

Register it by kind in the entry, and leave `host` out of that widget in the manifest:

```js
// index.js
import hello from './widget.jsx'
export default { widgets: { 'my-kind': hello } }
```

Look at `extensions/countdown/` for a small custom widget, and `extensions/color/` for an extension that has both a tool and a widget.

## The host API

Extensions reach the app only through `web/src/core/extensions/host.js`, plus Preact and a few listed packages (`marked`, `qrcode-generator`). It offers `patchConfig` and `settings` (tile state), `remember` and `historyItems` (launcher history), `useHotkeyScope` (keyboard shortcuts that stay inside a widget), `IconView`, a `Field` for settings forms, and the shared helpers from `core/lib` (`shortHash`, `relativeTime`, JSON and colour helpers).

Two rules, both enforced by the tests:

- **An extension imports only its own folder and the host API.** Engines, which hold the pure logic, may also import `core/lib`, and must not import Preact, the host or app state.
- **Extensions do not import each other.** Code two extensions need goes to `core/lib`. To open another tool, put its command word in the launcher text instead, as the JSON panel's *→ CSV* button does (`csv <data>`).

## Testing

Put tests next to the engine (`engine.test.js`) and run `npx vitest run` in `web/`. The extension tests check the manifests, that each entry exports what its manifest promises, that the launcher registers the tools in order, and the import rules above.
