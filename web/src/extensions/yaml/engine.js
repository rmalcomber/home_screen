// Converting between JSON, YAML and TOML for the launcher. Pure; unit tested in engine.test.js.
//
//   yaml <text> | yml <text>     JSON or TOML -> YAML, YAML -> JSON
//   toml <text>                  JSON or YAML -> TOML, TOML -> JSON
//   json2yaml | yaml2json | json2toml | toml2json | yaml2toml | toml2yaml <text>
import { parseJson } from '../../core/lib/json.js'
import { parseYaml, toYaml, YamlError } from './yaml.js'
import { parseToml, toToml, TomlError } from './toml.js'

export const FORMATS = ['json', 'yaml', 'toml']
export const FORMAT_NAME = { json: 'JSON', yaml: 'YAML', toml: 'TOML' }
const ALIAS = { yml: 'yaml' }

/** { word, text, from, to } for "yaml …", "toml …" and "a2b …", or null. `from` / `to` are null when they are worked out later. */
export function parseYamlCommand(q) {
  const m = /^\s*(yaml|yml|toml|(?:json|yaml|yml|toml)2(?:json|yaml|yml|toml))(?:[ \t]+|\r?\n|$)([\s\S]*)$/i.exec(q || '')
  if (!m) return null
  const word = m[1].toLowerCase()
  const text = m[2].replace(/\s+$/, '')
  const pair = /^(json|yaml|yml|toml)2(json|yaml|yml|toml)$/.exec(word)
  if (pair) {
    const from = ALIAS[pair[1]] || pair[1]
    const to = ALIAS[pair[2]] || pair[2]
    return from === to ? null : { word, text, from, to }
  }
  return { word: ALIAS[word] || word, text, from: null, to: null }
}

const looksLikeToml = (text) => /^\s*(\[\[?\s*[A-Za-z0-9_"'. -]+\s*\]\]?\s*(#.*)?$|[A-Za-z0-9_-]+(\s*\.\s*[A-Za-z0-9_-]+)*\s*=)/m.test(text)

const describe = (e) => e.message

/**
 * Reads text in the given format ('json', 'yaml', 'toml') or works the format out ('auto'): strict JSON first, then
 * relaxed JSON (comments, trailing commas) for text that starts with [ or {, then TOML when it has key = value lines or
 * [table] headers, otherwise YAML. When both TOML and YAML fail, the error is the one from the format the text looks like.
 * Returns { ok: true, format, value } or { ok: false, format, error }.
 */
export function readInput(text, from = 'auto') {
  const t = String(text)
  if (!t.trim()) return { ok: false, format: from === 'auto' ? 'json' : from, error: 'Paste JSON, YAML or TOML into the box above.' }
  const asJson = () => {
    const r = parseJson(t)
    return r.ok ? { ok: true, format: 'json', value: r.value } : { ok: false, format: 'json', error: r.error }
  }
  const asYaml = () => {
    try {
      return { ok: true, format: 'yaml', value: parseYaml(t) }
    } catch (e) {
      if (!(e instanceof YamlError)) throw e
      return { ok: false, format: 'yaml', error: describe(e) }
    }
  }
  const asToml = () => {
    try {
      return { ok: true, format: 'toml', value: parseToml(t) }
    } catch (e) {
      if (!(e instanceof TomlError)) throw e
      return { ok: false, format: 'toml', error: describe(e) }
    }
  }
  if (from === 'json') return asJson()
  if (from === 'yaml') return asYaml()
  if (from === 'toml') return asToml()
  try {
    return { ok: true, format: 'json', value: JSON.parse(t) } // strict JSON first: it is also the most common input
  } catch {}
  if (/^s*[[{]/.test(t)) {
    const j = asJson() // JSON with comments or trailing commas, or a JavaScript-style object
    if (j.ok) return j
  }
  if (looksLikeToml(t)) {
    const r = asToml()
    if (r.ok) return r
    const y = asYaml()
    return y.ok && typeof y.value === 'object' && y.value !== null ? y : r
  }
  return asYaml()
}

/** The format to write when the user did not pick one: YAML for yaml, TOML for toml, and JSON when the input already was that. */
export function targetFor(word, format) {
  if (word === 'toml') return format === 'toml' ? 'json' : 'toml'
  return format === 'yaml' ? 'json' : 'yaml'
}

const asText = (n) => (Number.isNaN(n) ? 'NaN' : n > 0 ? 'Infinity' : '-Infinity')

/** Converts `text` to the `to` format. Returns { ok, format, to, output, warnings } or { ok: false, format, error }. */
export function convert(text, { from = 'auto', to, word = 'yaml' } = {}) {
  const r = readInput(text, from)
  if (!r.ok) return r
  const target = to || targetFor(word, r.format)
  const warnings = []
  try {
    if (target === 'json') {
      let nonFinite = false
      const output = JSON.stringify(r.value === undefined ? null : r.value, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? ((nonFinite = true), asText(v)) : v), 2)
      if (nonFinite) warnings.push('JSON has no infinity or NaN: written as text')
      return { ok: true, format: r.format, to: target, output, warnings }
    }
    if (target === 'yaml') return { ok: true, format: r.format, to: target, output: toYaml(r.value === undefined ? null : r.value), warnings }
    const t = toToml(r.value)
    return { ok: true, format: r.format, to: target, output: t.text, warnings: t.warnings }
  } catch (e) {
    if (e instanceof TomlError || e instanceof YamlError) return { ok: false, format: r.format, error: e.message }
    throw e
  }
}

/** The launcher text that reopens a conversion. */
export const yamlFill = (word, text) => `${word} ${text}`
