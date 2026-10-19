import type { Store, Task } from '../types/task'

export const STORAGE_KEY = 'task-priority-app:tasks'
export const BACKUP_KEY = 'task-priority-app:tasks:corrupt-backup'
export const SCHEMA_VERSION = 2

export type LoadResult =
  | { status: 'ok'; tasks: Task[] }
  // localStorage was written by a newer app version: it is never read, backed up, or overwritten.
  | { status: 'newer-version'; schemaVersion: number }

const TASK_FIELDS = new Set(['id', 'title', 'order', 'status', 'createdAt', 'completedAt', 'dueDate'])
const STORE_FIELDS = new Set(['schemaVersion', 'tasks'])
const DUE_DATE = /^\d{4}-\d{2}-\d{2}$/

// "YYYY-MM-DD" naming a real calendar day. UTC getters keep this independent of timezone and DST;
// setUTCFullYear (rather than Date.UTC) so years 0000–0099 are not read as 1900–1999.
function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DUE_DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasUnknownFields(value: object, known: Set<string>): boolean {
  return Object.keys(value).some((key) => !known.has(key))
}

function toTask(value: unknown): Task | null {
  if (!isRecord(value)) return null
  const { id, title, order, status, createdAt, completedAt, dueDate } = value
  if (typeof id !== 'string' || typeof title !== 'string' || typeof createdAt !== 'string') return null
  if (typeof order !== 'number' || !Number.isFinite(order)) return null
  if (status !== 'todo' && status !== 'done') return null
  if (typeof completedAt !== 'string' && (completedAt !== undefined || status === 'done')) return null
  const task: Task = { id, title, order, status, createdAt }
  if (typeof completedAt === 'string') task.completedAt = completedAt
  // A malformed dueDate drops only this field; dropsData() makes it count as discarded data.
  if (isCalendarDate(dueDate)) task.dueDate = dueDate
  return task
}

// True when the loader could not carry the whole item over: an unknown key or a malformed dueDate.
function dropsData(item: Record<string, unknown>): boolean {
  return hasUnknownFields(item, TASK_FIELDS) || ('dueDate' in item && !isCalendarDate(item.dueDate))
}

function normalizeTodoOrder(tasks: Task[]): Task[] {
  const todo = tasks
    .filter((t) => t.status === 'todo')
    .sort((x, y) => x.order - y.order || (x.createdAt < y.createdAt ? -1 : x.createdAt > y.createdAt ? 1 : 0))
  const orderById = new Map(todo.map((t, index) => [t.id, index]))
  return tasks.map((t) => {
    const order = orderById.get(t.id)
    return order === undefined ? t : { ...t, order }
  })
}

function writeBackup(raw: string): void {
  try {
    localStorage.setItem(BACKUP_KEY, raw)
  } catch {
    // Best effort: a failed backup must not stop the app from loading.
  }
}

const empty = (): LoadResult => ({ status: 'ok', tasks: [] })

export function loadStore(): LoadResult {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return empty()
  }
  if (raw === null) return empty()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    writeBackup(raw)
    return empty()
  }

  let items: unknown[]
  let discarded = false
  if (Array.isArray(parsed)) {
    // MVP1 stored a bare Task[]: migrate it in memory. The array itself is sound; only its items are validated.
    items = parsed
  } else if (isRecord(parsed) && typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > SCHEMA_VERSION) {
    return { status: 'newer-version', schemaVersion: parsed.schemaVersion }
  } else if (isRecord(parsed) && parsed.schemaVersion === SCHEMA_VERSION && Array.isArray(parsed.tasks)) {
    items = parsed.tasks
    if (hasUnknownFields(parsed, STORE_FIELDS)) discarded = true
  } else {
    writeBackup(raw)
    return empty()
  }

  const seenIds = new Set<string>()
  const tasks: Task[] = []
  for (const item of items) {
    const task = toTask(item)
    if (task === null || seenIds.has(task.id)) {
      discarded = true
      continue
    }
    if (dropsData(item as Record<string, unknown>)) discarded = true
    seenIds.add(task.id)
    tasks.push(task)
  }
  if (discarded) writeBackup(raw)
  return { status: 'ok', tasks: normalizeTodoOrder(tasks) }
}

// Convenience for tests. The app itself must call loadStore(), otherwise a newer-version store
// would be indistinguishable from an empty list.
export function loadTasks(): Task[] {
  const result = loadStore()
  return result.status === 'ok' ? result.tasks : []
}

export function saveTasks(tasks: Task[]): void {
  const store: Store = { schemaVersion: SCHEMA_VERSION, tasks }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Storage full or blocked (e.g. private mode): keep working from in-memory state.
  }
}
