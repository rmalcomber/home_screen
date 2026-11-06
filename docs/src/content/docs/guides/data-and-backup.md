---
title: Data and backup
description: Where your data lives, what is stored in the browser, and how to back it up.
sidebar:
  order: 8
---

## The database

`home_screen.db` (SQLite) sits next to the program unless you pass `--db`. It holds everything that matters: tiles and their layout, uploaded icons, uploaded images (carousel and background) and settings. The tables are created automatically on first run.

**To back up or move your setup:** stop Home Screen and copy `home_screen.db` (and any `home_screen.db-wal` or `-shm` file next to it). To restore, put it back and start the program.

## Browser storage

Your browser's local storage for `localhost:7878` holds only conveniences:

- the launcher's Recent list and tool history (curl commands, JSON, hashes, regexes and so on),
- cached currency rates,
- some panel preferences, such as JSON indentation.

It is per browser profile and is not part of the database. Because the address is part of the key, a different port means an empty history.

:::caution[History can contain secrets]
Curl commands and JWTs you copy are stored in plain text in your browser so they can appear in Recent. Passwords and Wi-Fi QR codes are never stored. Clear the site's data in Chrome to remove the history.
:::

## Moving to another machine

Copy `home_screen.db` and the program. The browser history does not move with it, which is usually what you want.
