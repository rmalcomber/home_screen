// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'password',
  name: 'Password generator',
  tool: { id: 'password', name: 'Password generator', order: 14 },
  widgets: [
    {
      kind: 'tool-password',
      name: 'Password generator',
      category: 'Security & encoding',
      icon: 'iconify:fa6-solid:lock',
      description: 'Strong passwords, PINs and tokens with an entropy estimate. Never stored.',
      size: [4, 12],
      host: {
        provider: 'password',
        prefix: 'password',
        input: 'line',
        placeholder: 'length and flags, e.g. 24 nosymbols (optional)',
        allowEmpty: true,
        regenerate: true,
      },
    },
  ],
}
