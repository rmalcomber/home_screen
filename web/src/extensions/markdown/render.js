// Turns Markdown tokens into Preact nodes (kept apart from engine.js so the engine stays free of UI).
import { h, Fragment } from 'preact'
import { safeUrl, slugify } from './engine.js'

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
