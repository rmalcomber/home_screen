import { describe, it, expect } from 'vitest'
import { render } from 'preact'
import { parseMarkdown, safeUrl, slugify, docStats, htmlDocument, parseMarkdownCommand, SAMPLE } from './engine.js'
import { renderMarkdown } from './render.js'

const html = (src) => {
  const el = document.createElement('div')
  const { nodes, raw } = renderMarkdown(parseMarkdown(src))
  render(nodes, el)
  return { html: el.innerHTML, raw, el }
}

describe('rendering', () => {
  it('renders inline formatting', () => {
    expect(html('**b** *i* ~~d~~ `c<d` a & b').html).toBe('<p><strong>b</strong> <em>i</em> <del>d</del> <code>c&lt;d</code> a &amp; b</p>')
  })
  it('renders headings with unique anchor ids', () => {
    const { el } = html('# Hello World\n\n## Hello World\n\n### Ünïcode & Symbols!')
    expect([...el.querySelectorAll('h1,h2,h3')].map((h) => h.id)).toEqual(['hello-world', 'hello-world-1', 'ünïcode-symbols'])
  })
  it('renders lists, task lists and ordered starts', () => {
    const { el } = html('- [x] done\n- [ ] todo\n  - nested\n\n3. three\n4. four')
    expect(el.querySelectorAll('ul.md-tasks input[type=checkbox]')).toHaveLength(2)
    expect(el.querySelector('ul.md-tasks input').checked).toBe(true)
    expect(el.querySelector('input').disabled).toBe(true)
    expect(el.querySelector('ul ul li').textContent).toBe('nested')
    expect(el.querySelector('ol').getAttribute('start')).toBe('3')
    expect(el.querySelector('li.md-task').innerHTML).toBe('<input type="checkbox" disabled="">done')
    expect(el.querySelector('li.md-task p')).toBeNull() // tight list: text is not wrapped in a paragraph
  })
  it('renders tables with alignment', () => {
    const { el } = html('| a | b |\n|:--|--:|\n| 1 | 2 |')
    expect(el.querySelectorAll('thead th')).toHaveLength(2)
    expect(el.querySelector('th:nth-child(2)').style.textAlign).toBe('right')
    expect(el.querySelector('td').textContent).toBe('1')
  })
  it('renders code blocks, quotes, rules and line breaks', () => {
    const { el } = html('```js\nlet x = 1 < 2\n```\n\n> quoted\n\n---\n\nline one  \nline two')
    expect(el.querySelector('pre[data-lang=js] code.language-js').textContent).toBe('let x = 1 < 2')
    expect(el.querySelector('blockquote p').textContent).toBe('quoted')
    expect(el.querySelector('hr')).toBeTruthy()
    expect(el.querySelector('br')).toBeTruthy()
  })
  it('handles a document full of everything without throwing', () => {
    const { el, raw } = html(SAMPLE)
    expect(el.querySelector('h1').textContent).toBe('Markdown preview')
    expect(el.querySelector('table')).toBeTruthy()
    expect(raw).toBe(0)
  })
})

describe('safety', () => {
  it('never lets raw HTML through; it is shown as text and counted', () => {
    const r = html('<script>alert(1)</script>\n\nhi <b onclick="x()">there</b> <img src=x onerror=alert(1)>')
    expect(r.el.querySelector('script, b, img')).toBeNull()
    expect(r.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(r.html).toContain('&lt;b onclick="x()"&gt;')
    expect(r.raw).toBeGreaterThanOrEqual(3)
  })
  it('removes unsafe link and image addresses', () => {
    const { el } = html('[x](javascript:alert(1)) [y](data:text/html;base64,AAAA) ![z](javascript:alert(2)) ![ok](https://x.test/a.png)')
    expect(el.querySelectorAll('a')).toHaveLength(0)
    expect(el.querySelectorAll('img')).toHaveLength(1)
    expect(el.querySelector('img').getAttribute('src')).toBe('https://x.test/a.png')
    expect(el.innerHTML).not.toContain('javascript:')
  })
  it('keeps normal links safe for new tabs', () => {
    const a = html('[site](https://example.com "T") [mail](mailto:a@b.co) [anchor](#top) <https://auto.link>').el.querySelectorAll('a')
    expect(a).toHaveLength(4)
    expect(a[0].getAttribute('rel')).toBe('noopener noreferrer')
    expect(a[0].getAttribute('target')).toBe('_blank')
    expect(a[0].getAttribute('title')).toBe('T')
    expect(a[2].getAttribute('target')).toBeNull()
  })
  it('filters URLs', () => {
    expect(safeUrl('https://a.b/c')).toBe('https://a.b/c')
    expect(safeUrl('/relative/path')).toBe('/relative/path')
    expect(safeUrl('#frag')).toBe('#frag')
    expect(safeUrl('JaVaScRiPt:alert(1)')).toBeNull()
    expect(safeUrl(' java\nscript:alert(1)')).toBeNull()
    expect(safeUrl('//evil.test/x')).toBeNull()
    expect(safeUrl('vbscript:x')).toBeNull()
    expect(safeUrl('data:image/png;base64,AAAA', { image: true })).toBe('data:image/png;base64,AAAA')
    expect(safeUrl('data:image/svg+xml;base64,AAAA', { image: true })).toBeNull()
    expect(safeUrl('mailto:a@b.co', { image: true })).toBeNull()
    expect(safeUrl('')).toBeNull()
  })
})

describe('helpers', () => {
  it('slugifies', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
    expect(slugify('  A  B ')).toBe('a-b')
  })
  it('counts words and reading time', () => {
    expect(docStats('')).toEqual({ words: 0, chars: 0, lines: 0, minutes: 1 })
    expect(docStats('one two\nthree')).toMatchObject({ words: 3, lines: 2, minutes: 1 })
    expect(docStats('word '.repeat(460)).minutes).toBe(2)
  })
  it('builds a standalone page and parses the command', () => {
    const page = htmlDocument('A <title>', '<p>x</p>')
    expect(page).toContain('<title>A &lt;title></title>')
    expect(page).toContain('<p>x</p>')
    expect(parseMarkdownCommand('md # Hi')).toEqual({ text: '# Hi' })
    expect(parseMarkdownCommand('markdown\n- a\n- b')).toEqual({ text: '- a\n- b' })
    expect(parseMarkdownCommand('MD')).toEqual({ text: '' })
    expect(parseMarkdownCommand('mdx')).toBeNull()
    expect(parseMarkdownCommand('md5 abc')).toBeNull()
  })
})
