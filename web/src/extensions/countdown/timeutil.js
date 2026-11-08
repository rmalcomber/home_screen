// Pure helpers for the countdown widget (unit tested).

/** The countdowns of a config. A tile saved before lists existed holds one `{ label, date }`. */
export const countdownsOf = (c) =>
  Array.isArray(c?.countdowns) ? c.countdowns : c?.date || c?.label ? [{ label: c.label || '', date: c.date || '' }] : []

export const layoutOf = (c) => (c?.layout === 'tiles' ? 'tiles' : 'list')

const DAY = 86400000

/** Whole days from `now` to the date ('YYYY-MM-DD'): positive = future, negative = past, null = no valid date. */
export function daysUntil(date, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '')
  if (!m) return null
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const t = new Date(y, mo - 1, d)
  if (t.getFullYear() !== y || t.getMonth() !== mo - 1 || t.getDate() !== d) return null
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((t - start) / DAY)
}

/** { n, word } for a day count: `3` "days until", `0` "today", `2` "days since". */
export function describe(days) {
  if (days === null) return { n: '–', word: 'set a date' }
  if (days === 0) return { n: 0, word: 'today' }
  const n = Math.abs(days)
  return { n, word: `day${n === 1 ? '' : 's'} ${days > 0 ? 'until' : 'since'}` }
}

/** Upcoming first (soonest), then past (most recent first), then entries without a date. */
export function sortCountdowns(list, now = new Date()) {
  const rank = (x) => {
    const d = daysUntil(x.date, now)
    return d === null ? [2, 0] : d >= 0 ? [0, d] : [1, -d]
  }
  return [...list].sort((a, b) => {
    const [ra, da] = rank(a)
    const [rb, db] = rank(b)
    return ra - rb || da - db
  })
}

/** Finish a config before it is saved: write the list, drop blank rows and the pre-list keys. */
export function normalise(config) {
  const { label, date, ...rest } = config
  const list = countdownsOf(config)
    .map((x) => ({ label: (x.label || '').trim(), date: x.date || '' }))
    .filter((x) => x.label || x.date)
  return { ...rest, countdowns: list.length ? list : [{ label: '', date: '' }], layout: layoutOf(config) }
}
