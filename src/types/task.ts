export type TaskStatus = 'todo' | 'done'

export type Task = {
  id: string
  title: string
  order: number
  status: TaskStatus
  createdAt: string
  completedAt?: string
}
