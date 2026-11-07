// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'tabata',
  name: 'Tabata timer',
  widgets: [
    {
      kind: 'tabata',
      name: 'Tabata timer',
      category: 'Time & weather',
      icon: 'iconify:fa6-solid:stopwatch',
      description: 'Interval timer with get-ready, work and rest phases.',
      size: [3, 10],
      defaults: { kind: 'tabata', prepare: 10, work: 20, rest: 10, rounds: 8, sound: true },
    },
  ],
}
