// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'http',
  name: 'HTTP reference',
  tool: { id: 'http', name: 'HTTP reference', order: 24 },
  widgets: [
    {
      kind: 'tool-http-status',
      name: 'HTTP status codes',
      category: 'Web & network',
      icon: 'iconify:fa6-solid:circle-question',
      description: 'Look up an HTTP status code by number, class or words: what it means and where it is defined.',
      size: [5, 16],
      host: { provider: 'http', prefix: 'status', input: 'line', allowEmpty: true, placeholder: 'e.g. 404, 4xx, not found, redirect', hint: 'Type a status code or a word above.' },
    },
    {
      kind: 'tool-http-header',
      name: 'HTTP headers',
      category: 'Web & network',
      icon: 'iconify:fa6-solid:list',
      description: 'Look up an HTTP request or response header: what it does, with an example value.',
      size: [5, 16],
      host: { provider: 'http', prefix: 'header', input: 'line', placeholder: 'e.g. content-type, cache, cors', default: 'cache-control', hint: 'Type a header name or a word above.' },
    },
    {
      kind: 'tool-mime',
      name: 'MIME types',
      category: 'Web & network',
      icon: 'iconify:fa6-solid:file',
      description: 'Find the media type for a file extension, or the extensions for a media type.',
      size: [5, 14],
      host: { provider: 'http', prefix: 'mime', input: 'line', placeholder: 'e.g. png, .json, image/png, font', default: 'png', hint: 'Type an extension, a type or a word above.' },
    },
  ],
}
