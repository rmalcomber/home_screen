// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'url',
  name: 'URL and HTML encoding',
  tool: { id: 'url', name: 'URL and HTML encoding', order: 18 },
  widgets: [
    {
      kind: 'tool-url',
      name: 'URL encoder and parser',
      category: 'Web & network',
      icon: 'iconify:fa6-solid:link',
      description: 'Encode or decode URL text, and take a URL or query string apart into a table.',
      size: [5, 14],
      host: { provider: 'url', prefix: 'url', input: 'multi', placeholder: 'Text, a URL, or a query string', hint: 'Type or paste text, a URL, or a query string above.' },
    },
    {
      kind: 'tool-html',
      name: 'HTML entities',
      category: 'Web & network',
      icon: 'iconify:fa6-solid:code',
      description: 'Escape text for HTML (&lt; &amp; and friends) or decode entities back to text.',
      size: [4, 10],
      host: { provider: 'url', prefix: 'html', input: 'multi', placeholder: 'Text to escape, or entities to decode', hint: 'Type or paste text or HTML entities above.' },
    },
  ],
}
