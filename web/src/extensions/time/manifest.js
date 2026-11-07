// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'time',
  name: 'Clock and weather',
  widgets: [
    {
      kind: 'clock',
      name: 'Clock',
      category: 'Time & weather',
      icon: 'iconify:fa6-solid:clock',
      description: 'Local time and any number of time zones, each labelled with its zone.',
      size: [3, 8],
      defaults: { kind: 'clock', zones: [{ tz: '', label: '' }], hour12: false, seconds: true, layout: 'list' },
    },
    {
      kind: 'weather',
      name: 'Weather',
      category: 'Time & weather',
      icon: 'iconify:fa6-solid:cloud-sun',
      description: 'Current weather for one or more places.',
      size: [3, 8],
      defaults: { kind: 'weather', locations: [{ city: '', lat: null, lon: null }], fahrenheit: false, layout: 'list' },
    },
  ],
}
