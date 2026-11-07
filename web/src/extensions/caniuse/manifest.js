// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'caniuse',
  name: 'Can I use',
  tool: { id: 'caniuse', name: 'Can I use', order: 27 },
  widgets: [
    {
      kind: 'tool-caniuse',
      name: 'Can I use',
      category: 'Web & network',
      icon: 'iconify:fa6-solid:globe',
      description: 'Browser support for a web feature: which versions of Chrome, Firefox, Safari and others have it.',
      size: [6, 22],
      host: { provider: 'caniuse', prefix: 'caniuse', input: 'line', placeholder: 'e.g. grid, flexbox gap, webp', default: 'grid', hint: 'Type a web feature above.' },
    },
  ],
}
