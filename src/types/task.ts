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

export type Store = {
  schemaVersion: 2
  tasks: Task[]
}
