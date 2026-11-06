---
title: Set it as your home page
description: Make Chrome open Home Screen for the home button and on start-up.
sidebar:
  order: 3
---

Home Screen is a normal web page served from your machine, so any browser can use it. These steps are for Chrome; other browsers have equivalent settings.

## The home button

1. Open **Settings → Appearance**.
2. Turn on **Show home button**.
3. Choose **Enter custom web address** and enter `http://localhost:7878`.

## When Chrome starts

1. Open **Settings → On startup**.
2. Choose **Open a specific page or set of pages**.
3. Add `http://localhost:7878`.

## New tabs

Chrome does not allow a normal setting to replace the New Tab page. If you want Home Screen on every new tab, use a small "new tab redirect" extension of your choice and point it at `http://localhost:7878`, or just use the home button (<kbd>Alt</kbd>+<kbd>Home</kbd>).

## Tips

- Use `localhost` or `127.0.0.1` consistently. The address is part of where your browser stores the launcher's history, and the [curl runner](/launcher/curl/) only works from those two addresses.
- If you change the port ([options](/getting-started/options/)), update the address here, or Chrome will show an error page.
- If the program is not running, the page will not load. [Start it with Windows](/getting-started/install/#start-it-with-windows) so it is always there.
