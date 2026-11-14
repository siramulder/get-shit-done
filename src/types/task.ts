export type TaskStatus = 'todo' | 'done'

export type Task = {
  id: string
  title: string
  order: number
  status: TaskStatus
  createdAt: string
  completedAt?: string
  dueDate?: string // "YYYY-MM-DD" local calendar date, no time, no timezone
}

// What a due date reads as on a given day. Computed in App (lib/deadline) and passed down as plain data.
export type DueBadge = {
  kind: 'overdue' | 'today' | 'tomorrow' | 'later'
  text: string
}

export type Store = {
  schemaVersion: 2
  tasks: Task[]
}
