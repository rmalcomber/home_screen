// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'chmod',
  name: 'chmod calculator',
  tool: { id: 'chmod', name: 'chmod calculator', order: 21 },
  widgets: [
    {
      kind: 'tool-chmod',
      name: 'chmod calculator',
      category: 'Developer tools',
      icon: 'iconify:fa6-solid:lock-open',
      description: 'Tick permission boxes or type 755 or rwxr-xr-x, and copy the chmod command.',
      size: [5, 16],
      host: { provider: 'chmod', prefix: 'chmod', input: 'none' },
    },
    {
      kind: 'tool-umask',
      name: 'umask calculator',
      category: 'Developer tools',
      icon: 'iconify:fa6-solid:user-lock',
      description: 'What permissions new files and directories get for a umask such as 022.',
      size: [4, 8],
      host: { provider: 'chmod', prefix: 'umask', input: 'line', placeholder: 'e.g. 022 or 077', default: '022', hint: 'Type a umask above (three octal digits).' },
    },
  ],
}
