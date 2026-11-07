import { describe, it, expect } from 'vitest'
import { parseYamlCommand, readInput, targetFor, convert } from './engine.js'

describe('parseYamlCommand', () => {
  it('reads the command words', () => {
    expect(parseYamlCommand('yaml a: 1')).toEqual({ word: 'yaml', text: 'a: 1', from: null, to: null })
    expect(parseYamlCommand('YML\na: 1')).toEqual({ word: 'yaml', text: 'a: 1', from: null, to: null })
    expect(parseYamlCommand('toml')).toEqual({ word: 'toml', text: '', from: null, to: null })
    expect(parseYamlCommand('json2yaml {"a":1}')).toEqual({ word: 'json2yaml', text: '{"a":1}', from: 'json', to: 'yaml' })
    expect(parseYamlCommand('toml2yml a = 1')).toMatchObject({ from: 'toml', to: 'yaml' })
    expect(parseYamlCommand('YAML2TOML x')).toMatchObject({ from: 'yaml', to: 'toml' })
  })
  it('ignores everything else', () => {
    for (const q of ['', 'yamlish a', 'a yaml b', 'yaml2yaml x', 'json2json x', 'tomlx', 'my toml file', '1+1', 'yamls']) expect(parseYamlCommand(q), q).toBeNull()
  })
})

describe('readInput', () => {
  it('recognises JSON first', () => {
    expect(readInput('{"a": [1, 2]}')).toEqual({ ok: true, format: 'json', value: { a: [1, 2] } })
    expect(readInput('[1, 2]')).toMatchObject({ format: 'json' })
  })
  it('tells TOML from YAML', () => {
    expect(readInput('title = "x"\n[a]\nb = 1')).toMatchObject({ ok: true, format: 'toml', value: { title: 'x', a: { b: 1 } } })
    expect(readInput('title: x\na:\n  b: 1')).toMatchObject({ ok: true, format: 'yaml', value: { title: 'x', a: { b: 1 } } })
    expect(readInput('- a\n- b')).toMatchObject({ format: 'yaml' })
  })
  it('reads JSON with comments or trailing commas', () => {
    expect(readInput('{\n  // note\n  "a": 1,\n}')).toMatchObject({ ok: true, format: 'json', value: { a: 1 } })
  })
  it('honours an explicit source', () => {
    expect(readInput('a: 1', 'yaml')).toMatchObject({ format: 'yaml', value: { a: 1 } })
    expect(readInput('a = 1', 'yaml').value).toBe('a = 1') // valid YAML: one plain string
    const r = readInput('a: 1', 'toml')
    expect(r.ok).toBe(false)
    expect(r.format).toBe('toml')
    expect(r.error).toMatch(/^Line 1:/)
    expect(readInput('{bad', 'json').ok).toBe(false)
  })
  it('reports a mistake in the format the user asked for', () => {
    const r = readInput('a = 1\nb = "open', 'auto', 'toml')
    expect(r).toMatchObject({ ok: false, format: 'toml' })
    expect(r.error).toMatch(/^Line 2:.*never closed/)
    const y = readInput('a: 1\na: 2', 'auto', 'yaml')
    expect(y).toMatchObject({ ok: false, format: 'yaml' })
    expect(y.error).toMatch(/Duplicate key/)
  })
  it('asks for input when there is none', () => {
    expect(readInput('   ')).toMatchObject({ ok: false, error: 'Paste JSON, YAML or TOML into the box above.' })
  })
})

describe('targetFor', () => {
  it('flips between the asked-for format and JSON', () => {
    expect(targetFor('yaml', 'json')).toBe('yaml')
    expect(targetFor('yaml', 'toml')).toBe('yaml')
    expect(targetFor('yaml', 'yaml')).toBe('json')
    expect(targetFor('toml', 'json')).toBe('toml')
    expect(targetFor('toml', 'yaml')).toBe('toml')
    expect(targetFor('toml', 'toml')).toBe('json')
  })
})

describe('convert', () => {
  it('turns JSON into YAML and back', () => {
    const y = convert('{"name": "Home", "tags": ["a", "b"], "n": 1.5}', { word: 'yaml' })
    expect(y).toMatchObject({ ok: true, format: 'json', to: 'yaml', output: 'name: Home\ntags:\n  - a\n  - b\nn: 1.5\n' })
    const j = convert(y.output, { word: 'yaml' })
    expect(j).toMatchObject({ ok: true, format: 'yaml', to: 'json' })
    expect(JSON.parse(j.output)).toEqual({ name: 'Home', tags: ['a', 'b'], n: 1.5 })
  })
  it('turns JSON and YAML into TOML and back', () => {
    const t = convert('server:\n  host: x\n  ports: [80, 443]\nname: n', { word: 'toml' })
    expect(t).toMatchObject({ ok: true, format: 'yaml', to: 'toml', output: 'name = "n"\n\n[server]\nhost = "x"\nports = [80, 443]\n' })
    expect(JSON.parse(convert(t.output, { word: 'toml' }).output)).toEqual({ name: 'n', server: { host: 'x', ports: [80, 443] } })
  })
  it('uses an explicit source and target', () => {
    expect(convert('a = 1', { from: 'toml', to: 'yaml', word: 'toml2yaml' }).output).toBe('a: 1\n')
    expect(convert('a: 1', { from: 'yaml', to: 'json', word: 'yaml2json' }).output).toBe('{\n  "a": 1\n}')
  })
  it('passes warnings on', () => {
    const t = convert('{"a": null, "b": 1}', { word: 'toml' })
    expect(t.output).toBe('b = 1\n')
    expect(t.warnings[0]).toMatch(/TOML has no null/)
    const j = convert('a: .inf', { from: 'yaml', to: 'json' })
    expect(j.output).toBe('{\n  "a": ".inf"\n}') // not a number in YAML 1.2 core here: stays text
  })
  it('writes non-finite TOML numbers as text in JSON', () => {
    const r = convert('a = inf\nb = nan', { from: 'toml', to: 'json' })
    expect(JSON.parse(r.output)).toEqual({ a: 'Infinity', b: 'NaN' })
    expect(r.warnings[0]).toMatch(/infinity or NaN/)
  })
  it('explains what cannot be converted', () => {
    expect(convert('[1, 2]', { word: 'toml' })).toMatchObject({ ok: false, error: expect.stringMatching(/map/) })
    expect(convert('a: &x 1', { word: 'yaml' })).toMatchObject({ ok: false, error: expect.stringMatching(/Anchors/) })
    expect(convert('', { word: 'yaml' }).ok).toBe(false)
  })
  it('handles empty documents and scalars', () => {
    expect(convert('# nothing', { from: 'yaml', to: 'json' }).output).toBe('null')
    expect(convert('"just text"', { word: 'yaml' }).output).toBe('just text\n')
  })
})
