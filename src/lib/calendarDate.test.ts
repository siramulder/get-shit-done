import { describe, expect, it } from 'vitest'
import { isCalendarDate } from './calendarDate'

// The rule itself is pinned through its callers: S0-02 (storage.test.ts, 4 real + 11 malformed values),
// S3-03 (useTasks.test.ts) and S3-02 (deadline.test.ts). Only the branch none of them reaches is tested here.
describe('isCalendarDate', () => {
  it('S0-02 a year below 100 is that year, not 19xx: real days are accepted, days that do not exist are not', () => {
    expect(isCalendarDate('0099-12-31')).toBe(true)
    expect(isCalendarDate('0004-02-29')).toBe(true)
    expect(isCalendarDate('0001-02-29')).toBe(false)
    expect(isCalendarDate('0099-02-30')).toBe(false)
  })
})
