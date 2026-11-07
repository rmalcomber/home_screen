// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'notes',
  name: 'Notes',
  widgets: [
    {
      kind: 'notes',
      name: 'Notes',
      category: 'Notes & tasks',
      icon: 'iconify:fa6-solid:note-sticky',
      description: 'A scratch pad that saves as you type.',
      size: [3, 8],
      defaults: { kind: 'notes', text: '' },
    },
  ],
}
