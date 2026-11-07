// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'jwt',
  name: 'JWT decoder',
  tool: { id: 'jwt', name: 'JWT decoder', order: 4 },
  widgets: [
    {
      kind: 'tool-jwt',
      name: 'JWT decoder',
      category: 'Security & encoding',
      icon: 'iconify:fa6-solid:key',
      description: 'Decode a token: claims, times and expiry. Nothing is verified or stored.',
      size: [5, 16],
      host: {
        provider: 'jwt',
        input: 'multi',
        placeholder: 'Paste a JWT (optionally "Bearer …")',
        hint: 'Paste a JWT above.',
      },
    },
  ],
}
