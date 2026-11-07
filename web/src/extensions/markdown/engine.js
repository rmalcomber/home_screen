// Markdown → Preact vnodes for the launcher / widget previewer.
// `marked` only tokenises (Lexer); the tokens are turned into elements here, so no HTML string is ever injected:
// raw HTML in the source is shown as text, and link/image URLs are filtered. Unit tested in md.test.js.
import { Lexer } from 'marked'

export const parseMarkdown = (src) => Lexer.lex(src || '')

const LINK_OK = /^(?:https?|mailto|tel):/i
const IMG_OK = /^(?:https?:|data:image\/(?:png|gif|jpe?g|webp);base64,)/i

/** Returns the URL if it is safe to use, else null. Relative paths and #anchors are fine; javascript:, data:text/html… are not. */
export function safeUrl(href, { image = false } = {}) {
  const u = (href || '').trim().replace(/[\u0000-\u001f\u007f\s]+/g, (m) => (m.includes(' ') ? ' ' : ''))
  if (!u) return null
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) return u.startsWith('//') ? null : u // relative, #anchor, /path
  return (image ? IMG_OK : LINK_OK).test(u) ? u : null
}

export const slugify = (s) => s.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')

/** Counts for the status line. */
export function docStats(text) {
  const words = (text.match(/\S+/g) || []).length
  return { words, chars: text.length, lines: text ? text.split(/\r?\n/).length : 0, minutes: Math.max(1, Math.ceil(words / 230)) }
}

/** A standalone HTML page for download (the body is the already-rendered, already-safe markup). */
export function htmlDocument(title, bodyHtml) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#222}pre{background:#f4f4f4;padding:.8em 1em;border-radius:6px;overflow:auto}code{background:#f4f4f4;padding:.1em .3em;border-radius:4px;font-family:ui-monospace,monospace}pre code{background:none;padding:0}blockquote{border-left:4px solid #ccc;margin:1em 0;padding:.1em 1em;color:#555}table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:.3em .7em}img{max-width:100%}hr{border:0;border-top:1px solid #ccc}</style>
</head><body>
${bodyHtml}
</body></html>
`
}

/** "md <text>" / "markdown <text>" → { text } | null */
export function parseMarkdownCommand(q) {
  const m = /^\s*(?:markdown|md)(?:[ \t]+|\r?\n|$)([\s\S]*)$/i.exec(q || '')
  return m ? { text: m[1] } : null
}

export const mdFill = (text) => `md ${text}`

export const SAMPLE = `# Markdown preview

Write **bold**, *italic*, ~~strikethrough~~ and \`inline code\`, or add a [link](https://example.com).

## A list

- [x] Task lists
- [ ] Tables and code blocks
  - nested items

1. Ordered lists
2. Work too

> Blockquotes look like this.

| Name | Value |
|:-----|------:|
| Left | Right |

\`\`\`js
const hello = (name) => \`Hello, \${name}!\`
\`\`\`
`
