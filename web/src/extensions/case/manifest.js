// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'case',
  name: 'Text case and counts',
  tool: { id: 'case', name: 'Text case and counts', order: 19 },
  widgets: [
    {
      kind: 'tool-case',
      name: 'Text case converter',
      category: 'Developer tools',
      icon: 'iconify:fa6-solid:font',
      description: 'camelCase, snake_case, kebab-case, Title Case, slugs and more, all at once.',
      size: [4, 18],
      host: { provider: 'case', prefix: 'case', input: 'multi', placeholder: 'Text or an identifier to convert', hint: 'Type or paste text above to see every case.' },
    },
    {
      kind: 'tool-wordcount',
      name: 'Word and line counter',
      category: 'Notes & tasks',
      icon: 'iconify:fa6-solid:arrow-down-1-9',
      description: 'Words, characters, lines, sentences and reading time for any text.',
      size: [4, 18],
      host: { provider: 'case', prefix: 'count', input: 'multi', rows: 6, placeholder: 'Paste text to count', hint: 'Type or paste text above to count it.' },
    },
  ],
}
