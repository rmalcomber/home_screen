// Accent palette for tiles and groups. A tile stores the colour *name*, so the palette can be retuned later.
export const PALETTE = [
  { id: 'red', label: 'Red', value: '#ef4444' },
  { id: 'orange', label: 'Orange', value: '#f97316' },
  { id: 'amber', label: 'Amber', value: '#f59e0b' },
  { id: 'lime', label: 'Lime', value: '#84cc16' },
  { id: 'green', label: 'Green', value: '#22c55e' },
  { id: 'teal', label: 'Teal', value: '#14b8a6' },
  { id: 'cyan', label: 'Cyan', value: '#06b6d4' },
  { id: 'blue', label: 'Blue', value: '#3b82f6' },
  { id: 'violet', label: 'Violet', value: '#8b5cf6' },
  { id: 'pink', label: 'Pink', value: '#ec4899' },
  { id: 'slate', label: 'Slate', value: '#64748b' },
]

/** The CSS colour for a stored name, or null for "no colour" / an unknown name. */
export const colorValue = (name) => PALETTE.find((c) => c.id === name)?.value || null
