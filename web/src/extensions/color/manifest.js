// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'color',
  name: 'Colour picker',
  tool: { id: 'color', name: 'Colour picker', order: 8 },
  widgets: [
    {
      kind: 'colorpicker',
      name: 'Colour picker',
      category: 'Media & design',
      icon: 'iconify:fa6-solid:palette',
      description: 'Pick a colour (or sample one from your screen) and copy it in any format.',
      size: [4, 16],
      defaults: { kind: 'colorpicker', color: '#3b82f6', alpha: 1, history: [] },
    },
  ],
}
