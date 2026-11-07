---
title: Binary size
description: How the Windows executable went from 2.36 MB to about 1.0 MB, what is left in it, and what that cost.
sidebar:
  order: 3
---

The goal was a Windows executable small enough for a 1.44 MB floppy disk (1,474,560 bytes). Nobody will put Home Screen on a floppy, but a hard limit is a good way to find out what a program is really made of.

| Step | Executable | Saved |
|---|---:|---:|
| Version 0.2.0-beta, as released | 2,356,224 bytes | |
| Trim SQLite | 1,931,776 | 424,448 |
| Embed the web app as ready-gzipped files | 1,709,056 | 222,720 |
| Our own HTTP client for the curl runner | 1,455,104 | 253,952 |
| Our own HTTP server | 1,089,536 | 365,568 |
| Fewer daisyUI styles, a few more SQLite options | 1,063,936 | 25,600 |
| Web app split into lazy-loaded extensions | 1,083,392 | -19,456 (larger) |
| Ten more launcher tools, as extensions | **1,129,472** | -46,080 (larger) |

That is **52% smaller**, and about 345,000 bytes under the floppy limit. The numbers are for the 64-bit Windows build made by `build.ps1`. The last two steps make the program larger on purpose: splitting the web app into separate scripts (see below) makes the first page load much lighter, and the ten new tools are new code.

## What is in it now

`node scripts/size-report.mjs` builds the program and attributes every symbol to the library or crate it came from. For the current build:

| Part | Size | Share |
|---|---:|---:|
| SQLite (C) | 523 KB | 49% |
| The web app and other constants and strings | 239 KB | 22% |
| Home Screen's own code | 94 KB | 9% |
| The Rust standard library (`core`, `std`, `alloc`) | 100 KB | 9% |
| `serde_json` | 22 KB | 2% |
| Everything else (TLS bindings, Windows imports, panic and unwind tables, 18 small crates) | about 85 KB | 8% |

More than half the program is the database engine. The rest of what remains is mostly needed: the interface itself (about 190 KB of gzipped JavaScript and CSS, in 41 files), the standard library and the JSON code.

## What changed, and what it cost

**SQLite.** The bundled SQLite was built with full-text search, an R-tree, JSON, extension loading, window-function support tables and about thirty other options switched on. Home Screen uses none of them. `.cargo/config.toml` turns them off through `LIBSQLITE3_FLAGS`, and the file lists the few options that cannot be omitted because they do not compile on Windows. The database file format is unchanged, so existing databases open as before. The cost: SQLite features Home Screen does not use are gone.

**The web app.** `web/scripts/pack.mjs` writes a maximum-compression gzip copy of every built file, `build.rs` includes those bytes, and the server sends them unchanged with `Content-Encoding: gzip`. That removed `rust-embed`, its compression library and the `zstd` C library (which was linked with decoders for seven old formats). The cost: a client that does not accept gzip, such as plain `curl`, gets a `406` with an explanation (`curl --compressed` works). Every browser accepts gzip.

**The curl runner's HTTP client.** `ureq` brought in a general URL parser, which brought in internationalised-domain handling and its Unicode tables, for a feature the runner does not need. `src/http_client.rs` does what the runner uses: http and https, any method, headers, a text body, redirects, chunked responses and a time limit. The cost: host names with non-ASCII characters must be written in their `xn--` form, there is no HTTP proxy support and compressed responses are not unpacked. It does not forward `Authorization` or `Cookie` headers to a different site when following a redirect.

**The server.** axum, hyper, tokio, tower and about thirty supporting crates served about fifteen routes on a local port. `src/server.rs` is about 400 lines on `std::net`: a thread per connection, keep-alive, and deliberately narrow parsing. It refuses chunked uploads, duplicate or non-numeric `Content-Length`, folded headers, bare line feeds, control characters and unknown HTTP versions. It limits the request line and headers to 16 KB, the body to 8 MiB, connections to 64, idle time to 30 seconds and the time to deliver a request to 15 seconds. A suite of tests over real sockets covers every one of those limits. JSON requests must still be sent as `application/json`, which is what stops other websites from posting to the API.

**The web app in pieces.** Widgets and launcher tools are now [extensions](/reference/extending/), and each one is its own JavaScript file that the browser fetches when it is first needed. The file every page loads shrank from 321 KB to 122 KB (110 KB to 42 KB gzipped), even with ten more tools added since. The split itself made the program about 19 KB larger, because small files compress a little worse than one large one (each is gzipped on its own) and each carries a few bytes of overhead; the ten new tools added 46 KB more. The cost: a few extra requests the first time a widget or the launcher is used, all served from the program itself.

**The styles.** daisyUI emits the CSS for every component it ships. The ones nothing uses are now excluded, and `npm run audit:css` (part of the release workflow) fails if a class the interface uses is ever dropped.

## What is not in it, and could still shrink

These are the levers that were considered and left alone, with the saving they would give:

| Lever | Roughly | Why not |
|---|---:|---|
| Replace SQLite with a hand-written file store | 400-500 KB | It would end the SQLite file format that backups and the docs rely on |
| Build the standard library without panic and formatting machinery (nightly Rust) | 100-200 KB | Needs a pinned nightly toolchain |
| Pack the executable with UPX | about half | Antivirus tools dislike packed programs and it does not work well on macOS |
| Replace `marked` (the Markdown tokenizer) with a small hand-written one | about 11 KB of gzipped script | Not worth the regression risk for 1% |

The JavaScript has some small duplication (seven near-identical copy-to-clipboard helpers, two `Field` and two `Section` components). Tidying it would save well under 1 KB gzipped, so it was left.

## Other platforms

The floppy limit is a Windows target. The macOS build uses the system's own TLS library like Windows does and is about the same size. The Linux build compiles OpenSSL in so that it runs on any distribution, and that makes it several times larger; it is not part of this goal.

## Measuring it yourself

```powershell
node scripts/size-report.mjs              # build, then report (needs the MSVC linker)
node scripts/size-report.mjs --no-build   # report on the last build
node scripts/size-report.mjs --sqlite     # which SQLite features cost what
```

The report is written for the 64-bit Windows build. It prints the exe size against the floppy limit, the change since the last run, and a table by library and crate. Because it reads the linker's map file, it needs nothing installed beyond the normal build tools.
