// Hashing for the launcher: MD5 (not in WebCrypto, implemented here) plus SHA-1/256/384/512 via crypto.subtle.
// Pure apart from the injectable `subtle`; unit tested in hash.test.js.

export const ALGOS = [
  { id: 'md5', label: 'MD5' },
  { id: 'sha1', label: 'SHA-1', subtle: 'SHA-1' },
  { id: 'sha256', label: 'SHA-256', subtle: 'SHA-256' },
  { id: 'sha384', label: 'SHA-384', subtle: 'SHA-384' },
  { id: 'sha512', label: 'SHA-512', subtle: 'SHA-512' },
]

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
const b64 = (bytes) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21]
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0)

/** MD5 of a byte array → 16 bytes. */
export function md5(bytes) {
  const len = bytes.length
  const total = (((len + 8) >>> 6) + 1) * 64
  const buf = new Uint8Array(total)
  buf.set(bytes)
  buf[len] = 0x80
  const dv = new DataView(buf.buffer)
  dv.setUint32(total - 8, (len << 3) >>> 0, true)
  dv.setUint32(total - 4, Math.floor(len / 2 ** 29), true)
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476
  for (let off = 0; off < total; off += 64) {
    let A = a0, B = b0, C = c0, D = d0
    for (let i = 0; i < 64; i++) {
      let F, g
      if (i < 16) { F = (B & C) | (~B & D); g = i }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16 }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16 }
      else { F = C ^ (B | ~D); g = (7 * i) % 16 }
      F = (F + A + K[i] + dv.getUint32(off + 4 * g, true)) >>> 0
      A = D; D = C; C = B
      const r = S[(i >> 4) * 4 + (i % 4)]
      B = (B + (((F << r) | (F >>> (32 - r))) >>> 0)) >>> 0
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0
  }
  const out = new Uint8Array(16)
  const o = new DataView(out.buffer)
  ;[a0, b0, c0, d0].forEach((v, i) => o.setUint32(i * 4, v, true))
  return out
}

/** Digest bytes with each requested algorithm → { id: { hex, b64 } }. */
export async function digestBytes(data, ids = ALGOS.map((a) => a.id), subtle = globalThis.crypto?.subtle) {
  const out = {}
  for (const id of ids) {
    const algo = ALGOS.find((a) => a.id === id)
    const bytes = id === 'md5' ? md5(data) : new Uint8Array(await subtle.digest(algo.subtle, data))
    out[id] = { hex: hex(bytes), b64: b64(bytes) }
  }
  return out
}

/** Digest `text` (UTF-8) with each requested algorithm → { id: { hex, b64 } }. */
export const digest = (text, ids, subtle) => digestBytes(new TextEncoder().encode(text), ids, subtle)

/** "hash text" (all algorithms) or "sha256 text" / "md5 text" (one). Returns { text, ids } or null. */
export function parseHashCommand(q) {
  const m = /^\s*(hash|md5|sha-?1|sha-?256|sha-?384|sha-?512)\s+([\s\S]+)$/i.exec(q || '')
  if (!m) return null
  const text = m[2].replace(/\s+$/, '') // trailing whitespace/newlines are almost never meant to be hashed
  if (!text) return null
  const w = m[1].toLowerCase().replace('-', '')
  return { text, ids: w === 'hash' ? null : [w] }
}
