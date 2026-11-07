---
title: Roadmap
description: Ideas for where Home Screen could go next. Nothing here is a promise.
---

:::note[Ideas, not commitments]
This is a thinking-out-loud list. Items may change, move or never happen. What exists today is documented in the rest of this site; the [release notes](/releases/) list what actually shipped.
:::

## More launcher tools

The everyday developer utilities are now built in: URL and HTML encoding, JSON, YAML and TOML conversion, number bases and bit tools, IP and CIDR maths, `chmod`, text case and counts, an HTTP reference, an Open Graph viewer, web search shortcuts and Can I use. See [The launcher](/launcher/). What is next:

- **Bookmark link checker**: find dead or redirected links in your tiles. Planned for the next release.
- **Your own search engines**: add a keyword and a URL with `%s` in Settings, next to the built-in [web search](/launcher/web-search/) list.
- **Can I use offline from the first run**: today the data is downloaded the first time and kept in the browser. A bundled copy would work from the start but would make the program several hundred kilobytes larger.

Each new tool would also become a widget, as every launcher tool already is.

## Profiles for different users

Today there is one dashboard per database. Profiles would give each person their own tiles, layout, background and settings:

- Switch profile from the launcher or the menu.
- One database, or one file per profile, so backups stay simple.
- A shared profile that others can use read-only (see [Locked mode](/getting-started/locked-mode/)).

Profiles would be about **separate dashboards**, not security: real access control would need proper sign-in, which is a separate piece of work.

## Host-runnable commands

Let the launcher run **command-line programs on the machine hosting Home Screen**, for example `ffmpeg` to convert a video, or a script you use every week.

The idea:

- Commands are **declared in a configuration file** by you, as an allow-list, with named arguments (`ffmpeg-gif {input} {output}`). The launcher can only run what you declared.
- A panel shows live output, the exit code and how long it took, with a timeout and a way to cancel.
- Nothing runs in locked mode unless that command is explicitly marked as allowed there.

Because this lets a web page start programs, it needs careful design before anything is built: allow-list only, local origin only, no shell interpolation of user text, and clear logging.

## Have an idea?

Open an issue on [GitHub]({{repo}}/issues) (temporary link) and say what you reach for that Home Screen does not have yet.
