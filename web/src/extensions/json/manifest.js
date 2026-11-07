// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'json',
  name: 'JSON formatter',
  tool: { id: 'json', name: 'JSON formatter', order: 2 },
  widgets: [
    {
      kind: 'tool-json',
      name: 'JSON formatter',
      category: 'Developer tools',
      icon: 'iconify:fa6-solid:code',
      description: 'Pretty-print, minify and sort JSON; fixes comments and trailing commas.',
      size: [5, 16],
      host: { provider: 'json', input: 'multi', placeholder: 'Paste JSON', hint: 'Paste JSON above.' },
    },
  ],
}
