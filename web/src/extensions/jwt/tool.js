import { historyItems } from '../../core/extensions/host.js'
import { extractToken, parseJwt } from './engine.js'
import { JwtPanel } from './Panel.jsx'

// JWT decoder: paste a token (optionally "Bearer …") to see header, payload, claim times and expiry. Decode only, never sent anywhere.
export default {
  items(q) {
    if (!q.trim()) return historyItems('jwt', 'JWT', 'iconify:fa6-solid:key')
    const token = extractToken(q)
    if (!token) return []
    return [{ key: 'jwt:' + q, title: 'Decode JWT', kind: 'jwt', icon: 'iconify:fa6-solid:key', panel: JwtPanel, hint: 'Enter: copy payload', data: parseJwt(token) }]
  },
}
