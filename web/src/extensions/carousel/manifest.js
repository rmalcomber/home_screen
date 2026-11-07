// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'carousel',
  name: 'Image carousel',
  widgets: [
    {
      kind: 'carousel',
      name: 'Image carousel',
      category: 'Media & design',
      icon: 'iconify:fa6-solid:images',
      description: 'A slideshow of uploaded images or image URLs.',
      size: [4, 11],
      defaults: { kind: 'carousel', images: [], seconds: 6, fit: 'cover' },
    },
  ],
}
