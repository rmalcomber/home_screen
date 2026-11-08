// Base64 helpers for the launcher. Pure; unit tested in base64.test.js.

const toBinary = (bytes) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return s
}

/** Base64 of raw bytes (standard, or URL-safe without padding). */
export const encodeBytes = (bytes, { url = false } = {}) => {
  const b = btoa(toBinary(bytes))
  return url ? b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b
}

export const encode = (text, opts) => encodeBytes(new TextEncoder().encode(text), opts)

/**
 * Decode standard or URL-safe base64 (padding optional, whitespace ignored).
 * Returns { kind:'text', text } | { kind:'binary', bytes, hex } | null if the input isn't base64.
 */
export function decode(input) {
  // Only line breaks (wrapped base64) are ignored; a space means it's ordinary text, not base64.
  const s = (input || '').trim().replace(/[\r\n]+/g, '')
  if (!s || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(s) || s.length % 4 === 1) return null
  const std = s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  let bin
  try {
    bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4))
  } catch {
    return null
  }
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    // Valid UTF-8 but mostly control characters is really binary (e.g. a random-looking word that happens to be base64).
    const printable = [...text].filter((c) => c >= ' ' || c === '\n' || c === '\t' || c === '\r').length
    if (text.length && printable / [...text].length > 0.95) return { kind: 'text', text }
  } catch {
    /* not UTF-8 */
  }
  return { kind: 'binary', bytes, hex: [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('') }
}

/** Matches "b64 …" / "base64 …"; returns the payload (may be multi-line) or null. */
export function parseB64Command(q) {
  const m = /^\s*(?:b64|base64)\s+([\s\S]+)$/i.exec(q || '')
  return m ? m[1].replace(/\s+$/, '') : null
}
