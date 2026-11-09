---
title: Contributing
description: How to build, test and send a change to Home Screen.
sidebar:
  order: 1
---

Contributions are welcome. The repository's `CONTRIBUTING.md` is the source of truth; this is the summary.

## Before you start

Home Screen is one small program with no accounts and no cloud, and it aims to stay that way: see [Binary size](/reference/binary-size/) and the [Floppy Rule](https://malcomber.com/floppy-rule/). A change that adds a dependency or noticeably grows the binary or the first page load needs a good reason. For anything bigger than a fix, open an [issue]({{repo}}/issues) first.

## Build and run

Requirements: Rust (stable), Node.js 18+ and npm. The full steps are in [Tech stack and build](/reference/tech-stack/).

```bash
# terminal 1: the server (run `npm run build` in web/ once first)
cargo run

# terminal 2: the web app with hot reload; /api is proxied to the server on :7878
cd web
npm install
npm run dev
```

On Windows `./build.ps1` makes a release build in `dist/`.

## Test

```bash
cargo test              # database layer, server and SVG sanitiser
cd web
npm test                # parsers, converters, launcher logic (Vitest)
npm run audit:css       # the CSS audit the release workflow also runs
```

Please run all three before opening a pull request.

## Adding a widget or a launcher tool

Every widget and tool is an extension: a folder in `web/src/extensions/`. See [Extending Home Screen](/reference/extending/). Pure logic goes in `engine.js` with unit tests.

## Pull requests

- Branch from `main` and open the pull request against `main`.
- Keep it focused: one change per pull request.
- Add or update tests for behaviour changes.
- Update the docs when behaviour changes (they live in `docs/`).
- Mention any change to binary size or page weight.

## Working on the docs

```bash
cd docs
npm install
npm run dev
npm run build     # also fails on broken internal links
```

## Releases

Maintainers cut releases: see [Releasing](/reference/releasing/).

## Funding

- [GitHub Sponsors](https://github.com/sponsors/rmalcomber)
- [Buy Me a Coffee](https://buymeacoffee.com/rmalcomber)
