---
title: Troubleshooting
description: Fixes for the most common problems.
sidebar:
  order: 10
---

## "Failed to fetch" in the page

The program is not running, or it is on a different port. Start `home_screen.exe`.

## "Cannot bind 127.0.0.1:7878"

Something else is using the port, or a second copy is running. Use `--port`: see [Options](/getting-started/options/).

## A new version does not show up

Hard-refresh with <kbd>Ctrl</kbd>+<kbd>F5</kbd>. The program also has to be restarted after you replace the file. On Windows you cannot overwrite the exe while it runs: stop it first.

## <kbd>Ctrl</kbd>+<kbd>P</kbd> opens Chrome's print dialog

Click into the page first so it has focus. Home Screen overrides the shortcut only while the page is focused.

## Icons, favicons or weather are missing

They need internet access. See [Privacy and security](/guides/privacy-and-security/) for the services involved.

## The curl runner says it only works via localhost

Open the app as `http://localhost:7878` or `http://127.0.0.1:7878`, not via another host name.

## My layout disappeared

Your data lives in `home_screen.db` next to the program. Make sure you started the copy that has your database, or pass `--db`. See [Data and backup](/guides/data-and-backup/).

## The menu or a dialog looks wrong

Hard-refresh. If it persists, [open an issue]({{repo}}/issues) (temporary link) with a screenshot and your browser version.
