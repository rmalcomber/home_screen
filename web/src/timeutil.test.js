import { describe, it, expect } from 'vitest'
import { layoutOf, zonesOf, locationsOf, validZone, placeName, zoneInfo, shortOffset, dayLabel, forecastUrl, asArray, locationLabel } from './tiles/timeutil.js'

const NOON_UTC = new Date(Date.UTC(2026, 10, 6, 12, 0, 0))

describe('config migration', () => {
  it('keeps old single-zone and single-city configs working', () => {
    expect(zonesOf({ tz: 'Europe/Paris' })).toEqual([{ tz: 'Europe/Paris', label: '' }])
    expect(zonesOf({})).toEqual([{ tz: '', label: '' }])
    expect(zonesOf({ zones: [{ tz: 'UTC' }, { tz: '' }] })).toHaveLength(2)
    expect(locationsOf({ city: 'London', lat: 51.5, lon: -0.1 })).toEqual([{ city: 'London', name: undefined, lat: 51.5, lon: -0.1, country: undefined }])
    expect(locationsOf({})).toEqual([])
    expect(locationsOf({ locations: [{ city: 'A' }, { city: 'B' }] })).toHaveLength(2)
  })
})

describe('layout', () => {
  it('defaults to a list and accepts mini tiles', () => {
    expect(layoutOf({})).toBe('list')
    expect(layoutOf(undefined)).toBe('list')
    expect(layoutOf({ layout: 'tiles' })).toBe('tiles')
    expect(layoutOf({ layout: 'whatever' })).toBe('list')
  })
})

describe('zones', () => {
  it('validates and names zones', () => {
    expect(validZone('')).toBe(true)
    expect(validZone('Asia/Tokyo')).toBe(true)
    expect(validZone('Mars/Olympus')).toBe(false)
    expect(placeName('America/New_York')).toBe('New York')
    expect(placeName('')).toBe('Local time')
    expect(placeName('UTC')).toBe('UTC')
  })
  it('formats the time in a given zone with its offset', () => {
    const tokyo = zoneInfo({ tz: 'Asia/Tokyo' }, NOON_UTC, { hour12: false, seconds: true })
    expect(tokyo).toMatchObject({ name: 'Tokyo', tzName: 'Asia/Tokyo', time: '21:00:00', offset: 'UTC+9' })
    expect(zoneInfo({ tz: 'Asia/Kolkata' }, NOON_UTC)).toMatchObject({ time: '17:30:00', offset: 'UTC+5:30' })
    expect(zoneInfo({ tz: 'UTC' }, NOON_UTC)).toMatchObject({ time: '12:00:00', offset: 'UTC', dayDiff: expect.any(Number) })
    expect(zoneInfo({ tz: 'UTC', label: 'HQ' }, NOON_UTC, { seconds: false }).time).toBe('12:00')
    expect(zoneInfo({ tz: 'Asia/Tokyo' }, NOON_UTC, { hour12: true }).time).toMatch(/09:00:00\s?pm/i)
    expect(zoneInfo({ tz: 'UTC', label: 'HQ' }, NOON_UTC).name).toBe('HQ')
  })
  it('formats offsets and day labels', () => {
    expect(shortOffset('GMT')).toBe('UTC')
    expect(shortOffset('GMT-08:00')).toBe('UTC-8')
    expect(shortOffset('GMT+05:45')).toBe('UTC+5:45')
    expect(dayLabel(0)).toBe('')
    expect(dayLabel(1)).toBe('Tomorrow')
    expect(dayLabel(-1)).toBe('Yesterday')
    expect(dayLabel(2)).toBe('+2 days')
  })
})

describe('weather helpers', () => {
  it('builds one request for several places', () => {
    const url = forecastUrl([{ lat: 51.5, lon: -0.12 }, { lat: 35.7, lon: 139.7 }], true)
    expect(url).toContain('latitude=51.5,35.7&longitude=-0.12,139.7')
    expect(url).toContain('temperature_unit=fahrenheit')
    expect(forecastUrl([{ lat: 1, lon: 2 }], false)).not.toContain('fahrenheit')
    expect(asArray({ a: 1 })).toEqual([{ a: 1 }])
    expect(asArray([1, 2])).toEqual([1, 2])
    expect(asArray(null)).toEqual([])
  })
  it('labels a location with its country', () => {
    expect(locationLabel({ city: 'London', country: 'GB' })).toBe('London, GB')
    expect(locationLabel({ city: 'Paris', name: 'Paris', country: 'FR' })).toBe('Paris, FR')
    expect(locationLabel({ city: 'Nowhere' })).toBe('Nowhere')
  })
})
