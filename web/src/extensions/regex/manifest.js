// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'regex',
  name: 'Regex tester',
  tool: { id: 'regex', name: 'Regex tester', order: 7 },
  widgets: [
    {
      kind: 'tool-regex',
      name: 'Regex tester',
      category: 'Developer tools',
      icon: 'iconify:fa6-solid:asterisk',
      description: 'Live matches, groups and replace preview.',
      size: [5, 20],
      host: { provider: 'regex', prefix: 'regex', input: 'none' },
    },
  ],
}
