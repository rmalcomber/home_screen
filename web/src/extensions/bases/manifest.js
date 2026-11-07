// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'bases',
  name: 'Number bases and bit tools',
  tool: { id: 'bases', name: 'Number bases and bit tools', order: 20 },
  widgets: [
    {
      kind: 'tool-bases',
      name: 'Number base converter',
      category: 'Calculators & converters',
      icon: 'iconify:fa6-solid:binary',
      description: 'A number in decimal, hex, binary, octal and base 36 (type 255, 0xff, 0b1010, or 16 ff).',
      size: [4, 14],
      host: { provider: 'bases', prefix: 'base', input: 'line', placeholder: 'e.g. 255, 0xff, 0b1010, or 16 ff for base 16', default: '255', hint: 'Type a number above (255, 0xff, 0b1010).' },
    },
    {
      kind: 'tool-bytes',
      name: 'Byte size converter',
      category: 'Calculators & converters',
      icon: 'iconify:fa6-solid:database',
      description: 'A size in bytes and in every SI and IEC unit, side by side (1.5 GiB, 10 MB).',
      size: [4, 16],
      host: { provider: 'bases', prefix: 'bytes', input: 'line', placeholder: 'e.g. 1536000, 1.5 GiB, 10mb', default: '1.5 GiB', hint: 'Type a size above.' },
    },
    {
      kind: 'tool-bits',
      name: 'Bit calculator',
      category: 'Calculators & converters',
      icon: 'iconify:fa6-solid:toggle-on',
      description: 'AND, OR, XOR, shifts and flags: see the result in every base and which bits are set.',
      size: [4, 16],
      host: { provider: 'bases', prefix: 'bits', input: 'line', placeholder: 'e.g. (1<<3)|(1<<5), 0xF0 & 0x3C, set 0 2 5', default: '(1<<3)|(1<<5)', hint: 'Type a bit expression above.' },
    },
  ],
}
