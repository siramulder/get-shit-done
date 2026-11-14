import { labels } from './labels'
import type { DueBadge } from '../types/task'

const DAY_MS = 86_400_000
// Formatted in UTC from a UTC date built from the same numbers, so the text never depends on the machine's timezone.
const shortDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const shortDateWithYear = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

// What a due date ("YYYY-MM-DD", a local calendar day) reads as on the day of `now`.
// Days are compared as calendar days built from year / month / day numbers — the string is never handed to
// `new Date(...)`, which would read it as UTC midnight and shift the day in timezones behind UTC.
export function dueBadge(dueDate: string | undefined, now: Date): DueBadge | null {
  if (dueDate === undefined) return null
  const [year, month, day] = dueDate.split('-').map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null

  const dueDay = Date.UTC(year, month - 1, day) / DAY_MS
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS
  const daysLeft = dueDay - today

  if (daysLeft < 0) return { kind: 'overdue', text: labels.due.overdue(-daysLeft) }
  if (daysLeft === 0) return { kind: 'today', text: labels.due.today }
  if (daysLeft === 1) return { kind: 'tomorrow', text: labels.due.tomorrow }
  const format = year === now.getFullYear() ? shortDate : shortDateWithYear
  return { kind: 'later', text: format.format(new Date(Date.UTC(year, month - 1, day))) }
}
