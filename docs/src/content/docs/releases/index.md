---
title: Releases
description: Release notes for every version of Home Screen, mirrored from GitHub releases.
sidebar:
  order: 0
  label: All releases
---

Each version of Home Screen has a page here, and a matching release on GitHub where the downloads are attached.

:::note[GitHub releases]
Every release page mirrors its GitHub release, which is where the downloads are attached: [Releases on GitHub]({{releases}}).
:::

## Latest

| Version | Status | Highlights |
|---|---|---|
| [0.3.0-beta](/releases/v0.3.0-beta/) | Latest beta | Ten new tools: URL, YAML/TOML, bases, CIDR, chmod, text case, HTTP reference, Open Graph, web search, Can I use |
| [0.2.2-beta](/releases/v0.2.2-beta/) | Previous beta | Widgets and tools load on demand: a 65% lighter first page load |
| [0.2.1-beta](/releases/v0.2.1-beta/) | Beta | A 1.0 MB Windows binary: 55% smaller, no behaviour change you will notice in the app |
| [0.2.0-beta](/releases/v0.2.0-beta/) | Beta | Groups, colours, pages, layout modes, auto-arrange, starter templates |
| [0.1.0-beta](/releases/v0.1.0-beta/) | First beta | Dashboard, launcher with {{metric.tools}} tools, {{metric.widgets}} widgets, a {{metric.exe_size}} binary |

## How versions work

Home Screen follows [semantic versioning](https://semver.org). While it is `0.x` and tagged `beta`, anything can change between releases, including the database layout and the HTTP API. Release notes say when an upgrade needs attention. Back up `home_screen.db` before upgrading: see [Data and backup](/guides/data-and-backup/).
