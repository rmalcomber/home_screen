---
title: Roadmap
description: Ideas for where Home Screen could go next. Nothing here is a promise.
---

:::note[Ideas, not commitments]
This is a thinking-out-loud list. Items may change, move or never happen. What exists today is documented in the rest of this site; the [release notes](/releases/) list what actually shipped.
:::

## More launcher tools

The launcher is the easiest thing to extend, and these are the small utilities most likely to save a trip to a random website:

- **URL and HTML encode / decode**, including query-string parsing into a table.
- **JSON ⇄ YAML** (and TOML) conversion.
- **Number bases and bit tools**: hex, binary, octal, byte sizes and bit flags.
- **IP and CIDR calculator**: ranges, masks, hosts and overlap checks.
- **`chmod` calculator**: octal ⇄ symbolic permissions.
- **Text case and slug tools**: camelCase, snake_case, kebab-case, slugify, word and line counts.
- **HTTP status code lookup**, and header and MIME-type lookup.
- **Bookmark link checker**: find dead or redirected links in your tiles.

Each would also become a widget, as every launcher tool already is.

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
