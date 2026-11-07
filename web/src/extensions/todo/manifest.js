// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'todo',
  name: 'Todo list',
  widgets: [
    {
      kind: 'todo',
      name: 'Todo list',
      category: 'Notes & tasks',
      icon: 'iconify:fa6-solid:list-check',
      description: 'A todo list you can drive entirely from the keyboard.',
      size: [3, 12],
      defaults: { kind: 'todo', items: [] },
    },
  ],
}
