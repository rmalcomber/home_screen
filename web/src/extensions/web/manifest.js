// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'web',
  name: 'Web search',
  tool: { id: 'web', name: 'Web search', order: 25 },
  widgets: [
    {
      kind: 'tool-web-search',
      name: 'Web search',
      category: 'Web & network',
      icon: 'iconify:fa6-solid:magnifying-glass',
      description: 'Type what to look for and pick an engine: Google, DuckDuckGo, Bing, GitHub, YouTube, MDN and more.',
      size: [4, 20],
      host: { provider: 'web', prefix: 'search', input: 'line', placeholder: 'e.g. rust lifetimes', hint: 'Type what to search for above, then pick an engine.' },
    },
  ],
}
