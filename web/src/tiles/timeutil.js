// Pure helpers for the clock and weather widgets (several time zones / several places per widget). Unit tested.

/** Clock zones; migrates the old single `tz` config. A blank tz means the browser's local zone. */
export const zonesOf = (c) => (Array.isArray(c?.zones) && c.zones.length ? c.zones : [{ tz: c?.tz || '', label: '' }])

/** Weather locations; migrates the old single `city/lat/lon` config. */
export const locationsOf = (c) => (Array.isArray(c?.locations) ? c.locations : c?.city ? [{ city: c.city, name: c.name, lat: c.lat ?? null, lon: c.lon ?? null, country: c.country }] : [])

/** How several zones / places are shown: stacked 'list' (default) or side-by-side 'tiles'. */
export const layoutOf = (c) => (c?.layout === 'tiles' ? 'tiles' : 'list')

export const validZone = (tz) => {
  if (!tz) return true
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true } catch { return false }
}
export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
export const allZones = () => (typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [])

/** "America/New_York" → "New York" */
export const placeName = (tz) => (tz ? tz.split('/').pop().replace(/_/g, ' ') : 'Local time')

const ymd = (d, timeZone) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]))
  return Date.UTC(+p.year, +p.month - 1, +p.day)
}

/** GMT+05:30 → UTC+5:30 ; GMT → UTC */
export const shortOffset = (s) => {
  const m = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(s || '')
  if (!m) return s || ''
  if (!m[1] || (+m[2] === 0 && m[3] === '00')) return 'UTC'
  return `UTC${m[1]}${+m[2]}${m[3] === '00' ? '' : ':' + m[3]}`
}

/** Everything the clock needs to show one zone at `now`. dayDiff is relative to the viewer's local date. */
export function zoneInfo(zone, now, { hour12 = false, seconds = true } = {}) {
  const timeZone = zone.tz || undefined
  const f = (o) => new Intl.DateTimeFormat('en-GB', { timeZone, ...o })
  const part = (o) => f(o).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value || ''
  return {
    name: zone.label || placeName(zone.tz),
    tzName: zone.tz || localZone(),
    time: f({ hour: '2-digit', minute: '2-digit', second: seconds ? '2-digit' : undefined, hour12 }).format(now),
    date: f({ weekday: 'short', day: 'numeric', month: 'short' }).format(now),
    abbr: part({ timeZoneName: 'short' }),
    offset: shortOffset(part({ timeZoneName: 'longOffset' })),
    dayDiff: Math.round((ymd(now, timeZone) - ymd(now, undefined)) / 86400000),
  }
}

export const dayLabel = (n) => (n === 0 ? '' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n > 0 ? `+${n} days` : `${n} days`)

/** One Open-Meteo request for all locations (it returns an object for one place and an array for several). */
export function forecastUrl(locs, fahrenheit) {
  const lat = locs.map((l) => l.lat).join(',')
  const lon = locs.map((l) => l.lon).join(',')
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto${fahrenheit ? '&temperature_unit=fahrenheit' : ''}`
}
export const asArray = (json) => (Array.isArray(json) ? json : json ? [json] : [])

/** "London, GB" */
export const locationLabel = (l) => [l.name || l.city, l.country].filter(Boolean).join(', ')
