// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'diff',
  name: 'Text diff',
  tool: { id: 'diff', name: 'Text diff', order: 11 },
  widgets: [
    {
      kind: 'tool-diff',
      name: 'Text diff',
      category: 'Developer tools',
      icon: 'iconify:fa6-solid:code-compare',
      description: 'Compare two texts line by line, with word-level highlights.',
      size: [7, 20],
      host: { provider: 'diff', prefix: 'diff', input: 'none' },
    },
  ],
}
