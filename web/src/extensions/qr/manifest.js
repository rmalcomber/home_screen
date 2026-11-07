// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'qr',
  name: 'QR code',
  tool: { id: 'qr', name: 'QR code', order: 15 },
  widgets: [
    {
      kind: 'tool-qr',
      name: 'QR code generator',
      category: 'Media & design',
      icon: 'iconify:fa6-solid:qrcode',
      description: 'Turn text, a URL or Wi-Fi details into a QR code; copy or download PNG/SVG.',
      size: [4, 18],
      host: {
        provider: 'qr',
        prefix: 'qr',
        input: 'multi',
        placeholder: 'Text or URL to encode',
        hint: 'Type or paste text or a URL above (or use the Wi-Fi tab once a code shows).',
      },
    },
  ],
}
