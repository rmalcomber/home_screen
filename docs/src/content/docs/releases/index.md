---
title: Releases
description: Release notes for every version of Home Screen, mirrored from GitHub releases.
sidebar:
  order: 0
  label: All releases
---

Each version of Home Screen has a page here, and a matching release on GitHub where the downloads are attached.

:::note[GitHub releases]
Release pages will link to their GitHub release once the repository is public. For now the link points to a temporary address: [Releases on GitHub]({{releases}}).
:::

## Latest

| Version | Status | Highlights |
|---|---|---|
| [{{version}}](/releases/v0.1.0-beta/) | First beta | Dashboard, launcher with {{metric.tools}} tools, {{metric.widgets}} widgets, a {{metric.exe_size}} binary |

## How versions work

Home Screen follows [semantic versioning](https://semver.org). While it is `0.x` and tagged `beta`, anything can change between releases, including the database layout and the HTTP API. Release notes say when an upgrade needs attention. Back up `home_screen.db` before upgrading: see [Data and backup](/guides/data-and-backup/).
