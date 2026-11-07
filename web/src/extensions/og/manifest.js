// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'og',
  name: 'Open Graph viewer',
  tool: { id: 'og', name: 'Open Graph viewer', order: 26 },
  widgets: [
    {
      kind: 'tool-og',
      name: 'Open Graph viewer',
      category: 'Web & network',
      icon: 'iconify:fa6-solid:share-nodes',
      description: 'See how a link looks when shared: preview card, every Open Graph and Twitter tag, and what is missing.',
      size: [6, 20],
      host: { provider: 'og', prefix: 'og', input: 'line', placeholder: 'e.g. https://example.com/article', hint: 'Type a web address above, then press Fetch.' },
    },
  ],
}
