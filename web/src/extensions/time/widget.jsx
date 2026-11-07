// Clock and weather widgets. Both show several time zones / places in one tile, either as a list or as mini tiles.
import { useState, useEffect } from 'preact/hooks'
import { zonesOf, locationsOf, layoutOf, validZone, allZones, zoneInfo, dayLabel, forecastUrl, asArray, locationLabel, placeName } from './timeutil.js'

function useNow(ms) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

const Row = ({ children }) => <div class="flex items-center gap-1">{children}</div>
const Remove = ({ onClick, title = 'Remove' }) => <button type="button" class="btn btn-sm btn-ghost btn-square" title={title} onClick={onClick}>✕</button>

/** List / mini-tiles switch used by both widgets' settings. */
function LayoutChoice({ config, set }) {
  const layout = layoutOf(config)
  return (
    <div class="grid gap-1">
      <span class="text-xs">Layout when there is more than one</span>
      <div role="tablist" class="tabs tabs-box tabs-xs w-fit">
        <button type="button" role="tab" class={`tab ${layout === 'list' ? 'tab-active' : ''}`} onClick={() => set({ layout: 'list' })}>List</button>
        <button type="button" role="tab" class={`tab ${layout === 'tiles' ? 'tab-active' : ''}`} onClick={() => set({ layout: 'tiles' })}>Mini tiles</button>
      </div>
    </div>
  )
}

/** Mini tiles flow left to right and wrap onto new rows when the tile is narrow. */
const MiniTiles = ({ children }) => <div class="flex flex-wrap gap-2">{children}</div>
const MiniTile = ({ children }) => <div class="flex-1 basis-28 min-w-0 rounded-lg bg-base-200 border border-base-300 px-2 py-1.5 text-center">{children}</div>

// ------------------------------------------------------------------ clock
const POPULAR = [['UTC', 'UTC'], ['Europe/London', 'London'], ['America/New_York', 'New York'], ['America/Los_Angeles', 'Los Angeles'], ['Europe/Paris', 'Paris'], ['Asia/Dubai', 'Dubai'], ['Asia/Kolkata', 'Mumbai'], ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney']]

export const clock = {
  Body({ tile }) {
    const c = tile.config
    const now = useNow(c.seconds ? 1000 : 10000)
    const infos = zonesOf(c).map((z) => ({ ...zoneInfo(z, now, c), bad: !validZone(z.tz) }))

    if (infos.length === 1) {
      const i = infos[0]
      return (
        <div class="flex flex-col items-center justify-center h-full gap-1">
          <div class="text-sm font-semibold opacity-80">{i.name}</div>
          <div class="text-4xl font-mono font-bold tabular-nums">{i.bad ? '—' : i.time}</div>
          <div class="text-sm opacity-70">{i.bad ? 'Unknown time zone' : i.date}</div>
          <div class="text-xs opacity-60">{i.tzName} · {i.abbr}{i.offset && i.offset !== i.abbr ? ` (${i.offset})` : ''}</div>
        </div>
      )
    }

    if (layoutOf(c) === 'tiles') {
      return (
        <MiniTiles>
          {infos.map((i, k) => (
            <MiniTile key={k}>
              <div class="text-xs font-semibold truncate" title={i.tzName}>{i.name}</div>
              <div class="font-mono text-lg font-bold tabular-nums leading-tight">{i.bad ? '—' : i.time}</div>
              <div class="text-[11px] opacity-60 truncate">{i.bad ? 'Unknown zone' : `${i.date}${dayLabel(i.dayDiff) ? ' · ' + dayLabel(i.dayDiff) : ''}`}</div>
              <div class="text-[10px] opacity-50 truncate">{i.abbr}{i.offset && i.offset !== i.abbr ? ` · ${i.offset}` : ''}</div>
            </MiniTile>
          ))}
        </MiniTiles>
      )
    }

    return (
      <ul class="flex flex-col divide-y divide-base-300">
        {infos.map((i, k) => (
          <li key={k} class="flex items-center gap-2 py-1.5 px-1">
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-sm truncate">{i.name}</div>
              <div class="text-xs opacity-60 truncate">{i.tzName} · {i.abbr}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="font-mono text-xl font-bold tabular-nums leading-tight">{i.bad ? '—' : i.time}</div>
              <div class="text-xs opacity-60">{i.bad ? 'Unknown time zone' : `${i.date}${dayLabel(i.dayDiff) ? ' · ' + dayLabel(i.dayDiff) : ''}`}</div>
            </div>
          </li>
        ))}
      </ul>
    )
  },
  Options({ config, set }) {
    const zones = zonesOf(config)
    const setZone = (i, patch) => set({ zones: zones.map((z, j) => (j === i ? { ...z, ...patch } : z)) })
    return (
      <div class="grid gap-2">
        <span class="text-xs">Time zones <span class="opacity-60">(leave the zone blank for your local time)</span></span>
        <datalist id="tz-list">{allZones().map((z) => <option key={z} value={z} />)}</datalist>
        {zones.map((z, i) => (
          <Row key={i}>
            <input list="tz-list" class={`input input-sm input-bordered flex-1 min-w-0 ${validZone(z.tz) ? '' : 'input-error'}`} placeholder="Local, or e.g. Europe/London" value={z.tz || ''} onInput={(e) => setZone(i, { tz: e.target.value.trim() })} />
            <input class="input input-sm input-bordered w-32" placeholder={`Name (${placeName(z.tz)})`} value={z.label || ''} onInput={(e) => setZone(i, { label: e.target.value })} />
            {zones.length > 1 && <Remove onClick={() => set({ zones: zones.filter((_, j) => j !== i) })} title="Remove time zone" />}
          </Row>
        ))}
        <div class="flex flex-wrap items-center gap-1">
          <button type="button" class="btn btn-sm btn-outline" onClick={() => set({ zones: [...zones, { tz: '', label: '' }] })}>+ Add time zone</button>
          <span class="text-xs opacity-60 ml-1">Quick add:</span>
          {POPULAR.filter(([tz]) => !zones.some((z) => z.tz === tz)).map(([tz, name]) => (
            <button key={tz} type="button" class="btn btn-xs btn-ghost" onClick={() => set({ zones: [...zones, { tz, label: '' }] })}>{name}</button>
          ))}
        </div>
        <LayoutChoice config={config} set={set} />
        <label class="label cursor-pointer justify-start gap-2"><input type="checkbox" class="checkbox checkbox-sm" checked={!!config.hour12} onChange={(e) => set({ hour12: e.target.checked })} /><span class="label-text">12-hour clock</span></label>
        <label class="label cursor-pointer justify-start gap-2"><input type="checkbox" class="checkbox checkbox-sm" checked={config.seconds !== false} onChange={(e) => set({ seconds: e.target.checked })} /><span class="label-text">Show seconds</span></label>
      </div>
    )
  },
}

// ---------------------------------------------------------------- weather (Open-Meteo, no API key)
const WMO = { 0: ['☀️', 'Clear'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'], 45: ['🌫️', 'Fog'], 48: ['🌫️', 'Rime fog'], 51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Heavy drizzle'], 61: ['🌧️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'], 71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'], 80: ['🌦️', 'Showers'], 81: ['🌧️', 'Showers'], 82: ['⛈️', 'Violent showers'], 95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Thunder + hail'], 99: ['⛈️', 'Thunder + hail'] }

export async function geocode(city) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
  const j = await r.json()
  const g = j.results?.[0]
  if (!g) throw new Error(`City not found: ${city}`)
  return { name: g.name, country: g.country_code, lat: g.latitude, lon: g.longitude }
}

export const weather = {
  Body({ tile }) {
    const c = tile.config
    const locs = locationsOf(c).filter((l) => l.lat != null)
    const key = locs.map((l) => `${l.lat},${l.lon}`).join('|') + (c.fahrenheit ? 'F' : 'C')
    const [data, setData] = useState(null)
    const [err, setErr] = useState('')
    useEffect(() => {
      if (!locs.length) return
      let dead = false
      const go = () =>
        fetch(forecastUrl(locs, c.fahrenheit))
          .then((r) => r.json())
          .then((j) => !dead && (setData(asArray(j)), setErr('')))
          .catch(() => !dead && setErr('Weather unavailable'))
      go()
      const id = setInterval(go, 15 * 60 * 1000)
      return () => { dead = true; clearInterval(id) }
    }, [key])

    if (!locs.length) return <p class="text-sm opacity-60 p-2">Edit this tile and add at least one city.</p>
    if (err) return <p class="text-sm text-error p-2">{err}</p>
    if (!data || data.length !== locs.length) return <p class="text-sm opacity-60 p-2">Loading…</p>
    const u = c.fahrenheit ? '°F' : '°C'
    const rows = locs.map((l, i) => {
      const d = data[i]
      const [emoji, text] = WMO[d?.current?.weather_code] || ['🌡️', '']
      return { name: locationLabel(l), emoji, text, temp: Math.round(d?.current?.temperature_2m), hi: Math.round(d?.daily?.temperature_2m_max?.[0]), lo: Math.round(d?.daily?.temperature_2m_min?.[0]), wind: Math.round(d?.current?.wind_speed_10m) }
    })

    if (rows.length === 1) {
      const r = rows[0]
      return (
        <div class="flex flex-col items-center justify-center h-full gap-0.5">
          <div class="text-sm font-semibold opacity-80">{r.name}</div>
          <div class="text-4xl">{r.emoji}</div>
          <div class="text-3xl font-bold">{r.temp}{u}</div>
          <div class="text-sm">{r.text}</div>
          <div class="text-xs opacity-60">H {r.hi}° · L {r.lo}° · {r.wind} km/h</div>
        </div>
      )
    }

    if (layoutOf(c) === 'tiles') {
      return (
        <MiniTiles>
          {rows.map((r, i) => (
            <MiniTile key={i}>
              <div class="text-xs font-semibold truncate" title={r.name}>{r.name}</div>
              <div class="text-2xl leading-tight">{r.emoji}</div>
              <div class="text-lg font-bold leading-tight">{r.temp}{u}</div>
              <div class="text-[11px] opacity-70 truncate">{r.text}</div>
              <div class="text-[10px] opacity-50 truncate">H {r.hi}° · L {r.lo}°</div>
            </MiniTile>
          ))}
        </MiniTiles>
      )
    }

    return (
      <ul class="flex flex-col divide-y divide-base-300">
        {rows.map((r, i) => (
          <li key={i} class="flex items-center gap-2 py-1.5 px-1">
            <span class="text-2xl shrink-0">{r.emoji}</span>
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-sm truncate">{r.name}</div>
              <div class="text-xs opacity-60 truncate">{r.text} · {r.wind} km/h</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-xl font-bold leading-tight">{r.temp}{u}</div>
              <div class="text-xs opacity-60">H {r.hi}° · L {r.lo}°</div>
            </div>
          </li>
        ))}
      </ul>
    )
  },
  Options({ config, set }) {
    const locs = locationsOf(config).length ? locationsOf(config) : [{ city: '', lat: null, lon: null }]
    const setLoc = (i, patch) => set({ locations: locs.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
    return (
      <div class="grid gap-2">
        <span class="text-xs">Places</span>
        {locs.map((l, i) => (
          <Row key={i}>
            <input class="input input-sm input-bordered flex-1" placeholder="City, e.g. London" value={l.city || ''} onInput={(e) => setLoc(i, { city: e.target.value, name: undefined, country: undefined, lat: null, lon: null })} />
            {locs.length > 1 && <Remove onClick={() => set({ locations: locs.filter((_, j) => j !== i) })} title="Remove place" />}
          </Row>
        ))}
        <button type="button" class="btn btn-sm btn-outline self-start" onClick={() => set({ locations: [...locs, { city: '', lat: null, lon: null }] })}>+ Add place</button>
        <LayoutChoice config={config} set={set} />
        <label class="label cursor-pointer justify-start gap-2"><input type="checkbox" class="checkbox checkbox-sm" checked={!!config.fahrenheit} onChange={(e) => set({ fahrenheit: e.target.checked })} /><span class="label-text">Fahrenheit</span></label>
        <p class="text-xs opacity-60">Each place is looked up when you save.</p>
      </div>
    )
  },
  // Look up every place that has a name but no coordinates yet.
  async prepare(config) {
    const out = []
    for (const l of locationsOf(config)) {
      if (!l.city?.trim()) continue
      out.push(l.lat != null ? l : { ...l, ...(await geocode(l.city)) })
    }
    const { city: _c, lat: _a, lon: _o, name: _n, country: _y, ...rest } = config // drop the old single-place fields
    return { ...rest, locations: out }
  },
}
