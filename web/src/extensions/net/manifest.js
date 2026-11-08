// What this extension is. Loaded up front, so keep it small and free of code; the code is in index.js.
export default {
  id: 'net',
  name: 'Network tools',
  tool: { id: 'net', name: 'Ping, traceroute and DNS', order: 28 },
  widgets: [
    {
      kind: 'tool-ping',
      name: 'Ping',
      category: 'Web & network',
      icon: 'iconify:fa6-solid:tower-broadcast',
      description: 'Ping a host from the machine running Home Screen: replies, times and packet loss.',
      size: [5, 14],
      host: { provider: 'net', prefix: 'ping', input: 'line', placeholder: 'e.g. example.com', hint: 'Type a host name or IP address above, then press Ping.' },
    },
    {
      kind: 'tool-traceroute',
      name: 'Traceroute',
      category: 'Web & network',
      icon: 'iconify:fa6-solid:route',
      description: 'Trace the route to a host, hop by hop, with the time to each router.',
      size: [6, 18],
      host: { provider: 'net', prefix: 'trace', input: 'line', placeholder: 'e.g. example.com', hint: 'Type a host name or IP address above, then press Trace.' },
    },
    {
      kind: 'tool-dns',
      name: 'DNS records',
      category: 'Web & network',
      icon: 'iconify:fa6-solid:server',
      description: 'Look up A, AAAA, MX, TXT, NS, CNAME, SOA, SRV, CAA and PTR records for a name.',
      size: [6, 18],
      host: { provider: 'net', prefix: 'dns', input: 'line', placeholder: 'e.g. example.com MX', hint: 'Type a domain above, with a record type if you like, then press Look up.' },
    },
  ],
}
