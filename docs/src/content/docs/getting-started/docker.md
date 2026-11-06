---
title: Docker
description: Run Home Screen in a container.
sidebar:
  order: 5
---

:::caution[Provisional]
Docker images arrive with the first public release. The image name and flags below are placeholders until then.
:::

## Run it

```bash
docker run -d --name home-screen \
  -p 127.0.0.1:7878:7878 \
  -v home-screen-data:/data \
  ghcr.io/rmalcomber/home-screen:latest
```

Then open <http://localhost:7878>.

- `-p 127.0.0.1:7878:7878` publishes the port **only on your own machine**. Home Screen has no accounts, so do not publish it on `0.0.0.0` unless something in front of it handles authentication.
- `-v home-screen-data:/data` keeps the database in a Docker volume, so your tiles survive upgrades.

## Docker Compose

```yaml
services:
  home-screen:
    image: ghcr.io/rmalcomber/home-screen:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:7878:7878"
    volumes:
      - home-screen-data:/data
    # environment:
    #   HOME_SCREEN_LOCKED: "1"   # see Locked mode

volumes:
  home-screen-data:
```

## Upgrading

```bash
docker pull ghcr.io/rmalcomber/home-screen:latest
docker rm -f home-screen
# run the same docker run command again: the volume keeps your data
```

## Backups

Copy the database out of the volume:

```bash
docker cp home-screen:/data/home_screen.db ./home_screen.db
```

## Locked mode in a container

For a shared, read-only start page, set `HOME_SCREEN_LOCKED=1`. See [Locked mode](/getting-started/locked-mode/).
