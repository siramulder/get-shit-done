import { dueBadge } from './deadline'
import { labels } from './labels'

// "Now" is always passed in, so nothing here depends on the real clock. Tests run with TZ=Asia/Bangkok.
const at = (day: number, hour = 9, minute = 0) => new Date(2026, 9, day, hour, minute) // October 2026, local time

describe('dueBadge', () => {
  it('AC-12.1 on 2026-10-17 a task due 2026-10-15 is overdue: "เลยกำหนด 2 วัน"', () => {
    expect(dueBadge('2026-10-15', at(17))).toStrictEqual({ kind: 'overdue', text: 'เลยกำหนด 2 วัน' })
    expect(dueBadge('2026-10-16', at(17))).toStrictEqual({ kind: 'overdue', text: labels.due.overdue(1) })
    // across a month and a year boundary the count is still calendar days
    expect(dueBadge('2026-09-30', at(17))).toStrictEqual({ kind: 'overdue', text: labels.due.overdue(17) })
    expect(dueBadge('2025-10-17', at(17))).toStrictEqual({ kind: 'overdue', text: labels.due.overdue(365) })
  })

  it('AC-12.2 a task due today reads "วันนี้" and one due the next day reads "พรุ่งนี้"', () => {
    expect(dueBadge('2026-10-17', at(17))).toStrictEqual({ kind: 'today', text: 'วันนี้' })
    expect(dueBadge('2026-10-18', at(17))).toStrictEqual({ kind: 'tomorrow', text: 'พรุ่งนี้' })
    // the last day of a month: tomorrow is the 1st
    expect(dueBadge('2026-11-01', at(31))).toStrictEqual({ kind: 'tomorrow', text: labels.due.tomorrow })
  })

  it('AC-12.3 a later date this year reads "24 ต.ค."; a date in another year carries the Buddhist year', () => {
    expect(dueBadge('2026-10-24', at(17))).toStrictEqual({ kind: 'later', text: '24 ต.ค.' })
    expect(dueBadge('2026-10-19', at(17))).toStrictEqual({ kind: 'later', text: '19 ต.ค.' }) // two days ahead is already "later"
    expect(dueBadge('2026-12-31', at(17))).toStrictEqual({ kind: 'later', text: '31 ธ.ค.' })
    expect(dueBadge('2027-01-05', at(17))).toStrictEqual({ kind: 'later', text: '5 ม.ค. 2570' })
  })

  it('S3-01 around midnight the label follows the local calendar day, not elapsed hours', () => {
    expect(dueBadge('2026-10-18', at(17, 23, 59))).toStrictEqual({ kind: 'tomorrow', text: labels.due.tomorrow })
    expect(dueBadge('2026-10-18', at(18, 0, 1))).toStrictEqual({ kind: 'today', text: labels.due.today })
    expect(dueBadge('2026-10-17', at(17, 0, 0))).toStrictEqual({ kind: 'today', text: labels.due.today })
    expect(dueBadge('2026-10-17', at(17, 23, 59))).toStrictEqual({ kind: 'today', text: labels.due.today })
    expect(dueBadge('2026-10-17', at(18, 0, 1))).toStrictEqual({ kind: 'overdue', text: labels.due.overdue(1) })
  })

  it('S3-02 a task without a due date has no badge', () => {
    expect(dueBadge(undefined, at(17))).toBeNull()
  })

  it('S3-14 in a timezone behind UTC the due date is still read as a local calendar day (never parsed as UTC)', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles') // Node re-reads TZ when it is assigned
    try {
      const morning = new Date(2026, 9, 18, 10, 0)
      // Proves the switch took effect in this worker: Los Angeles is behind UTC, Bangkok is ahead.
      expect(morning.getTimezoneOffset()).toBeGreaterThan(0)
      expect(dueBadge('2026-10-18', morning)).toStrictEqual({ kind: 'today', text: labels.due.today })
      expect(dueBadge('2026-10-17', morning)).toStrictEqual({ kind: 'overdue', text: labels.due.overdue(1) })
      expect(dueBadge('2026-10-19', morning)).toStrictEqual({ kind: 'tomorrow', text: labels.due.tomorrow })
      expect(dueBadge('2026-10-24', morning)).toStrictEqual({ kind: 'later', text: '24 ต.ค.' })
      const lateEvening = new Date(2026, 9, 18, 23, 30)
      expect(dueBadge('2026-10-18', lateEvening)).toStrictEqual({ kind: 'today', text: labels.due.today })
    } finally {
      vi.unstubAllEnvs()
    }
    expect(new Date(2026, 9, 18, 10, 0).getTimezoneOffset()).toBe(-420) // back on Bangkok time for the next test
  })
})
