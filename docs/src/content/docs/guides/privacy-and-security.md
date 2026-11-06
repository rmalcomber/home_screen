---
title: Privacy and security
description: What Home Screen contacts, what it stores, and how the local server is protected.
sidebar:
  order: 9
---

## Authentication

There is **no authentication**: anyone who can reach the port can edit your tiles. That is why the server binds to `127.0.0.1` only. Do not expose it to a network without putting something in front of it that handles authentication.

## Outside services

Only your browser contacts these, only when the feature is used:

| Service | For |
|---|---|
| `api.iconify.design` | Tile icons and icon search |
| `www.google.com/s2/favicons` | Link favicons (this tells Google the domains of your bookmarks) |
| `api.open-meteo.com`, `geocoding-api.open-meteo.com` | Weather widget |
| `api.frankfurter.dev` | Currency rates |

Everything else (JSON, JWT, hashes, regex, Markdown, QR codes, passwords, diffs and so on) is computed in your browser. Nothing you paste into a tool is sent to a server.

## The curl runner

The [curl runner](/launcher/curl/) makes the HTTP request from the **server**, because browsers cannot call arbitrary sites. It runs from your machine with your network access. The endpoint only accepts requests from this page opened via `localhost` or `127.0.0.1`: other websites, including DNS-rebinding tricks, get a `403`. Redirects are followed only with `-L`, and certificates are checked unless the command contains `-k`.

## What is saved

- JWTs, base64, hashes, JSON and Markdown are processed in your browser and are not sent to the server.
- Copied curl commands and JWTs appear in Recent, stored in your browser. See [Data and backup](/guides/data-and-backup/).
- Generated passwords and Wi-Fi QR codes are **never** saved to Recent or anywhere else.
- Uploaded SVG icons are cleaned and served with a restrictive content-security policy. Image uploads accept raster formats only.
- The Markdown previewer never inserts raw HTML. It is shown as text.
