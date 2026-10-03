import type { Task } from '../types/task'

export const STORAGE_KEY = 'task-priority-app:tasks'
export const BACKUP_KEY = 'task-priority-app:tasks:corrupt-backup'

const TASK_FIELDS = new Set(['id', 'title', 'order', 'status', 'createdAt', 'completedAt'])

function toTask(value: unknown): Task | null {
  if (typeof value !== 'object' || value === null) return null
  const { id, title, order, status, createdAt, completedAt } = value as Record<string, unknown>
  if (typeof id !== 'string' || typeof title !== 'string' || typeof createdAt !== 'string') return null
  if (typeof order !== 'number' || !Number.isFinite(order)) return null
  if (status !== 'todo' && status !== 'done') return null
  if (typeof completedAt === 'string') return { id, title, order, status, createdAt, completedAt }
  if (completedAt !== undefined || status === 'done') return null
  return { id, title, order, status, createdAt }
}

function hasUnknownFields(value: object): boolean {
  return Object.keys(value).some((key) => !TASK_FIELDS.has(key))
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

export function loadTasks(): Task[] {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return []
  }
  if (raw === null) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    writeBackup(raw)
    return []
  }
  if (!Array.isArray(parsed)) {
    writeBackup(raw)
    return []
  }

  const seenIds = new Set<string>()
  const tasks: Task[] = []
  let discarded = false
  for (const item of parsed as unknown[]) {
    const task = toTask(item)
    if (task === null || seenIds.has(task.id)) {
      discarded = true
      continue
    }
    if (hasUnknownFields(item as object)) discarded = true
    seenIds.add(task.id)
    tasks.push(task)
  }
  if (discarded) writeBackup(raw)
  return normalizeTodoOrder(tasks)
}

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch {
    // Storage full or blocked (e.g. private mode): keep working from in-memory state.
  }
}
