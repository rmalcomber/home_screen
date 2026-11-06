// Widget catalogue metadata: categories shown in the "Add tile" picker, plus category / icon / description for the
// classic widgets. Launcher-tool widgets carry their own metadata (see widgets_tools.jsx).

export const CATEGORIES = [
  'Time & weather',
  'Notes & tasks',
  'Media & design',
  'Calculators & converters',
  'Security & encoding',
  'Developer tools',
]

export const META = {
  clock: { category: 'Time & weather', icon: 'iconify:fa6-solid:clock', description: 'Local time and any number of time zones, each labelled with its zone.' },
  weather: { category: 'Time & weather', icon: 'iconify:fa6-solid:cloud-sun', description: 'Current weather for one or more places.' },
  countdown: { category: 'Time & weather', icon: 'iconify:fa6-solid:hourglass-half', description: 'Days until (or since) a date.' },
  tabata: { category: 'Time & weather', icon: 'iconify:fa6-solid:stopwatch', description: 'Interval timer with get-ready, work and rest phases.' },
  notes: { category: 'Notes & tasks', icon: 'iconify:fa6-solid:note-sticky', description: 'A scratch pad that saves as you type.' },
  todo: { category: 'Notes & tasks', icon: 'iconify:fa6-solid:list-check', description: 'A todo list you can drive entirely from the keyboard.' },
  carousel: { category: 'Media & design', icon: 'iconify:fa6-solid:images', description: 'A slideshow of uploaded images or image URLs.' },
  colorpicker: { category: 'Media & design', icon: 'iconify:fa6-solid:palette', description: 'Pick a colour (or sample one from your screen) and copy it in any format.' },
}
