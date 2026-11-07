// Small pure helpers shared by several extensions.

/** A short, stable, non-cryptographic hash of a string (used to key launcher history entries). */
export const shortHash = (s) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** "3 days ago" / "in 30 seconds" for a time in ms. */
export function relativeTime(ms, now = Date.now()) {
  const diff = (ms - now) / 1000
  const abs = Math.abs(diff)
  const [n, unit] = abs < 60 ? [diff, 'second'] : abs < 3600 ? [diff / 60, 'minute'] : abs < 86400 ? [diff / 3600, 'hour'] : abs < 2592000 ? [diff / 86400, 'day'] : abs < 31536000 ? [diff / 2592000, 'month'] : [diff / 31536000, 'year']
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(n), unit)
}
