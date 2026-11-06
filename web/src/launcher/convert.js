// Unit converter for the launcher: "10 km to miles", "5 ft in cm", "100f to c", "2h in min", "1.5gb to mb".
// Linear units are { cat, f } where f is the factor to the category's base unit. Temperature is special-cased.

import { calculate } from './calc.js'

const U = {}
const def = (cat, label, f, ...aliases) => {
  const u = { cat, label, f }
  for (const a of [label, ...aliases]) U[a] = u
}

// length (base: metre)
def('length', 'm', 1, 'meter', 'metre', 'meters', 'metres')
def('length', 'km', 1000, 'kilometer', 'kilometre', 'kilometers', 'kilometres')
def('length', 'cm', 0.01, 'centimeter', 'centimetre', 'centimeters', 'centimetres')
def('length', 'mm', 0.001, 'millimeter', 'millimetre', 'millimeters', 'millimetres')
def('length', 'µm', 1e-6, 'um', 'micron', 'microns', 'micrometer')
def('length', 'nm', 1e-9, 'nanometer', 'nanometers')
def('length', 'mi', 1609.344, 'mile', 'miles')
def('length', 'yd', 0.9144, 'yard', 'yards')
def('length', 'ft', 0.3048, 'foot', 'feet', "'")
def('length', 'in', 0.0254, 'inch', 'inches', '"')
def('length', 'nmi', 1852, 'nauticalmile', 'nauticalmiles')

// mass (base: kilogram)
def('mass', 'kg', 1, 'kilogram', 'kilograms', 'kilo', 'kilos')
def('mass', 'g', 0.001, 'gram', 'grams')
def('mass', 'mg', 1e-6, 'milligram', 'milligrams')
def('mass', 'µg', 1e-9, 'ug', 'microgram', 'micrograms')
def('mass', 't', 1000, 'tonne', 'tonnes', 'metricton')
def('mass', 'lb', 0.45359237, 'lbs', 'pound', 'pounds')
def('mass', 'oz', 0.028349523125, 'ounce', 'ounces')
def('mass', 'st', 6.35029318, 'stone', 'stones')

// volume (base: litre)
def('volume', 'l', 1, 'litre', 'liter', 'litres', 'liters')
def('volume', 'ml', 0.001, 'millilitre', 'milliliter', 'millilitres', 'milliliters')
def('volume', 'cl', 0.01, 'centilitre', 'centiliter')
def('volume', 'dl', 0.1, 'decilitre', 'deciliter')
def('volume', 'm³', 1000, 'm3', 'cubicmeter', 'cubicmetre')
def('volume', 'gal', 3.785411784, 'gallon', 'gallons', 'usgallon', 'usgal')
def('volume', 'imp gal', 4.54609, 'ukgallon', 'ukgal', 'impgal', 'imperialgallon', 'imperialgallons', 'ukgallons')
def('volume', 'qt', 0.946352946, 'quart', 'quarts')
def('volume', 'pt', 0.473176473, 'pint', 'pints', 'uspint')
def('volume', 'uk pt', 0.56826125, 'ukpint', 'ukpints', 'imperialpint', 'imppt')
def('volume', 'cup', 0.2365882365, 'cups')
def('volume', 'fl oz', 0.0295735295625, 'floz', 'fluidounce', 'fluidounces')
def('volume', 'tbsp', 0.01478676478125, 'tablespoon', 'tablespoons')
def('volume', 'tsp', 0.00492892159375, 'teaspoon', 'teaspoons')

// time (base: second)
def('time', 's', 1, 'sec', 'secs', 'second', 'seconds')
def('time', 'ms', 0.001, 'millisecond', 'milliseconds')
def('time', 'min', 60, 'mins', 'minute', 'minutes')
def('time', 'h', 3600, 'hr', 'hrs', 'hour', 'hours')
def('time', 'day', 86400, 'd', 'days')
def('time', 'week', 604800, 'wk', 'wks', 'weeks')
def('time', 'month', 2629800, 'mo', 'months')
def('time', 'year', 31557600, 'yr', 'yrs', 'years')

// data (base: byte)
def('data', 'bit', 1 / 8, 'bits')
def('data', 'B', 1, 'b', 'byte', 'bytes')
def('data', 'KB', 1e3, 'kb', 'kilobyte', 'kilobytes')
def('data', 'MB', 1e6, 'mb', 'megabyte', 'megabytes')
def('data', 'GB', 1e9, 'gb', 'gigabyte', 'gigabytes')
def('data', 'TB', 1e12, 'tb', 'terabyte', 'terabytes')
def('data', 'PB', 1e15, 'pb', 'petabyte', 'petabytes')
def('data', 'KiB', 1024, 'kib', 'kibibyte', 'kibibytes')
def('data', 'MiB', 1024 ** 2, 'mib', 'mebibyte', 'mebibytes')
def('data', 'GiB', 1024 ** 3, 'gib', 'gibibyte', 'gibibytes')
def('data', 'TiB', 1024 ** 4, 'tib', 'tebibyte', 'tebibytes')

// speed (base: m/s)
def('speed', 'm/s', 1, 'mps', 'meterspersecond', 'metrespersecond')
def('speed', 'km/h', 1 / 3.6, 'kph', 'kmh', 'kmph', 'kilometersperhour', 'kilometresperhour')
def('speed', 'mph', 0.44704, 'milesperhour')
def('speed', 'kn', 0.514444444, 'kt', 'knot', 'knots')
def('speed', 'ft/s', 0.3048, 'fps')

// area (base: square metre)
def('area', 'm²', 1, 'm2', 'sqm', 'sqmeter', 'sqmeters', 'sqmetre', 'sqmetres')
def('area', 'km²', 1e6, 'km2', 'sqkm')
def('area', 'cm²', 1e-4, 'cm2', 'sqcm')
def('area', 'ha', 1e4, 'hectare', 'hectares')
def('area', 'acre', 4046.8564224, 'acres')
def('area', 'ft²', 0.09290304, 'ft2', 'sqft', 'sqfoot', 'sqfeet')
def('area', 'in²', 0.00064516, 'in2', 'sqin', 'sqinch', 'sqinches')
def('area', 'yd²', 0.83612736, 'yd2', 'sqyd', 'sqyard', 'sqyards')
def('area', 'mi²', 2589988.110336, 'mi2', 'sqmi', 'sqmile', 'sqmiles')

// temperature
const TEMP = { c: 'c', celsius: 'c', f: 'f', fahrenheit: 'f', k: 'k', kelvin: 'k' }
const toK = { c: (v) => v + 273.15, f: (v) => ((v - 32) * 5) / 9 + 273.15, k: (v) => v }
const fromK = { c: (k) => k - 273.15, f: (k) => ((k - 273.15) * 9) / 5 + 32, k: (k) => k }
const TLABEL = { c: '°C', f: '°F', k: 'K' }

function lookup(raw) {
  let k = raw.toLowerCase().replace(/^(degrees?|deg|°)\s*/, '').replace(/[\s.]+/g, '').replace('²', '2').replace('³', '3')
  k = k.replace(/^square/, 'sq')
  if (TEMP[k]) return { temp: TEMP[k] }
  const keys = [k, k.endsWith('es') && k.slice(0, -2), k.endsWith('s') && k.slice(0, -1)].filter(Boolean)
  for (const key of keys) {
    if (U[key]) return U[key]
  }
  return null
}

export function parseValue(s) {
  s = s.trim()
  if (!s) return null
  if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return parseFloat(s)
  const c = calculate(s)
  return c ? c.value : null
}

const SEP = /\s*(?:\s+(?:to|in|as|into)\s+|->|=>|→)\s*/gi

function nice(v) {
  if (v === 0) return '0'
  const s = Number(v.toPrecision(8))
  return Math.abs(s) >= 1e15 || Math.abs(s) < 1e-6 ? s.toExponential() : String(s)
}

/** Candidate [left, right] splits at every "to/in/as/->" separator (overlapping, so "5 in in cm" tries both "in"s). */
export function splits(src) {
  const out = []
  SEP.lastIndex = 0
  for (let m; (m = SEP.exec(src)); SEP.lastIndex = m.index + 1) out.push({ left: src.slice(0, m.index), right: src.slice(m.index + m[0].length).trim() })
  return out
}

/** Returns { text, label, from, to } or null if the input isn't a conversion. */
export function convert(input) {
  const src = (input || '').trim()
  if (!src || src.length > 120) return null
  for (const { left, right } of splits(src)) {
    const lm = left.match(/^(.+?)\s*([a-z°µ'"][a-z°µ²³'"/ .]*)$/i)
    if (!lm || !right) continue
    const value = parseValue(lm[1])
    const a = lookup(lm[2])
    const b = lookup(right)
    if (value == null || !a || !b) continue
    let out, fromL, toL
    if (a.temp && b.temp) {
      out = fromK[b.temp](toK[a.temp](value))
      fromL = TLABEL[a.temp]
      toL = TLABEL[b.temp]
    } else if (!a.temp && !b.temp && a.cat === b.cat) {
      out = (value * a.f) / b.f
      fromL = a.label
      toL = b.label
    } else continue
    const text = nice(out)
    return { text, label: `${nice(value)} ${fromL} = ${text} ${toL}`, from: fromL, to: toL }
  }
  return null
}
