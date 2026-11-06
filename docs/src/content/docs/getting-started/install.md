---
title: Install
description: Download Home Screen and run it on Windows, Linux or macOS.
sidebar:
  order: 1
---

Home Screen is one program. There is nothing to install first: no runtime, no database, no browser extension.

## Downloads

Every [release]({{releases}}) has one file per platform, plus `SHA256SUMS`:

| Platform | File |
|---|---|
| Windows, 64-bit | `home_screen-v{{version}}-windows-x64.zip` |
| Linux, 64-bit Intel/AMD | `home_screen-v{{version}}-linux-x64.tar.gz` |
| Linux, 64-bit Arm (Raspberry Pi 4/5, Graviton) | `home_screen-v{{version}}-linux-arm64.tar.gz` |
| macOS, Apple silicon | `home_screen-v{{version}}-macos-arm64.tar.gz` |
| macOS, Intel | `home_screen-v{{version}}-macos-x64.tar.gz` |

Each archive holds the program and a copy of the README. To check a download, compare it with the matching line in `SHA256SUMS`: `sha256sum -c --ignore-missing SHA256SUMS` on Linux, `shasum -a 256 -c --ignore-missing SHA256SUMS` on macOS, or `Get-FileHash` in PowerShell.

## Windows

1. Download the Windows `.zip` from the [releases page]({{releases}}) and unzip `home_screen.exe` into a folder you will keep, for example `C:\Tools\HomeScreen\`.
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

The Linux builds are static (musl): one file, no libraries to install, and they run on any distribution.

```bash
curl -L -o home_screen.tar.gz {{releases}}/download/v{{version}}/home_screen-v{{version}}-linux-x64.tar.gz   # linux-arm64 on Arm
tar -xzf home_screen.tar.gz home_screen
./home_screen
```

It prints the same address, `http://localhost:7878`. To run it in the background, use a systemd user service (adjust the paths):

```ini
# ~/.config/systemd/user/home-screen.service
[Unit]
Description=Home Screen

[Service]
ExecStart=%h/bin/home_screen --db %h/.local/share/home-screen/home_screen.db
Restart=on-failure

[Install]
WantedBy=default.target
```

```bash
mkdir -p ~/.local/share/home-screen
systemctl --user enable --now home-screen
```

## macOS

Use the `macos-arm64` file on Apple silicon (M1 and later) and `macos-x64` on Intel Macs.

```bash
curl -L -o home_screen.tar.gz {{releases}}/download/v{{version}}/home_screen-v{{version}}-macos-arm64.tar.gz
tar -xzf home_screen.tar.gz home_screen
./home_screen
```

The builds are **not signed or notarised**. If you downloaded the file in a browser, macOS marks it as quarantined and refuses to open it. Clear the mark once with:

```bash
xattr -d com.apple.quarantine home_screen
```

Files fetched with `curl`, as above, are not quarantined.

## Docker

Prefer a container? See [Docker](/getting-started/docker/).

## Build it yourself

You need Rust (stable), Node.js 18 or newer and npm. From a clone of the repository:

```powershell
.\build.ps1
```

That builds the web interface, then the program, and copies the result to `dist\home_screen.exe`. On Linux or macOS, run `npm ci && npm run build` in `web/`, then `cargo build --release` in the repository root. Details are in [Tech stack and build](/reference/tech-stack/).

## Check that it works

Open <http://localhost:7878>. You should see an empty dashboard with an **Add tile** button. If not, see [Troubleshooting](/guides/troubleshooting/).
