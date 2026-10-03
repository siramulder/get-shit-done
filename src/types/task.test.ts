import { expectTypeOf } from 'vitest'
import type { Task, TaskStatus } from './task'

describe('Task type', () => {
  it('P1-01 has exactly id, title, order, status, createdAt and optional completedAt', () => {
    expectTypeOf<Task>().toEqualTypeOf<{
      id: string
      title: string
      order: number
      status: 'todo' | 'done'
      createdAt: string
      completedAt?: string
    }>()
  })

  it('P1-02 rejects any status other than "todo" | "done" at type-check time', () => {
    expectTypeOf<TaskStatus>().toEqualTypeOf<'todo' | 'done'>()
    const base = { id: 'a', title: 'A', order: 0, createdAt: '2026-10-05T02:00:00.000Z' }
    // @ts-expect-error -- "archived" is not a TaskStatus
    const invalid: Task = { ...base, status: 'archived' }
    expect(invalid.status).toBe('archived')
  })
})
