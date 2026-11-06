---
title: Options and configuration
description: Command-line options, environment variables and where files are stored.
sidebar:
  order: 4
---

Home Screen has very few settings on purpose. The program accepts four options; everything else is configured from the dashboard itself.

## Command-line options

Each option can also be set with an environment variable. If both are given, the command-line option wins.

| Option | Environment variable | Default | Meaning |
|---|---|---|---|
| `--port <n>` | `PORT` | `7878` | Port to listen on |
| `--db <path>` | `HOME_SCREEN_DB` | `home_screen.db` next to the program | Where the SQLite database is stored |
| `--host <address>` | `HOME_SCREEN_HOST` | `127.0.0.1` | Address to listen on |
| `--allowed-hosts <names>` | `HOME_SCREEN_ALLOWED_HOSTS` | none | Extra host names that may use the curl runner (comma separated) |

```powershell
home_screen.exe --port 9000 --db D:\data\home.db
```

## What the server listens on

By default Home Screen binds to `127.0.0.1` only. It is **not** reachable from other computers on your network. This is deliberate, because there are no accounts: anyone who could reach the port could edit your tiles.

`--host 0.0.0.0` (or an address of one of your network interfaces) makes it reachable from other machines. Only do that behind a reverse proxy that handles authentication, or inside a container whose published port you control. The [Docker](/getting-started/docker/) image sets `HOME_SCREEN_HOST=0.0.0.0` for you and its Compose files publish the port on `127.0.0.1` or put Caddy with basic authentication in front. See [Privacy and security](/guides/privacy-and-security/).

### Reaching it through a proxy or another name

The [curl runner](/launcher/curl/) makes requests from the server, so it only accepts calls from a page opened via `localhost`, `127.0.0.1` or `[::1]`. That stops other websites, including DNS-rebinding tricks, from using it. If you open Home Screen by another name (a reverse proxy at `home.example.com`, or `nas.lan`), list that name:

```bash
home_screen --host 0.0.0.0 --allowed-hosts home.example.com,nas.lan
```

Names are matched without the port. Everything else in Home Screen works under any name; only the curl runner is restricted. The proxy must pass the original `Host` header through, which Caddy and nginx's `proxy_set_header Host $host` do.

## Where things are stored

| What | Where |
|---|---|
| Tiles, layout, icons, images, settings | the SQLite database (`home_screen.db`) |
| Launcher history, cached currency rates, panel preferences | your browser's local storage for the page address |

See [Data and backup](/guides/data-and-backup/).

## Settings inside the dashboard

Background colour and image, glass level and the auto-hide title bar are saved in the database and edited under **☰ → Settings**. See [Settings](/guides/settings/).
