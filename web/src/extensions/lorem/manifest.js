// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'lorem',
  name: 'Lorem ipsum',
  tool: { id: 'lorem', name: 'Lorem ipsum', order: 9 },
  widgets: [
    {
      kind: 'tool-lorem',
      name: 'Lorem ipsum',
      category: 'Media & design',
      icon: 'iconify:fa6-solid:align-left',
      description: 'Placeholder text by words, sentences or paragraphs.',
      size: [4, 10],
      host: {
        provider: 'lorem',
        prefix: 'lorem',
        input: 'line',
        placeholder: 'e.g. 3p, 50, 2 sentences (optional)',
        allowEmpty: true,
        regenerate: true,
      },
    },
  ],
}
