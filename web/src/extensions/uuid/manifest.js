// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'uuid',
  name: 'UUID',
  tool: { id: 'uuid', name: 'UUID', order: 5 },
  widgets: [
    {
      kind: 'tool-uuid',
      name: 'UUID generator',
      category: 'Security & encoding',
      icon: 'iconify:fa6-solid:fingerprint',
      description: 'v4 and v7 UUIDs; paste one to inspect it.',
      size: [4, 10],
      host: {
        provider: 'uuid',
        prefix: 'uuid',
        input: 'line',
        placeholder: 'a count, or a UUID to inspect (optional)',
        allowEmpty: true,
        regenerate: true,
      },
    },
  ],
}
