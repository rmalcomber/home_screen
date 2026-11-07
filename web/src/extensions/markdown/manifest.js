// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'markdown',
  name: 'Markdown preview',
  tool: { id: 'md', name: 'Markdown preview', order: 16 },
  widgets: [
    {
      kind: 'tool-markdown',
      name: 'Markdown previewer',
      category: 'Notes & tasks',
      icon: 'iconify:fa6-brands:markdown',
      description: 'Live Markdown preview; copy as rich text or HTML, or download a page.',
      size: [6, 18],
      host: {
        provider: 'md',
        prefix: 'md',
        input: 'multi',
        placeholder: 'Type or paste Markdown',
        rows: 7,
        hint: 'Type or paste Markdown above.',
      },
    },
  ],
}
