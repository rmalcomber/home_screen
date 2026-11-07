// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'calc',
  name: 'Calculator and converters',
  tool: { id: 'calc', name: 'Calculator & converters', order: 17 },
  widgets: [
    {
      kind: 'tool-calc',
      name: 'Calculator',
      category: 'Calculators & converters',
      icon: 'iconify:fa6-solid:calculator',
      description: 'Maths: (2+3)*4, sqrt(16), 2^10, 7%4.',
      size: [3, 7],
      host: { provider: 'calc', input: 'line', placeholder: 'e.g. (2+3)*4' },
    },
    {
      kind: 'tool-units',
      name: 'Unit converter',
      category: 'Calculators & converters',
      icon: 'iconify:fa6-solid:ruler-combined',
      description: 'Length, weight, volume, time, data, speed, area and temperature.',
      size: [3, 7],
      host: { provider: 'calc', input: 'line', placeholder: 'e.g. 10 km to miles, 100f to c' },
    },
    {
      kind: 'tool-currency',
      name: 'Currency converter',
      category: 'Calculators & converters',
      icon: 'iconify:fa6-solid:coins',
      description: 'Convert between ~150 currencies with central-bank rates.',
      size: [3, 7],
      host: { provider: 'calc', input: 'line', placeholder: 'e.g. 100 usd to gbp' },
    },
  ],
}
