---
title: Privacy and security
description: What Home Screen contacts, what it stores, and how the local server is protected.
sidebar:
  order: 11
---

## Authentication

There is **no authentication**: anyone who can reach the port can edit your tiles. That is why the server binds to `127.0.0.1` only by default. If you listen on other addresses (`--host`, or the Docker image), do not expose it to a network without putting something in front of it that handles authentication. The [Docker](/getting-started/docker/) page has a Compose file with Caddy, HTTPS and basic authentication.

## Outside services

Only your browser contacts these, only when the feature is used:

| Service | For |
|---|---|
| `api.iconify.design` | Tile icons and icon search |
| `www.google.com/s2/favicons` | Link favicons (this tells Google the domains of your bookmarks) |
| `api.open-meteo.com`, `geocoding-api.open-meteo.com` | Weather widget |
| `api.frankfurter.dev` | Currency rates |
| `raw.githubusercontent.com` | The [Can I use](/launcher/caniuse/) data, downloaded once and kept in your browser |
| The site you ask about | The preview picture of the [Open Graph viewer](/launcher/open-graph/), after you press Fetch |

Everything else (JSON, YAML, JWT, hashes, regex, Markdown, QR codes, passwords, diffs, subnets and so on) is computed in your browser. Nothing you paste into a tool is sent to a server, apart from the address you give the curl runner or the Open Graph viewer.

The [web search](/launcher/web-search/) shortcuts only build an address: the search engine you choose sees your search when the new tab opens, and nothing is sent before you press <kbd>Enter</kbd>.

## The curl runner and the Open Graph viewer

[Clean up links](/guides/clean-up/) uses the same endpoint to check your saved links, but only when you press **Check links**: your Home Screen server sends a `HEAD` (and a `GET` if the site dislikes `HEAD`) to each saved address, five at a time, identified as `HomeScreen-LinkCheck`. The sites you saved will see those requests from your machine. Duplicate finding and the tidy-ups happen in your browser. Addresses on your own network are not sent anywhere.

The [ping, traceroute and DNS tools](/launcher/network/) also run from the **server**, only when you press Enter or the button, and only to the host you name. They use the same protection as the runner (our own page only, `403` for anything else), accept only host names and IP addresses, and cap probes, hops and time. DNS questions go to this machine's own resolvers unless you choose one with `@address`.

The [Open Graph viewer](/launcher/open-graph/) fetches the page you name through the same endpoint as the [curl runner](/launcher/curl/), with the same limits and protection, but only when you press Fetch. The [curl runner](/launcher/curl/) makes the HTTP request from the **server**, because browsers cannot call arbitrary sites. It runs from your machine with your network access. The endpoint only accepts requests from this page opened via `localhost`, `127.0.0.1` or a host name you listed in `--allowed-hosts` (see [Options](/getting-started/options/#reaching-it-through-a-proxy-or-another-name)): other websites, including DNS-rebinding tricks, get a `403`. Anyone who can use the page can use the runner, so on a shared server keep authentication in front of it: the server can reach whatever your network can. Redirects are followed only with `-L`, and certificates are checked unless the command contains `-k`.

## What is saved

- JWTs, base64, hashes, JSON and Markdown are processed in your browser and are not sent to the server. The same goes for files you open or drop onto a tool widget: they are read by your browser and not uploaded.
- Copied curl commands and JWTs appear in Recent, stored in your browser. See [Data and backup](/guides/data-and-backup/).
- Generated passwords and Wi-Fi QR codes are **never** saved to Recent or anywhere else.
- Uploaded SVG icons are cleaned and served with a restrictive content-security policy. Image uploads accept raster formats only.
- The Markdown previewer never inserts raw HTML. It is shown as text.
