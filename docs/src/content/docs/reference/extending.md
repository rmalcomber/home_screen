---
title: Extending Home Screen
description: Add a widget or a launcher tool with one small module.
sidebar:
  order: 4
---

Both widgets and launcher tools are registered in code, in `web/src/`. There is no plugin system: you add a module and rebuild. See [Tech stack and build](/reference/tech-stack/).

## Add a widget

Widgets live in `web/src/tiles/`. An entry looks like this:

```js
const myWidget = {
  label: 'My widget',
  size: [3, 8],                       // default grid width and height
  defaults: { kind: 'mine' },         // initial config
  Body({ tile }) { /* render using tile.config */ },
  Options({ config, set }) { /* editor fields; call set({ ... }) */ },
}
```

Add it to the widgets export, and give it a category, icon and description in `catalog.js`, and it appears in the gallery. A test checks that every widget has all of those.

## Add a launcher tool

Launcher tools are **providers**, registered in `web/src/launcher/providers.js`:

```js
registerProvider({
  id: 'demo',
  name: 'Demo',
  prefix: '!',          // optional: typing this first character scopes the launcher to this provider
  filter: false,        // false if the provider does its own matching
  async items(query) {
    return [{
      key: 'demo:1',                    // stable id (used for Recent)
      title: 'Hello', subtitle: 'World', kind: 'Demo',
      icon: 'iconify:fa6-solid:star',
      run({ newTab }) { /* Enter or click */ },
    }]
  },
})
```

Two extras make richer tools:

- **`panel`**: return an item with `panel: MyComponent` (plus `data` and `hint`) to take over the results area with your own UI. The curl, JSON, JWT, regex and other tools do this.
- **History**: call `remember(kind, { key, title, subtitle, fill })` from `launcher/history.js` when the user copies or runs something. It then shows under **Recent**, and choosing it puts `fill` back into the launcher box.

To make the tool a widget as well, add an entry to the tools table in `widgets_tools.jsx`.
