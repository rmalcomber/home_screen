// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'curl',
  name: 'Curl runner',
  tool: { id: 'curl', name: 'Curl runner', order: 1 },
  widgets: [
    {
      kind: 'tool-curl',
      name: 'Curl runner',
      category: 'Developer tools',
      icon: 'iconify:fa6-solid:terminal',
      description: 'Paste a curl command to see its parts, then run it.',
      size: [5, 18],
      host: {
        provider: 'curl',
        input: 'multi',
        placeholder: 'Paste a curl command',
        hint: 'Paste a curl command above.',
      },
    },
  ],
}
