// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'cron',
  name: 'Cron explainer',
  tool: { id: 'cron', name: 'Cron explainer', order: 12 },
  widgets: [
    {
      kind: 'tool-cron',
      name: 'Cron explainer',
      category: 'Time & weather',
      icon: 'iconify:fa6-solid:clock-rotate-left',
      description: 'Plain-English description and next run times for a cron expression.',
      size: [4, 20],
      host: {
        provider: 'cron',
        prefix: 'cron',
        input: 'line',
        placeholder: 'e.g. */15 9-17 * * 1-5',
        default: '*/15 9-17 * * 1-5',
      },
    },
  ],
}
