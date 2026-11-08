---
title: Tool widgets
description: Every launcher tool as a tile on your dashboard.
sidebar:
  order: 9
---

Every [launcher](/launcher/) tool is also a widget. A tool widget hosts the same engine as the launcher, with a **text box on top** and the **result below**. Click a result to copy it.

![A hash generator widget showing MD5, SHA-1 and SHA-256 of the text typed into its box.](../../../assets/screenshots/widget-tool-hash.webp)

![A JSON formatter widget showing a pretty-printed result under its input box.](../../../assets/screenshots/widget-tool-json.webp)

## The tool widgets

| Category | Widgets |
|---|---|
| Calculators and converters | [Calculator](/launcher/calculator/) · [Unit converter](/launcher/units/) · [Currency converter](/launcher/currency/) · [Number base converter, byte size converter and bit calculator](/launcher/bases/) |
| Time | [Timestamp converter](/launcher/timestamp/) · [Cron explainer](/launcher/cron/) |
| Security and encoding | [Password generator](/launcher/password/) · [Hash generator](/launcher/hash/) · [Base64](/launcher/base64/) · [UUID generator](/launcher/uuid/) · [JWT decoder](/launcher/jwt/) |
| Developer tools | [Curl runner](/launcher/curl/) · [JSON formatter](/launcher/json/) · [Regex tester](/launcher/regex/) · [Text diff](/launcher/diff/) · [CSV ⇄ JSON](/launcher/csv/) · [JSON ⇄ YAML and JSON ⇄ TOML](/launcher/yaml/) · [chmod and umask calculators](/launcher/chmod/) · [Text case converter](/launcher/text-case/) |
| Web and network | [URL encoder and parser, HTML entities](/launcher/url/) · [IP and CIDR calculator](/launcher/cidr/) · [HTTP status codes, headers and MIME types](/launcher/http-reference/) · [Open Graph viewer](/launcher/open-graph/) · [Web search](/launcher/web-search/) · [Can I use](/launcher/caniuse/) |
| Media and design | [QR code generator](/launcher/qr/) · [Lorem ipsum](/launcher/lorem/) |
| Notes | [Markdown previewer](/launcher/markdown/) · [Word and line counter](/launcher/text-case/) |

The colour tool is the separate [Colour picker widget](/widgets/colour-picker/).

## Good to know

- **Generators** (password, UUID, lorem ipsum) show results straight away and have a **↻** button to make new values.
- **What you type is not saved.** A tool box can contain tokens, JSON or commands, so it is empty after a reload.
- **Open a file instead of typing.** The JSON, YAML/TOML, CSV, URL and HTML widgets have an **Open file…** button, and you can also drop a file onto the box. The file's text is put in the box, as if you had pasted it. Files up to 1 MB are accepted, and they must be UTF-8 text. The text diff has the same button above each side; drop two files on it to fill **Original** and **Changed** together. The **Hash** and **Base64** widgets take any file, up to 20 MB, and work on its raw bytes, so the hash matches what `sha256sum` or `certutil` gives for the file. Files are read in your browser and never uploaded.
- **Fetching tools** (Open Graph viewer, Can I use) wait for a button or <kbd>Ctrl</kbd>+<kbd>Enter</kbd> where they would otherwise fetch on every keystroke, and say so in the tile.
- **Keyboard shortcuts** only apply while focus is inside that widget, and they use <kbd>Ctrl</kbd>+<kbd>Enter</kbd>, because plain <kbd>Enter</kbd> stays free for typing.
- Tools that need space, such as the regex tester and text diff, work best in a wide tile. Resize freely.
