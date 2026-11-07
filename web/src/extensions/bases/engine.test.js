import { describe, it, expect } from 'vitest'
import { parseBasesCommand, parseInteger, twosComplement, baseRows, setBits, parseSize, sizeRows, evalBits, fromBitPositions } from './engine.js'

describe('parseBasesCommand', () => {
  it('recognises command words and bare prefixed literals', () => {
    expect(parseBasesCommand('hex ff')).toEqual({ word: 'hex', text: 'ff' })
    expect(parseBasesCommand('  BIN 1010 ')).toEqual({ word: 'bin', text: '1010' })
    expect(parseBasesCommand('base 36 zz')).toEqual({ word: 'base', text: '36 zz' })
    expect(parseBasesCommand('bytes 1.5 GiB')).toEqual({ word: 'bytes', text: '1.5 GiB' })
    expect(parseBasesCommand('0xFF')).toEqual({ word: 'literal', text: '0xFF' })
    expect(parseBasesCommand('-0b1010')).toEqual({ word: 'literal', text: '-0b1010' })
  })
  it('ignores ordinary searches and numbers', () => {
    for (const q of ['', 'hexagon', 'a hex b', 'binary clock', 'bits-and-bobs', '255', '0x', '0xZZ', '1+1', 'basement']) expect(parseBasesCommand(q), q).toBeNull()
  })
})

describe('parseInteger', () => {
  it('reads each base, with prefixes and underscores', () => {
    expect(parseInteger('ff', 16)).toBe(255n)
    expect(parseInteger('0xff')).toBe(255n)
    expect(parseInteger('0b1010_1010')).toBe(170n)
    expect(parseInteger('0o777')).toBe(511n)
    expect(parseInteger('zz', 36)).toBe(1295n)
    expect(parseInteger('-12')).toBe(-12n)
    expect(parseInteger('123456789012345678901234567890')).toBe(123456789012345678901234567890n)
  })
  it('rejects digits outside the base', () => {
    expect(parseInteger('9', 8)).toBeNull()
    expect(parseInteger('2', 2)).toBeNull()
    expect(parseInteger('g', 16)).toBeNull()
    expect(parseInteger('')).toBeNull()
    expect(parseInteger('0x')).toBeNull()
  })
})

describe('baseRows', () => {
  const value = (rows, id) => rows.find((r) => r.id === id)?.value
  it('shows every base for a positive number', () => {
    const r = baseRows(255n)
    expect(value(r, 'dec')).toBe('255')
    expect(value(r, 'hex')).toBe('0xFF')
    expect(value(r, 'bin')).toBe('0b11111111')
    expect(r.find((x) => x.id === 'bin').alt).toBe('1111 1111')
    expect(value(r, 'oct')).toBe('0o377')
    expect(value(r, 'b36')).toBe('73')
    expect(value(r, 'size')).toBe('1 byte · 8 bits')
  })
  it('groups thousands and large values', () => {
    expect(baseRows(1234567n).find((x) => x.id === 'dec').alt).toBe('1,234,567')
    expect(value(baseRows(2n ** 64n), 'hex')).toBe('0x10000000000000000')
  })
  it("adds two's complement for negatives", () => {
    const r = baseRows(-1n)
    expect(value(r, 'tc8')).toBe('0xFF')
    expect(value(r, 'tc32')).toBe('0xFFFFFFFF')
    expect(value(r, 'tc64')).toBe('0xFFFFFFFFFFFFFFFF')
    expect(value(baseRows(-129n), 'tc8')).toBeUndefined()
    expect(value(baseRows(-129n), 'tc16')).toBe('0xFF7F')
  })
})

describe('twosComplement', () => {
  it('lists the widths a value fits in', () => {
    expect(twosComplement(-128n).map((t) => t.bits)).toEqual([8, 16, 32, 64])
    expect(twosComplement(300n).map((t) => t.bits)).toEqual([16, 32, 64])
    expect(twosComplement(2n ** 70n)).toEqual([])
  })
})

describe('setBits', () => {
  it('lists bit positions from the lowest', () => {
    expect(setBits(37n)).toEqual([0, 2, 5])
    expect(setBits(0n)).toEqual([])
    expect(setBits(1n << 70n)).toEqual([70])
  })
})

describe('sizes', () => {
  it('parses numbers with units', () => {
    expect(parseSize('1536000')).toBe(1536000)
    expect(parseSize('1.5 GiB')).toBe(1610612736)
    expect(parseSize('10mb')).toBe(10000000)
    expect(parseSize('2K')).toBe(2048)
    expect(parseSize('1,5 KB')).toBe(1500)
  })
  it('rejects nonsense', () => {
    for (const s of ['', 'abc', '1 parsec', '-5', '1e30 TB', '1.5.5']) expect(parseSize(s), s).toBeNull()
  })
  it('shows SI and IEC side by side', () => {
    const r = sizeRows(1610612736)
    const v = (id) => r.find((x) => x.id === id)?.value
    expect(v('bytes')).toBe('1,610,612,736')
    expect(v('iec')).toBe('1.5 GiB')
    expect(v('si')).toBe('1.61 GB')
    expect(v('GiB')).toBe('1.5 GiB')
    expect(v('bits')).toBe('12,884,901,888')
    expect(v('PB')).toBeUndefined()
  })
})

describe('evalBits', () => {
  const ok = (s) => {
    const r = evalBits(s)
    expect(r.ok, s).toBe(true)
    return r.value
  }
  it('evaluates with C-like precedence', () => {
    expect(ok('1 << 3')).toBe(8n)
    expect(ok('(1<<3)|(1<<5)')).toBe(40n)
    expect(ok('0xF0 & 0x3C')).toBe(0x30n)
    expect(ok('0b1100 ^ 0b1010')).toBe(0b0110n)
    expect(ok('1 | 2 & 3')).toBe(3n)
    expect(ok('2 + 3 * 4')).toBe(14n)
    expect(ok('~0')).toBe(-1n)
    expect(ok('-(5)')).toBe(-5n)
    expect(ok('1 << 100')).toBe(2n ** 100n)
    expect(ok('10 % 4 + 7 / 2')).toBe(5n)
  })
  it('explains what is wrong', () => {
    expect(evalBits('1 +').ok).toBe(false)
    expect(evalBits('(1').error).toBe('Missing )')
    expect(evalBits('1 / 0').error).toBe('Division by zero')
    expect(evalBits('1 << 99999').error).toBe('Shift is too large')
    expect(evalBits('abc').error).toBe('Unexpected "a"')
    expect(evalBits('').ok).toBe(false)
    expect(evalBits('1 2').ok).toBe(false)
  })
})

describe('fromBitPositions', () => {
  it('builds a value from positions', () => {
    expect(fromBitPositions('set 0 2 5')).toBe(37n)
    expect(fromBitPositions('SET 0,2,5')).toBe(37n)
    expect(fromBitPositions('set 31')).toBe(2147483648n)
  })
  it('rejects anything else', () => {
    expect(fromBitPositions('set')).toBeNull()
    expect(fromBitPositions('set 1.5')).toBeNull()
    expect(fromBitPositions('set 99999')).toBeNull()
    expect(fromBitPositions('37')).toBeNull()
  })
})
