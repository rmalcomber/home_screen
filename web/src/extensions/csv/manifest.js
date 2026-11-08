// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'csv',
  name: 'CSV ⇄ JSON',
  tool: { id: 'csv', name: 'CSV ⇄ JSON', order: 13 },
  widgets: [
    {
      kind: 'tool-csv',
      name: 'CSV ⇄ JSON',
      category: 'Developer tools',
      icon: 'iconify:fa6-solid:table',
      description: 'Convert spreadsheet data to JSON and back.',
      size: [5, 18],
      host: {
        provider: 'csv',
        prefix: 'csv',
        input: 'multi',
        files: true,
        accept: '.csv,.tsv,.txt',
        placeholder: 'Paste CSV, TSV or JSON',
        hint: 'Paste CSV, TSV or JSON above.',
      },
    },
  ],
}
