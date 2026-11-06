---
title: Install
description: Download Home Screen and run it on Windows, Linux or macOS.
sidebar:
  order: 1
---

Home Screen is one program. There is nothing to install first: no runtime, no database, no browser extension.

## Windows

1. Download `home_screen.exe` from the [releases page]({{releases}}) and put it in a folder you will keep, for example `C:\Tools\HomeScreen\`.
2. Double-click it. A console window opens and prints:

   ```text
   Home Screen running at http://localhost:7878  (db: C:\Tools\HomeScreen\home_screen.db)
   ```

3. Leave that window open (minimise it). Closing it stops Home Screen.
4. Open <http://localhost:7878> in your browser, then [make it your home page](/getting-started/chrome-home-page/).

The first run creates `home_screen.db` next to the program. That one file is all your data.

### Start it with Windows

Press <kbd>Win</kbd>+<kbd>R</kbd>, run `shell:startup`, and drop a shortcut to `home_screen.exe` into the folder that opens. Set the shortcut to run **Minimized**.

## Linux

:::caution[Provisional]
Linux builds arrive with the first public release. This page describes how they will work; the file names and flags below are placeholders until then.
:::

```bash
curl -L -o home_screen {{releases}}/latest/download/home_screen-linux-x86_64
chmod +x home_screen
./home_screen
```

It prints the same address, `http://localhost:7878`. To run it in the background, use a systemd user service:

```ini
[Unit]
Description=Home Screen

[Service]
ExecStart=%h/bin/home_screen --db %h/.local/share/home-screen/home_screen.db
Restart=on-failure

[Install]
WantedBy=default.target
```

## macOS

:::caution[Provisional]
macOS builds arrive with the first public release. Names and flags below are placeholders until then.
:::

```bash
curl -L -o home_screen {{releases}}/latest/download/home_screen-macos-universal
chmod +x home_screen
xattr -d com.apple.quarantine home_screen   # the beta builds are not notarised yet
./home_screen
```

## Docker

Prefer a container? See [Docker](/getting-started/docker/).

## Build it yourself

You need Rust (stable), Node.js 18 or newer and npm. From a clone of the repository:

```powershell
.\build.ps1
```

That builds the web interface, then the program, and copies the result to `dist\home_screen.exe`. Details are in [Tech stack and build](/reference/tech-stack/).

## Check that it works

Open <http://localhost:7878>. You should see an empty dashboard with an **Add tile** button. If not, see [Troubleshooting](/guides/troubleshooting/).
