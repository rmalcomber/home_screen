// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'countdown',
  name: 'Countdown',
  widgets: [
    {
      kind: 'countdown',
      name: 'Countdown',
      category: 'Time & weather',
      icon: 'iconify:fa6-solid:hourglass-half',
      description: 'Days until (or since) one or more dates, in one tile.',
      size: [3, 6],
      defaults: { kind: 'countdown', countdowns: [{ label: '', date: '' }], layout: 'list' },
    },
  ],
}
