// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'timestamp',
  name: 'Timestamp',
  tool: { id: 'ts', name: 'Timestamp', order: 10 },
  widgets: [
    {
      kind: 'tool-timestamp',
      name: 'Timestamp converter',
      category: 'Time & weather',
      icon: 'iconify:fa6-solid:calendar-day',
      description: 'Unix time, ISO dates and offsets, in any time zone.',
      size: [4, 14],
      host: {
        provider: 'ts',
        prefix: 'ts',
        input: 'line',
        placeholder: 'now, 1700000000, 2026-11-06T12:00Z, +3d',
        default: 'now',
      },
    },
  ],
}
