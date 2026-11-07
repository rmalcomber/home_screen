import { describe, it, expect } from 'vitest'
import { parseCaseCommand, splitWords, toCamel, toPascal, toSnake, toScreaming, toKebab, toDot, toPath, toTitle, toSentence, slugify, conversions, textStats } from './engine.js'

describe('parseCaseCommand', () => {
  it('recognises the command words and normalises aliases', () => {
    expect(parseCaseCommand('snake Hello World')).toEqual({ word: 'snake', text: 'Hello World' })
    expect(parseCaseCommand('SLUGIFY  A  B ')).toEqual({ word: 'slug', text: 'A  B' })
    expect(parseCaseCommand('wc one two')).toEqual({ word: 'count', text: 'one two' })
    expect(parseCaseCommand('case a\nb')).toEqual({ word: 'case', text: 'a\nb' })
  })
  it('needs text after the word and ignores other queries', () => {
    for (const q of ['', 'snake', 'snakes are long', 'a snake b', 'camelcase x', 'upper']) expect(parseCaseCommand(q), q).toBeNull()
  })
})

describe('splitWords', () => {
  it('splits identifiers, phrases and acronyms', () => {
    expect(splitWords('helloWorld')).toEqual(['hello', 'World'])
    expect(splitWords('HTMLParser_v2-beta')).toEqual(['HTML', 'Parser', 'v2', 'beta'])
    expect(splitWords('  many   spaces, and.punctuation/here ')).toEqual(['many', 'spaces', 'and', 'punctuation', 'here'])
    expect(splitWords('ÉcoleNormale supérieure')).toEqual(['École', 'Normale', 'supérieure'])
    expect(splitWords('!!!')).toEqual([])
  })
})

describe('identifier cases', () => {
  const input = 'user Account_id-Number'
  it('converts to each form', () => {
    expect(toCamel(input)).toBe('userAccountIdNumber')
    expect(toPascal(input)).toBe('UserAccountIdNumber')
    expect(toSnake(input)).toBe('user_account_id_number')
    expect(toScreaming(input)).toBe('USER_ACCOUNT_ID_NUMBER')
    expect(toKebab(input)).toBe('user-account-id-number')
    expect(toDot(input)).toBe('user.account.id.number')
    expect(toPath(input)).toBe('user/account/id/number')
  })
  it('lower-cases acronyms in camelCase', () => {
    expect(toCamel('HTMLParser')).toBe('htmlParser')
    expect(toPascal('xml http request')).toBe('XmlHttpRequest')
  })
})

describe('title and sentence case', () => {
  it('keeps small words lower in the middle of a title', () => {
    expect(toTitle('the lord OF the rings')).toBe('The Lord of the Rings')
    expect(toTitle('war and peace')).toBe('War and Peace')
    expect(toTitle('what to do in')).toBe('What to Do In')
  })
  it('keeps spacing and punctuation', () => {
    expect(toTitle('hello,  world!\nsecond line')).toBe('Hello,  World!\nSecond Line')
  })
  it('capitalises sentences', () => {
    expect(toSentence('HELLO there. how ARE you? fine!\nnew line')).toBe('Hello there. How are you? Fine!\nNew line')
  })
})

describe('slugify', () => {
  it('makes URL-friendly text', () => {
    expect(slugify('  Héllo, Wörld! — Tom & Jerry  ')).toBe('hello-world-tom-and-jerry')
    expect(slugify('Straße 42')).toBe('strasse-42')
    expect(slugify('a___b', '_')).toBe('a_b')
    expect(slugify('日本語 text')).toBe('日本語-text')
    expect(slugify('---')).toBe('')
  })
})

describe('conversions', () => {
  it('lists every form, skipping empty ones', () => {
    const ids = conversions('Hello World').map((r) => r.id)
    expect(ids).toEqual(['camel', 'pascal', 'snake', 'screaming', 'kebab', 'dot', 'path', 'title', 'sentence', 'upper', 'lower', 'slug'])
    expect(conversions('!!!').map((r) => r.id)).toEqual(['title', 'sentence', 'upper', 'lower'].filter((id) => conversions('!!!').some((r) => r.id === id)))
  })
  it('moves the requested form to the top', () => {
    const rows = conversions('Hello World', 'kebab')
    expect(rows[0]).toMatchObject({ id: 'kebab', value: 'hello-world' })
    expect(rows.length).toBe(12)
    expect(new Set(rows.map((r) => r.id)).size).toBe(12)
  })
})

describe('textStats', () => {
  const get = (text, id) => textStats(text).find((r) => r.id === id).value
  it('counts words, characters and lines', () => {
    const t = 'One two three.\nFour five!\n\nSix?'
    expect(get(t, 'words')).toBe('6')
    expect(get(t, 'lines')).toBe('4')
    expect(get(t, 'paragraphs')).toBe('2')
    expect(get(t, 'sentences')).toBe('3')
    expect(get('héllo 😀', 'chars')).toBe('7')
    expect(get('héllo 😀', 'bytes')).toBe('11')
    expect(get('a b', 'nospace')).toBe('2')
  })
  it('estimates reading time', () => {
    expect(get('short text', 'read')).toBe('under a minute')
    expect(get(Array(400).fill('word').join(' '), 'read')).toBe('2 min')
    expect(get('', 'words')).toBe('0')
  })
})
