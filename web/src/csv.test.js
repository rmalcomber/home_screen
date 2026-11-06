import { describe, it, expect } from 'vitest'
import { parseCsv, detectDelimiter, inferType, rowsToJson, jsonToRows, toCsv, csvToJson, jsonToCsv, parseCsvCommand } from './launcher/csv.js'

describe('parseCsv', () => {
  it('handles quotes, escapes, embedded newlines and CRLF', () => {
    const t = 'a,b,c\r\n1,"x, y","say ""hi"""\r\n"multi\nline",,3\r\n'
    expect(parseCsv(t).rows).toEqual([['a', 'b', 'c'], ['1', 'x, y', 'say "hi"'], ['multi\nline', '', '3']])
  })
  it('drops blank lines, strips a BOM, and flags an unterminated quote', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n').rows).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCsv('a,b\n1,"oops').unterminated).toBe(true)
    expect(parseCsv('a;b\n1;2', ';').rows[1]).toEqual(['1', '2'])
  })
  it('only treats a quote as special at the start of a field', () => {
    expect(parseCsv('5" pipe,ok').rows).toEqual([['5" pipe', 'ok']])
  })
})

describe('detectDelimiter', () => {
  it('finds comma, tab, semicolon and pipe', () => {
    expect(detectDelimiter('a,b\n1,2')).toBe(',')
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t')
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';')
    expect(detectDelimiter('a|b\n1|2')).toBe('|')
    expect(detectDelimiter('name;note\nAda;"hello, world"')).toBe(';')
    expect(detectDelimiter('just text')).toBe(',')
  })
})

describe('rowsToJson', () => {
  const rows = [['name', 'age', 'ok', 'note'], ['Ada', '36', 'true', ''], ['Bob', '4.5', 'FALSE', 'x'], ['007', '1e3', 'maybe', ' pad ']]
  it('builds objects with type inference', () => {
    const { value } = rowsToJson(rows)
    expect(value).toEqual([
      { name: 'Ada', age: 36, ok: true, note: null },
      { name: 'Bob', age: 4.5, ok: false, note: 'x' },
      { name: '007', age: 1000, ok: 'maybe', note: 'pad' },
    ])
  })
  it('honours the options', () => {
    expect(rowsToJson(rows, { infer: false, emptyNull: false, trim: false }).value[2]).toEqual({ name: '007', age: '1e3', ok: 'maybe', note: ' pad ' })
    expect(rowsToJson(rows, { shape: 'arrays' }).value[0]).toEqual(['Ada', 36, true, null])
    expect(rowsToJson(rows, { header: false }).value[0]).toEqual(['name', 'age', 'ok', 'note'])
    expect(rowsToJson(rows, { shape: 'keyed' }).value.Ada).toEqual({ age: 36, ok: true, note: null })
  })
  it('fixes duplicate/empty headers and reports ragged rows', () => {
    const r = rowsToJson([['a', 'a', ''], ['1', '2', '3', '4'], ['5']])
    expect(r.columns).toEqual(['a', 'a_2', 'column_3'])
    expect(r.value).toEqual([{ a: 1, a_2: 2, column_3: 3 }, { a: 5, a_2: null, column_3: null }])
    expect(r.warnings[0]).toMatch(/2 rows have/)
  })
  it('keeps big integers and leading zeros as strings', () => {
    expect(inferType('12345678901234567890')).toBe('12345678901234567890')
    expect(inferType('0123')).toBe('0123')
    expect(inferType('-0.5')).toBe(-0.5)
    expect(inferType('1e999')).toBe('1e999')
  })
})

describe('JSON → CSV', () => {
  it('unions keys, flattens nested objects and stringifies arrays', () => {
    const { header, rows } = jsonToRows([{ id: 1, user: { name: 'Ada', tags: ['a', 'b'] } }, { id: 2, extra: true }])
    expect(header).toEqual(['id', 'user.name', 'user.tags', 'extra'])
    expect(rows).toEqual([[1, 'Ada', ['a', 'b'], undefined], [2, undefined, undefined, true]])
    expect(jsonToRows([{ a: { b: 1 } }], { flatten: false }).header).toEqual(['a'])
  })
  it('handles arrays of arrays, primitives, single objects and keyed objects', () => {
    expect(jsonToRows([[1, 2], [3, 4]])).toEqual({ header: null, rows: [[1, 2], [3, 4]] })
    expect(jsonToRows([1, 'x'])).toEqual({ header: ['value'], rows: [[1], ['x']] })
    expect(jsonToRows({ a: 1, b: 2 })).toEqual({ header: ['a', 'b'], rows: [[1, 2]] })
    expect(jsonToRows({ u1: { n: 1 }, u2: { n: 2 } })).toEqual({ header: ['key', 'n'], rows: [['u1', 1], ['u2', 2]] })
  })
  it('quotes where needed', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['line\nbreak', ' pad'], [null, 5]])).toBe('a,b\n"x,y","say ""hi"""\n"line\nbreak"," pad"\n,5\n')
    expect(toCsv(['a'], [['x']], { quoteAll: true, delimiter: ';' })).toBe('"a"\n"x"\n')
    expect(toCsv(['a'], [['x']], { includeHeader: false })).toBe('x\n')
  })
})

describe('end to end', () => {
  it('converts CSV to pretty, minified and JSON Lines output', () => {
    const csv = 'name,age\nAda,36\nBob,4'
    expect(JSON.parse(csvToJson(csv).output)).toEqual([{ name: 'Ada', age: 36 }, { name: 'Bob', age: 4 }])
    expect(csvToJson(csv, { outFmt: 'min' }).output).toBe('[{"name":"Ada","age":36},{"name":"Bob","age":4}]')
    expect(csvToJson(csv, { outFmt: 'lines' }).output).toBe('{"name":"Ada","age":36}\n{"name":"Bob","age":4}')
    expect(csvToJson('name\tage\nAda\t36')).toMatchObject({ delimiter: '\t', count: 1 })
    expect(csvToJson('   ').error).toMatch(/Nothing to convert/)
  })
  it('round-trips JSON to CSV and back', () => {
    const json = '[{"id":1,"name":"Ada, L","ok":true},{"id":2,"name":"Bob","ok":false}]'
    const csv = jsonToCsv(json)
    expect(csv.output).toBe('id,name,ok\n1,"Ada, L",true\n2,Bob,false\n')
    expect(JSON.parse(csvToJson(csv.output).output)).toEqual(JSON.parse(json))
    expect(jsonToCsv('[{"a":1,}]').warnings[0]).toMatch(/tolerated/)
    expect(jsonToCsv('{nope').error).toMatch(/isn't valid JSON/)
  })
})

describe('parseCsvCommand', () => {
  it('recognises prefixes and obviously-tabular data', () => {
    expect(parseCsvCommand('csv\na,b\n1,2')).toEqual({ text: 'a,b\n1,2' })
    expect(parseCsvCommand('tsv a\tb')).toEqual({ text: 'a\tb' })
    expect(parseCsvCommand('csv')).toEqual({ text: '' })
    expect(parseCsvCommand('name,age\nAda,36')).toEqual({ text: 'name,age\nAda,36' })
    expect(parseCsvCommand('a\tb\n1\t2\n3\t4')).toBeTruthy()
  })
  it('leaves everything else alone', () => {
    expect(parseCsvCommand('github')).toBeNull()
    expect(parseCsvCommand('one line, with a comma')).toBeNull()
    expect(parseCsvCommand('[{"a":1}]\n[{"a":2}]')).toBeNull()
    expect(parseCsvCommand('some prose\nwith lines\nand no delimiters')).toBeNull()
    expect(parseCsvCommand('a,b\n1,2,3')).toBeNull() // ragged: not clearly CSV without the prefix
    expect(parseCsvCommand('csvfile')).toBeNull()
  })
})
