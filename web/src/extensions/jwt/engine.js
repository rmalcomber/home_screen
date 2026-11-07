// JWT decoding for the launcher. Decode only: the signature is NOT verified (that needs the key). Pure; unit tested.
import { relativeTime } from '../../core/lib/text.js'

const KNOWN = {
  iss: 'Issuer', sub: 'Subject', aud: 'Audience', exp: 'Expires', nbf: 'Not before', iat: 'Issued at', jti: 'JWT ID',
  azp: 'Authorized party', scope: 'Scope', scp: 'Scope', nonce: 'Nonce', auth_time: 'Auth time', email: 'Email', name: 'Name', roles: 'Roles',
}
const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat', 'auth_time'])
const SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/

/** Pull a token out of "eyJ…", "Bearer eyJ…", "jwt eyJ…", "Authorization: Bearer eyJ…" (optionally quoted). */
export function extractToken(input) {
  let s = (input || '').trim()
  s = s.replace(/^authorization\s*:\s*/i, '').replace(/^(?:bearer|jwt)\s+/i, '').replace(/^["']|["']$/g, '').trim()
  return s.startsWith('eyJ') && SHAPE.test(s) ? s : null
}

function decodeSegment(seg) {
  const std = seg.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}

/** Returns { ok:true, header, payload, signature, alg, status, claims, warnings } or { ok:false, error }. */
export function parseJwt(token, now = Date.now()) {
  const [h, p, sig = ''] = token.split('.')
  let header, payload
  try { header = decodeSegment(h) } catch { return { ok: false, error: 'The header is not valid base64url-encoded JSON' } }
  try { payload = decodeSegment(p) } catch { return { ok: false, error: 'The payload is not valid base64url-encoded JSON (it may be an encrypted JWE token)' } }
  if (!header || typeof header !== 'object' || Array.isArray(header)) return { ok: false, error: 'The header is not a JSON object' }

  const warnings = []
  const alg = String(header.alg ?? '')
  if (!alg) warnings.push('No "alg" in the header')
  if (alg.toLowerCase() === 'none' || !sig) warnings.push('Unsigned token (alg "none" / empty signature): anyone could have created it')

  const isObj = payload && typeof payload === 'object' && !Array.isArray(payload)
  const claims = isObj
    ? Object.entries(payload).map(([k, v]) => {
        const time = TIME_CLAIMS.has(k) && typeof v === 'number' ? new Date(v * 1000) : null
        return { key: k, label: KNOWN[k] || '', value: v, time: time && !Number.isNaN(time.getTime()) ? { iso: time.toISOString(), local: time.toLocaleString(), relative: relativeTime(time.getTime(), now) } : null }
      })
    : []

  let status = 'no-exp'
  if (isObj && typeof payload.exp === 'number') status = now >= payload.exp * 1000 ? 'expired' : 'valid'
  if (isObj && typeof payload.nbf === 'number' && now < payload.nbf * 1000) status = 'not-yet'
  if (isObj && typeof payload.exp !== 'number') warnings.push('No expiry ("exp") claim: the token never expires')

  return { ok: true, header, payload, signature: sig, alg, status, claims, warnings }
}
