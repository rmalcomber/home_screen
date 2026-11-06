---
title: Locked mode
description: Fix the dashboard so it can be viewed and used, but not edited.
sidebar:
  order: 6
---

:::caution[Provisional]
Locked mode arrives with the first public release. The flag and variable names below are placeholders until then.
:::

Locked mode turns Home Screen into a **fixed start page**: tiles, links, the launcher and the tool widgets all work, but nothing can be changed. It is meant for a shared team page, a kiosk, or a container whose configuration you build once.

## Turn it on

```text
home_screen --locked
```

or set the environment variable:

```text
HOME_SCREEN_LOCKED=1
```

## What changes

| In normal mode | In locked mode |
|---|---|
| Drag, resize and collapse tiles | Tiles stay exactly where they are |
| Add, edit and delete tiles | The ✎ buttons, **＋ Add tile**, **Import Bookmarks** and **Settings** are hidden |
| Upload icons, images and backgrounds | Uploads are refused by the server |
| `/api` write endpoints accept changes | They answer `403 Forbidden` |
| Launcher, tools and tool widgets | Unchanged: everything that does not edit the dashboard keeps working |

The restriction is enforced **on the server**, not only hidden in the page, so a locked page cannot be edited by calling the API directly.

## A typical setup

1. Run Home Screen normally and build the dashboard you want.
2. Stop it and keep the `home_screen.db` file.
3. Start it again with `--locked` (or in a container with `HOME_SCREEN_LOCKED=1`) using that database.

To change the page later, stop it, start it without the flag, edit, and lock it again.
