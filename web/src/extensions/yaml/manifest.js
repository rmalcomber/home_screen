// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'yaml',
  name: 'JSON, YAML and TOML converter',
  tool: { id: 'yaml', name: 'JSON, YAML and TOML converter', order: 23 },
  widgets: [
    {
      kind: 'tool-yaml',
      name: 'JSON ⇄ YAML converter',
      category: 'Developer tools',
      icon: 'iconify:fa6-solid:file-code',
      description: 'Paste JSON or TOML to get YAML, or YAML to get JSON. Reads config-style YAML.',
      size: [6, 20],
      host: { provider: 'yaml', prefix: 'yaml', input: 'multi', rows: 6, placeholder: 'Paste JSON, YAML or TOML', hint: 'Paste JSON, YAML or TOML above.' },
    },
    {
      kind: 'tool-toml',
      name: 'JSON ⇄ TOML converter',
      category: 'Developer tools',
      icon: 'iconify:fa6-solid:gears',
      description: 'Paste JSON or YAML to get TOML, or TOML to get JSON.',
      size: [6, 20],
      host: { provider: 'yaml', prefix: 'toml', input: 'multi', rows: 6, placeholder: 'Paste JSON, YAML or TOML', hint: 'Paste JSON, YAML or TOML above.' },
    },
  ],
}
