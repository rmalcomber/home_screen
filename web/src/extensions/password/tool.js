import { parsePasswordCommand, generate as genPassword, pin as genPin, hexToken, urlToken, pools as passwordPools, entropyBits, strengthLabel } from './engine.js'

// Password generator: "password", "password 32", "pw 16 nosymbols easy" (flags: nosymbols nonum noupper nolower easy).
// Offers a strong password, letters+numbers only, an easy-to-read one (no 0/O/1/l), a PIN, a hex token and a URL-safe token,
// each with an entropy estimate. Generated with crypto.getRandomValues. Deliberately NOT saved to Recent.
export default {
  items(q) {
    const cmd = parsePasswordCommand(q)
    if (!cmd) return []
    const { length, lengthGiven, opts } = cmd
    const size = (o) => passwordPools(o).join('').length
    const mk = (label, text, poolSize) => {
      const bits = entropyBits(text.length, poolSize)
      return {
        key: `password:${label}:${text}`,
        title: text,
        mono: true,
        subtitle: `${label} · ≈${bits} bits (${strengthLabel(bits)})  ·  Enter to copy`,
        kind: 'Copy',
        recent: false,
        icon: 'iconify:fa6-solid:lock',
        run: () => navigator.clipboard?.writeText(text).catch(() => {}),
      }
    }
    const pinLen = lengthGiven && length <= 12 ? length : 6
    return [
      mk(`${length} characters`, genPassword({ length, ...opts }), size(opts)),
      ...(opts.symbol !== false ? [mk('Letters and numbers only', genPassword({ length, ...opts, symbol: false }), size({ ...opts, symbol: false }))] : []),
      ...(!opts.easy ? [mk('Easy to read (no 0/O or 1/l look-alikes)', genPassword({ length, ...opts, easy: true }), size({ ...opts, easy: true }))] : []),
      mk(`${pinLen}-digit PIN`, genPin(pinLen), 10),
      mk('Hex token', hexToken(length), 16),
      mk('URL-safe token', urlToken(length), 64),
    ]
  },
}
