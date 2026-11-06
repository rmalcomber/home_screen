// Markdown → Preact vnodes for the launcher / widget previewer.
// `marked` only tokenises (Lexer); the tokens are turned into elements here, so no HTML string is ever injected:
// raw HTML in the source is shown as text, and link/image URLs are filtered. Unit tested in md.test.js.
import { h, Fragment } from 'preact'
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

const plain = (tokens = []) => tokens.map((t) => (t.tokens ? plain(t.tokens) : t.text ?? '')).join('')

/**
 * Render tokens. Returns { nodes, raw } where raw counts raw-HTML snippets that were shown as text.
 */
export function renderMarkdown(tokens) {
  const slugs = new Map()
  let raw = 0

  const inline = (ts = []) =>
    ts.map((t, i) => {
      const key = i
      switch (t.type) {
        case 'text':
        case 'escape':
          return t.tokens ? inline(t.tokens) : t.text
        case 'strong': return h('strong', { key }, inline(t.tokens))
        case 'em': return h('em', { key }, inline(t.tokens))
        case 'del': return h('del', { key }, inline(t.tokens))
        case 'codespan': return h('code', { key }, t.text)
        case 'br': return h('br', { key })
        case 'link': {
          const href = safeUrl(t.href)
          return href
            ? h('a', { key, href, title: t.title || undefined, target: href.startsWith('#') ? undefined : '_blank', rel: 'noopener noreferrer' }, inline(t.tokens))
            : h('span', { key, title: 'Link removed: unsafe address' }, inline(t.tokens))
        }
        case 'image': {
          const src = safeUrl(t.href, { image: true })
          return src ? h('img', { key, src, alt: t.text, title: t.title || undefined, loading: 'lazy' }) : h('span', { key, class: 'md-raw' }, `[image: ${t.text || 'removed'}]`)
        }
        case 'html': raw++; return t.raw ?? t.text
        default: return t.raw ?? t.text ?? ''
      }
    })

  const item = (li, key) =>
    h(
      'li',
      { key, class: li.task ? 'md-task' : undefined },
      li.tokens.map((t, i) => (t.type === 'checkbox' ? h('input', { key: 'cb', type: 'checkbox', checked: !!t.checked, disabled: true }) : block([t], i))),
    )

  const cell = (c, tag, key) => h(tag, { key, style: c.align ? { textAlign: c.align } : undefined }, inline(c.tokens))

  const block = (ts, base = 0) =>
    ts.map((t, i) => {
      const key = base + i
      switch (t.type) {
        case 'space': return null
        case 'heading': {
          const text = plain(t.tokens)
          const slug = slugify(text) || 'section'
          const n = slugs.get(slug) ?? 0
          slugs.set(slug, n + 1)
          return h(`h${t.depth}`, { key, id: n ? `${slug}-${n}` : slug }, inline(t.tokens))
        }
        case 'paragraph': return h('p', { key }, inline(t.tokens))
        case 'text': return h(Fragment, { key }, t.tokens ? inline(t.tokens) : t.text) // tight list items: no <p>, so checkboxes sit on the text's line
        case 'blockquote': return h('blockquote', { key }, block(t.tokens))
        case 'code': return h('pre', { key, 'data-lang': t.lang || undefined }, h('code', { class: t.lang ? `language-${t.lang}` : undefined }, t.text))
        case 'hr': return h('hr', { key })
        case 'list': {
          const tag = t.ordered ? 'ol' : 'ul'
          const tasks = t.items.some((li) => li.task)
          return h(tag, { key, start: t.ordered && t.start !== 1 && t.start !== '' ? t.start : undefined, class: tasks ? 'md-tasks' : undefined }, t.items.map(item))
        }
        case 'table':
          return h('table', { key }, h('thead', null, h('tr', null, t.header.map((c, k) => cell(c, 'th', k)))), h('tbody', null, t.rows.map((r, ri) => h('tr', { key: ri }, r.map((c, k) => cell(c, 'td', k))))))
        case 'html': raw++; return h('p', { key, class: 'md-raw' }, (t.raw ?? t.text).trim())
        case 'def': return null
        default: return t.tokens ? h('div', { key }, block(t.tokens)) : null
      }
    })

  return { nodes: block(tokens), raw }
}

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
