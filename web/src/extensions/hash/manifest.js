// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'hash',
  name: 'Hash',
  tool: { id: 'hash', name: 'Hash', order: 6 },
  widgets: [
    {
      kind: 'tool-hash',
      name: 'Hash generator',
      category: 'Security & encoding',
      icon: 'iconify:fa6-solid:hashtag',
      description: 'MD5, SHA-1, SHA-256, SHA-384 and SHA-512 of any text.',
      size: [4, 10],
      host: {
        provider: 'hash',
        prefix: 'hash',
        input: 'multi',
        placeholder: 'Text to hash',
        hint: 'Type some text to hash it.',
      },
    },
  ],
}
