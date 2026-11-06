---
title: Options and configuration
description: Command-line options, environment variables and where files are stored.
sidebar:
  order: 4
---

Home Screen has very few settings on purpose. The program accepts two options; everything else is configured from the dashboard itself.

## Command-line options

| Option | Environment variable | Default | Meaning |
|---|---|---|---|
| `--port <n>` | `PORT` | `7878` | Port to listen on |
| `--db <path>` | none | `home_screen.db` next to the program | Where the SQLite database is stored |

```powershell
home_screen.exe --port 9000 --db D:\data\home.db
```

If both `--port` and `PORT` are given, `--port` wins.

## What the server listens on

Home Screen binds to `127.0.0.1` only. It is **not** reachable from other computers on your network, and there is no option to change that. This is deliberate, because there are no accounts: anyone who could reach the port could edit your tiles.

If you need access from another machine, put a reverse proxy with authentication in front of it. See [Privacy and security](/guides/privacy-and-security/).

## Where things are stored

| What | Where |
|---|---|
| Tiles, layout, icons, images, settings | the SQLite database (`home_screen.db`) |
| Launcher history, cached currency rates, panel preferences | your browser's local storage for the page address |

See [Data and backup](/guides/data-and-backup/).

## Settings inside the dashboard

Background colour and image, glass level and the auto-hide title bar are saved in the database and edited under **☰ → Settings**. See [Settings](/guides/settings/).
