import { describe as suite, it, expect } from 'vitest'
import { parseCron, describe, nextRuns, parseCronCommand, fieldMeaning } from './engine.js'

const d = (expr, dialect) => {
  const p = parseCron(expr, dialect)
  if (!p.ok) throw new Error(p.errors.map((e) => e.message).join('; '))
  return describe(p)
}
// 2026-11-06 is a Friday
const FROM = Date.UTC(2026, 10, 6, 12, 0, 0)
const runs = (expr, n = 5, dialect) => nextRuns(parseCron(expr, dialect), FROM, n, { utc: true }).map((t) => new Date(t).toISOString().slice(0, 19) + 'Z')

suite('descriptions', () => {
  it('describes common schedules', () => {
    expect(d('* * * * *')).toBe('Every minute, every day')
    expect(d('*/5 * * * *')).toBe('Every 5 minutes, every day')
    expect(d('0 9 * * *')).toBe('At 09:00, every day')
    expect(d('30 9 * * 1-5')).toBe('At 09:30, on Monday through Friday')
    expect(d('0 0 1 * *')).toBe('At 00:00, on the 1st of the month')
    expect(d('0 0 1 1 *')).toBe('At 00:00, on the 1st of the month, in January')
    expect(d('0 9,17 * * *')).toBe('At 09:00 and 17:00, every day')
    expect(d('15 * * * *')).toBe('At minute 15 past every hour, every day')
    expect(d('0 * * * *')).toBe('At the start of every hour, every day')
    expect(d('*/15 9-17 * * 1-5')).toBe('Every 15 minutes, between 09:00 and 17:59, on Monday through Friday')
    expect(d('0 9-17 * * *')).toBe('Every hour, from 09:00 through 17:00, every day')
    expect(d('0 0 * * 0')).toBe('At 00:00, on Sunday')
    expect(d('0 */2 * * *')).toBe('Minute 0, every 2 hours, every day')
  })
  it('handles names, lists of days and months', () => {
    expect(d('0 8 * JAN-MAR MON,WED,FRI')).toBe('At 08:00, on Monday, Wednesday and Friday, in January through March')
    expect(d('0 12 15 6,12 *')).toBe('At 12:00, on the 15th of the month, in June and December')
    expect(d('0 0 1,15 * *')).toBe('At 00:00, on the 1st and 15th of the month')
  })
  it('handles both day fields (either matches)', () => {
    expect(d('0 0 13 * 5')).toBe('At 00:00, on the 13th of the month and on Friday')
  })
  it('handles macros and @reboot', () => {
    expect(d('@daily')).toBe('At 00:00, every day')
    expect(d('@weekly')).toBe('At 00:00, on Sunday')
    expect(d('@hourly')).toBe('At the start of every hour, every day')
    expect(d('@reboot')).toMatch(/startup/)
  })
  it('handles seconds, years and Quartz specials', () => {
    expect(d('*/10 * * * * *')).toBe('Every 10 seconds, every day')
    expect(d('0 0 12 * * *')).toBe('At 12:00, every day')
    expect(d('30 0 12 * * *')).toBe('At 12:00:30, every day')
    expect(d('0 0 12 ? * MON-FRI')).toBe('At 12:00, on Monday through Friday')
    expect(d('0 0 12 L * ?')).toBe('At 12:00, on the last day of the month')
    expect(d('0 0 12 15W * ?')).toBe('At 12:00, on the weekday nearest the 15th of the month')
    expect(d('0 0 12 ? * 6#3', 'quartz6')).toBe('At 12:00, on the 3rd Friday of the month')
    expect(d('0 0 12 ? * 5L', 'quartz6')).toBe('At 12:00, on the last Thursday of the month')
    expect(d('0 0 12 ? * 6#3')).toBe('At 12:00, on the 3rd Saturday of the month') // Spring numbering: 6 = Saturday
    expect(d('0 0 12 ? * 2-6', 'quartz6')).toBe('At 12:00, on Monday through Friday')
    expect(d('0 0 12 1 1 ? 2030')).toBe('At 12:00, on the 1st of the month, in January, in 2030')
    expect(d('0 12 1 1 ? 2030', 'aws')).toBe('At 12:00, on the 1st of the month, in January, in 2030')
  })
})

suite('validation', () => {
  it('reports precise errors', () => {
    expect(parseCron('61 * * * *').errors[0]).toMatchObject({ field: 'minute' })
    expect(parseCron('* 24 * * *').errors[0].message).toMatch(/out of range/)
    expect(parseCron('* * 0 * *').ok).toBe(false)
    expect(parseCron('* * * 13 *').ok).toBe(false)
    expect(parseCron('* * * * FUNDAY').errors[0].field).toBe('dow')
    expect(parseCron('5-1 * * * *').errors[0].message).toMatch(/backwards/)
    expect(parseCron('*/0 * * * *').ok).toBe(false)
    expect(parseCron('* * * *').errors[0].message).toMatch(/4 fields/)
    expect(parseCron('* * * * 8').errors[0].message).toMatch(/out of range/)
    expect(parseCron('0 0 12 ? * 0', 'quartz6').errors[0].message).toMatch(/1–7/)
  })
  it('flags every bad field at once', () => {
    expect(parseCron('99 99 * * *').errors.map((e) => e.field)).toEqual(['minute', 'hour'])
  })
})

suite('next runs', () => {
  it('lists upcoming times strictly after now', () => {
    expect(runs('*/15 * * * *', 3)).toEqual(['2026-11-06T12:15:00Z', '2026-11-06T12:30:00Z', '2026-11-06T12:45:00Z'])
    expect(runs('0 12 * * *', 2)).toEqual(['2026-11-07T12:00:00Z', '2026-11-08T12:00:00Z'])
  })
  it('respects weekdays, month days and the OR rule', () => {
    expect(runs('0 9 * * 1-5', 3)).toEqual(['2026-11-09T09:00:00Z', '2026-11-10T09:00:00Z', '2026-11-11T09:00:00Z'])
    expect(runs('0 0 1,15 * *', 3)).toEqual(['2026-11-15T00:00:00Z', '2026-12-01T00:00:00Z', '2026-12-15T00:00:00Z'])
    expect(runs('0 0 13 * 1', 3)).toEqual(['2026-11-09T00:00:00Z', '2026-11-13T00:00:00Z', '2026-11-16T00:00:00Z']) // 13th OR Monday
  })
  it('handles Quartz specials', () => {
    expect(runs('0 0 12 L * ?', 3)).toEqual(['2026-11-30T12:00:00Z', '2026-12-31T12:00:00Z', '2027-01-31T12:00:00Z'])
    expect(runs('0 0 12 15W * ?', 2)).toEqual(['2026-11-16T12:00:00Z', '2026-12-15T12:00:00Z']) // 15 Nov 2026 is a Sunday → Monday 16th
    expect(runs('0 0 12 ? * 6#3', 2, 'quartz6')).toEqual(['2026-11-20T12:00:00Z', '2026-12-18T12:00:00Z'])
    expect(runs('0 0 12 ? * 6L', 2, 'quartz6')).toEqual(['2026-11-27T12:00:00Z', '2026-12-25T12:00:00Z'])
    expect(runs('0 0 12 LW * ?', 1)).toEqual(['2026-11-30T12:00:00Z'])
  })
  it('handles seconds and leap days', () => {
    expect(runs('*/20 * * * * *', 3)).toEqual(['2026-11-06T12:00:20Z', '2026-11-06T12:00:40Z', '2026-11-06T12:01:00Z'])
    expect(runs('0 0 29 2 *', 2)).toEqual(['2028-02-29T00:00:00Z', '2032-02-29T00:00:00Z'])
  })
  it('stops when the schedule has ended or never matches', () => {
    expect(runs('0 0 1 1 * 2020', 3, 'aws')).toEqual([])
    expect(runs('0 0 31 2 *', 3)).toEqual([])
    expect(nextRuns(parseCron('@reboot'), FROM, 3)).toEqual([])
  })
  it('supports local time', () => {
    const t = nextRuns(parseCron('30 9 * * *'), FROM, 1)[0]
    const dt = new Date(t)
    expect([dt.getHours(), dt.getMinutes()]).toEqual([9, 30])
  })
})

suite('command parsing', () => {
  it('recognises explicit, macro and obviously-cron input', () => {
    expect(parseCronCommand('cron */5 * * * *')).toEqual({ expr: '*/5 * * * *' })
    expect(parseCronCommand('crontab  0 9 * * 1-5')).toEqual({ expr: '0 9 * * 1-5' })
    expect(parseCronCommand('cron')).toEqual({ expr: '' })
    expect(parseCronCommand('@daily')).toEqual({ expr: '@daily' })
    expect(parseCronCommand('0 9 * * 1-5')).toEqual({ expr: '0 9 * * 1-5' })
    expect(parseCronCommand('0 0 12 ? * MON-FRI')).toEqual({ expr: '0 0 12 ? * MON-FRI' })
  })
  it('leaves ordinary searches alone', () => {
    expect(parseCronCommand('1 2 3 4 5')).toBeNull()
    expect(parseCronCommand('feed me * * * *')).toBeNull()
    expect(parseCronCommand('github')).toBeNull()
    expect(parseCronCommand('mon tue wed thu fri')).toBeNull()
    expect(parseCronCommand('cronic')).toBeNull()
  })
})

suite('field meanings', () => {
  it('summarises each field', () => {
    const p = parseCron('*/15 9-17 * * 1-5')
    expect(fieldMeaning(p, 'minute')).toBe('every 15 minutes')
    expect(fieldMeaning(p, 'hour')).toBe('between 09:00 and 17:59')
    expect(fieldMeaning(p, 'dom')).toBe('every day of the month')
    expect(fieldMeaning(p, 'dow')).toBe('Monday through Friday')
  })
})
