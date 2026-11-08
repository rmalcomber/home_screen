// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'base64',
  name: 'Base64',
  tool: { id: 'b64', name: 'Base64', order: 3 },
  widgets: [
    {
      kind: 'tool-base64',
      name: 'Base64',
      category: 'Security & encoding',
      icon: 'iconify:fa6-solid:file-code',
      description: 'Encode text to base64 (standard and URL-safe) or decode it. Also encodes a file.',
      size: [4, 10],
      host: {
        provider: 'b64',
        prefix: 'b64',
        input: 'multi',
        files: 'bytes',
        placeholder: 'Text to encode, or base64 to decode',
        hint: 'Type text to encode, or paste base64 to decode.',
      },
    },
  ],
}
