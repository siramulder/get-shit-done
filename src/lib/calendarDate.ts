// The one rule for what counts as a due date. Pure: this file imports nothing.
// Storage (loading), useTasks (setDueDate) and deadline (dueBadge) all use it, so they can never disagree.
const DUE_DATE = /^\d{4}-\d{2}-\d{2}$/

// "YYYY-MM-DD" naming a real calendar day. UTC getters keep this independent of timezone and DST;
// setUTCFullYear (rather than Date.UTC) so years 0000–0099 are not read as 1900–1999.
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DUE_DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
