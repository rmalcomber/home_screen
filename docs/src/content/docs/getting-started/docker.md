---
title: Docker
description: Run Home Screen in a container, on its own or behind Caddy with HTTPS and a password.
sidebar:
  order: 5
---

The image is built on Alpine and contains the Home Screen program, CA certificates and nothing else. There is **no SSH server** and no shell tooling beyond Alpine's BusyBox. It runs as an unprivileged user (uid 10001), and the same image works on Intel/AMD (`linux/amd64`) and Arm (`linux/arm64`).

Images are published to GitHub's container registry as `ghcr.io/rmalcomber/home_screen` with these tags:

| Tag | Meaning |
|---|---|
| `{{version}}` | exactly this release |
| `latest` | the most recent release (including betas, while there is no stable release) |

:::note
The first time a package is published, GitHub makes it private. If `docker pull` asks for a login, open the repository's **Packages**, choose the package, then **Package settings → Change visibility → Public**.
:::

## Run it

```bash
docker run -d --name home-screen \
  -p 127.0.0.1:7878:7878 \
  -v home-screen-data:/data \
  ghcr.io/rmalcomber/home_screen:{{version}}
```

Then open <http://localhost:7878>.

- `-p 127.0.0.1:7878:7878` publishes the port **only on your own machine**. Home Screen has no accounts, so do not publish it on `0.0.0.0` unless something in front of it handles authentication (see the Caddy example below).
- `-v home-screen-data:/data` keeps the database in a Docker volume, so your tiles survive upgrades.

## What the image sets

| Variable | Value in the image | Why |
|---|---|---|
| `HOME_SCREEN_HOST` | `0.0.0.0` | Listen on the container's network. Outside a container the default is `127.0.0.1`. |
| `HOME_SCREEN_DB` | `/data/home_screen.db` | The database lives on the volume. |
| `PORT` | `7878` | The port inside the container. |

Set `HOME_SCREEN_ALLOWED_HOSTS` to the name you reach the page by when it is not `localhost`, or the [curl runner](/launcher/curl/) will refuse to run (see [Options](/getting-started/options/#reaching-it-through-a-proxy-or-another-name)).

## Docker Compose

The repository has ready-made files in `docker/`.

### On its own

```bash
docker compose -f docker/compose.yml up -d
```

It publishes `127.0.0.1:7878`, stores data in a named volume, runs with a read-only filesystem and no extra Linux capabilities, and restarts unless stopped. Set `HOME_SCREEN_TAG=0.1.0-beta` to pin a version and `HOME_SCREEN_PORT` to use another host port.

### Behind Caddy, with HTTPS and basic authentication

`docker/compose.caddy.yml` puts [Caddy](https://caddyserver.com) in front. Only Caddy's ports 80 and 443 are published; Home Screen itself is reachable only through it, and Caddy asks for a user name and password first.

```bash
cd docker
cp env.example .env
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'a-long-password'
```

Put the hash it prints into `.env` as `BASIC_AUTH_HASH='…'` (keep the single quotes), then edit `SITE_ADDRESS`, `SITE_HOSTNAME` and `BASIC_AUTH_USER`:

```bash
docker compose -f compose.caddy.yml up -d
```

- With `SITE_ADDRESS=localhost` Caddy uses its own local certificate, so the browser warns once. Open <https://localhost>.
- With a real name that points at the machine, for example `SITE_ADDRESS=home.example.com`, Caddy fetches and renews a Let's Encrypt certificate by itself. Ports 80 and 443 must be reachable from the internet for that.
- Compose refuses to start if `BASIC_AUTH_HASH` is empty, so it cannot come up open by mistake.

### Building from source

To build the image from a checkout instead of pulling it:

```bash
docker compose -f docker/compose.yml -f docker/compose.build.yml up -d --build
# or just the image:
docker build -t home-screen .
```

The Dockerfile builds the web interface and the program inside the build, so nothing else needs to be installed. A first build takes a few minutes.

## Ping and traceroute in a container

The [network tools](/launcher/network/) send ICMP without root, which Linux allows for groups listed in the `net.ipv4.ping_group_range` setting. Current Docker versions set it for containers, so ping and traceroute work in the image as it is. If your host has narrowed it, ping falls back to TCP connect time and traceroute explains that it cannot read the replies; you can widen the range for a container with `--sysctl net.ipv4.ping_group_range="0 2147483647"`. DNS lookups need nothing special.

## Upgrading

```bash
docker pull ghcr.io/rmalcomber/home_screen:{{version}}
docker rm -f home-screen
# run the same docker run command again: the volume keeps your data
```

With Compose: `docker compose -f docker/compose.yml pull && docker compose -f docker/compose.yml up -d`.

## Backups

Copy the database out of the volume:

```bash
docker cp home-screen:/data/home_screen.db ./home_screen.db
```

## Without Docker on your own machine

You never need Docker locally to publish the image: the release workflow builds and pushes it from GitHub. See [Releasing](/reference/releasing/).

:::caution[Provisional]
Locked (read-only) mode is not in the program yet. When it ships, set `HOME_SCREEN_LOCKED=1` in the container. See [Locked mode](/getting-started/locked-mode/).
:::
