// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'cidr',
  name: 'IP and CIDR calculator',
  tool: { id: 'cidr', name: 'IP and CIDR calculator', order: 22 },
  widgets: [
    {
      kind: 'tool-cidr',
      name: 'IP and CIDR calculator',
      category: 'Web & network',
      icon: 'iconify:fa6-solid:network-wired',
      description: 'Network, mask, hosts and type for an IPv4 or IPv6 block; membership, overlap and splitting.',
      size: [4, 18],
      host: { provider: 'cidr', prefix: 'cidr', input: 'line', placeholder: 'e.g. 10.0.0.0/24, or 10.0.0.5 in 10.0.0.0/24', default: '10.0.0.0/24', hint: 'Type an address or network above.' },
    },
  ],
}
