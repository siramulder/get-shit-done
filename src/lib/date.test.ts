import { isToday } from './date'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute)

describe('isToday', () => {
  it('P1-17 is true for the current time', () => {
    vi.setSystemTime(local(5, 14, 30))
    expect(isToday(new Date().toISOString())).toBe(true)
  })

  it('P1-18 is false for yesterday', () => {
    vi.setSystemTime(local(5, 14, 30))
    expect(isToday(local(4, 14, 30).toISOString())).toBe(false)
  })

  it('P1-19 is false for tomorrow', () => {
    vi.setSystemTime(local(5, 14, 30))
    expect(isToday(local(6, 14, 30).toISOString())).toBe(false)
  })

  it('P1-20 is true at 23:59 for something done at 00:01 the same day', () => {
    vi.setSystemTime(local(5, 23, 59))
    expect(isToday(local(5, 0, 1).toISOString())).toBe(true)
  })

  it('P1-21 is false at 00:01 for something done at 23:59 the day before', () => {
    vi.setSystemTime(local(5, 0, 1))
    expect(isToday(local(4, 23, 59).toISOString())).toBe(false)
  })

  it('P1-22 uses Thai local time: 05:00 and 08:00 Bangkok are the same day though they straddle UTC midnight', () => {
    // 08:00 Bangkok on 5 Oct = 01:00 UTC on 5 Oct; 05:00 Bangkok on 5 Oct = 22:00 UTC on 4 Oct.
    vi.setSystemTime(new Date('2026-10-05T01:00:00.000Z'))
    expect(isToday('2026-10-04T22:00:00.000Z')).toBe(true)
  })

  it.each(['abc', ''])('P1-23 is false for a string that is not a date (%j)', (value) => {
    vi.setSystemTime(local(5, 14, 30))
    expect(isToday(value)).toBe(false)
  })
})
