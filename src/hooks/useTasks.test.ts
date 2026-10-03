import { createElement, StrictMode, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { useTasks } from './useTasks'
import { STORAGE_KEY } from '../lib/storage'
import type { Task } from '../types/task'

type HookResult = { current: ReturnType<typeof useTasks> }

const titles = (tasks: Task[]) => tasks.map((t) => t.title)
const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute)

function setup(...initialTitles: string[]) {
  const hook = renderHook(() => useTasks())
  act(() => {
    for (const title of initialTitles) hook.result.current.addTask(title)
  })
  return hook
}

function idOf(result: HookResult, title: string): string {
  const task = [...result.current.todoTasks, ...result.current.doneTodayTasks].find(
    (t) => t.title === title,
  )
  if (!task) throw new Error(`no task titled "${title}"`)
  return task.id
}

function snapshot(result: HookResult) {
  return { todo: result.current.todoTasks, done: result.current.doneTodayTasks }
}

function stored(): Task[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Task[]
}

function seed(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

function freezeAt(date: Date) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(date)
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

describe('addTask', () => {
  it('P1-24 adds a todo task that has an id and createdAt', () => {
    const { result } = setup('A')
    expect(result.current.todoTasks).toHaveLength(1)
    const [task] = result.current.todoTasks
    expect(task.title).toBe('A')
    expect(task.status).toBe('todo')
    expect(task.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(Number.isNaN(Date.parse(task.createdAt))).toBe(false)
  })

  it('P1-25 keeps A, B, C in the order they were added', () => {
    const { result } = setup('A', 'B', 'C')
    expect(titles(result.current.todoTasks)).toEqual(['A', 'B', 'C'])
  })

  it('P1-26 trims leading and trailing whitespace', () => {
    const { result } = setup('  ซื้อนม  ')
    expect(titles(result.current.todoTasks)).toEqual(['ซื้อนม'])
  })

  it('P1-27 ignores an empty title', () => {
    const { result } = setup('')
    expect(result.current.todoTasks).toEqual([])
  })

  it('P1-28 ignores a whitespace-only title', () => {
    const { result } = setup('   ', '\t\n ')
    expect(result.current.todoTasks).toEqual([])
  })

  it('P1-29 gives 100 tasks 100 unique ids', () => {
    const { result } = setup(...Array.from({ length: 100 }, (_, i) => `งาน ${i + 1}`))
    expect(new Set(result.current.todoTasks.map((t) => t.id)).size).toBe(100)
  })

  it('P1-30 saves and reloads Thai and emoji titles exactly', () => {
    const names = ['ประชุมทีม 🚀', 'ซื้อของให้ครอบครัว 👨‍👩‍👧', 'ส่งงาน ✅']
    setup(...names).unmount()
    const { result } = renderHook(() => useTasks())
    expect(titles(result.current.todoTasks)).toEqual(names)
  })

  it('P1-31 adds exactly one task per call inside <StrictMode>', () => {
    const wrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children)
    const { result } = renderHook(() => useTasks(), { wrapper })
    act(() => result.current.addTask('A'))
    expect(result.current.todoTasks).toHaveLength(1)
    expect(stored()).toHaveLength(1)
  })
})

describe('completeTask', () => {
  it('P1-32 moves the task to doneTodayTasks with a completedAt', () => {
    freezeAt(local(5, 9))
    const { result } = setup('A')
    act(() => result.current.completeTask(idOf(result, 'A')))
    expect(result.current.todoTasks).toEqual([])
    expect(titles(result.current.doneTodayTasks)).toEqual(['A'])
    expect(result.current.doneTodayTasks[0].completedAt).toBe(local(5, 9).toISOString())
  })

  it('P1-33 completing B out of A, B, C leaves A, C', () => {
    const { result } = setup('A', 'B', 'C')
    act(() => result.current.completeTask(idOf(result, 'B')))
    expect(titles(result.current.todoTasks)).toEqual(['A', 'C'])
  })

  it('P1-34 completing twice keeps the first completedAt', () => {
    freezeAt(local(5, 9))
    const { result } = setup('A')
    act(() => result.current.completeTask(idOf(result, 'A')))
    vi.setSystemTime(local(5, 10))
    act(() => result.current.completeTask(idOf(result, 'A')))
    expect(result.current.doneTodayTasks[0].completedAt).toBe(local(5, 9).toISOString())
  })

  it('P1-35 completing an unknown id changes nothing and does not throw', () => {
    const { result } = setup('A', 'B')
    const before = snapshot(result)
    expect(() => act(() => result.current.completeTask('missing'))).not.toThrow()
    expect(snapshot(result)).toEqual(before)
  })
})

describe('uncompleteTask', () => {
  it('P1-36 returns the task to the end of todo and removes completedAt', () => {
    const { result } = setup('A', 'B', 'C')
    const id = idOf(result, 'A')
    act(() => result.current.completeTask(id))
    act(() => result.current.uncompleteTask(id))

    expect(titles(result.current.todoTasks)).toEqual(['B', 'C', 'A'])
    expect(result.current.doneTodayTasks).toEqual([])
    expect(result.current.todoTasks[2]).not.toHaveProperty('completedAt')
    expect(stored().find((t) => t.id === id)).not.toHaveProperty('completedAt')
  })

  it('P1-37 un-completing a task that is not done changes nothing', () => {
    const { result } = setup('A', 'B')
    const before = snapshot(result)
    act(() => result.current.uncompleteTask(idOf(result, 'A')))
    expect(snapshot(result)).toEqual(before)
  })
})

describe('deleteTask', () => {
  it('P1-38 deleting a todo task keeps the others in order', () => {
    const { result } = setup('A', 'B', 'C', 'D')
    act(() => result.current.deleteTask(idOf(result, 'B')))
    expect(titles(result.current.todoTasks)).toEqual(['A', 'C', 'D'])
  })

  it('P1-39 deleting a done task removes it from doneTodayTasks', () => {
    const { result } = setup('A')
    const id = idOf(result, 'A')
    act(() => result.current.completeTask(id))
    act(() => result.current.deleteTask(id))
    expect(result.current.doneTodayTasks).toEqual([])
  })

  it('P1-40 deleting the last task leaves todoTasks empty', () => {
    const { result } = setup('A')
    act(() => result.current.deleteTask(idOf(result, 'A')))
    expect(result.current.todoTasks).toEqual([])
  })

  it('P1-41 deleting an unknown id changes nothing', () => {
    const { result } = setup('A', 'B')
    const before = snapshot(result)
    act(() => result.current.deleteTask('missing'))
    expect(snapshot(result)).toEqual(before)
  })
})

describe('moveTask (↑ ↓)', () => {
  it('P1-42 moving B up in A, B, C gives B, A, C', () => {
    const { result } = setup('A', 'B', 'C')
    act(() => result.current.moveTask(idOf(result, 'B'), 'up'))
    expect(titles(result.current.todoTasks)).toEqual(['B', 'A', 'C'])
  })

  it('P1-43 moving B down in A, B, C gives A, C, B', () => {
    const { result } = setup('A', 'B', 'C')
    act(() => result.current.moveTask(idOf(result, 'B'), 'down'))
    expect(titles(result.current.todoTasks)).toEqual(['A', 'C', 'B'])
  })

  it('P1-44 moving the first task up changes nothing', () => {
    const { result } = setup('A', 'B', 'C')
    const before = snapshot(result)
    act(() => result.current.moveTask(idOf(result, 'A'), 'up'))
    expect(snapshot(result)).toEqual(before)
  })

  it('P1-45 moving the last task down changes nothing', () => {
    const { result } = setup('A', 'B', 'C')
    const before = snapshot(result)
    act(() => result.current.moveTask(idOf(result, 'C'), 'down'))
    expect(snapshot(result)).toEqual(before)
  })

  it('P1-46 moving the only task up or down changes nothing', () => {
    const { result } = setup('A')
    const before = snapshot(result)
    act(() => result.current.moveTask(idOf(result, 'A'), 'up'))
    act(() => result.current.moveTask(idOf(result, 'A'), 'down'))
    expect(snapshot(result)).toEqual(before)
  })

  it('P1-47 moving a done task changes nothing', () => {
    const { result } = setup('A', 'B', 'C')
    act(() => result.current.completeTask(idOf(result, 'B')))
    const before = snapshot(result)
    act(() => result.current.moveTask(idOf(result, 'B'), 'up'))
    act(() => result.current.moveTask(idOf(result, 'B'), 'down'))
    expect(snapshot(result)).toEqual(before)
  })

  it('P1-48 with A, (B done), C moving C up gives C, A', () => {
    const { result } = setup('A', 'B', 'C')
    act(() => result.current.completeTask(idOf(result, 'B')))
    act(() => result.current.moveTask(idOf(result, 'C'), 'up'))
    expect(titles(result.current.todoTasks)).toEqual(['C', 'A'])
  })
})

describe('reorderTasks (drag & drop)', () => {
  it('P1-49 dragging A onto C in A, B, C, D gives B, C, A, D', () => {
    const { result } = setup('A', 'B', 'C', 'D')
    act(() => result.current.reorderTasks(idOf(result, 'A'), idOf(result, 'C')))
    expect(titles(result.current.todoTasks)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('P1-50 dragging D onto B in A, B, C, D gives A, D, B, C', () => {
    const { result } = setup('A', 'B', 'C', 'D')
    act(() => result.current.reorderTasks(idOf(result, 'D'), idOf(result, 'B')))
    expect(titles(result.current.todoTasks)).toEqual(['A', 'D', 'B', 'C'])
  })

  it('P1-51 dropping a task on itself changes nothing', () => {
    const { result } = setup('A', 'B', 'C')
    const before = snapshot(result)
    act(() => result.current.reorderTasks(idOf(result, 'B'), idOf(result, 'B')))
    expect(snapshot(result)).toEqual(before)
  })

  it('P1-52 an unknown source or target id changes nothing', () => {
    const { result } = setup('A', 'B', 'C')
    const before = snapshot(result)
    act(() => result.current.reorderTasks('missing', idOf(result, 'B')))
    act(() => result.current.reorderTasks(idOf(result, 'A'), 'missing'))
    expect(snapshot(result)).toEqual(before)
  })

  it('P1-53 dragging a done task, or onto a done task, changes nothing', () => {
    const { result } = setup('A', 'B', 'C')
    act(() => result.current.completeTask(idOf(result, 'B')))
    const before = snapshot(result)
    act(() => result.current.reorderTasks(idOf(result, 'B'), idOf(result, 'A')))
    act(() => result.current.reorderTasks(idOf(result, 'C'), idOf(result, 'B')))
    expect(snapshot(result)).toEqual(before)
  })
})

describe('Today view rules', () => {
  it('P1-54 a task completed today is in doneTodayTasks', () => {
    freezeAt(local(5, 14))
    const { result } = setup('A')
    act(() => result.current.completeTask(idOf(result, 'A')))
    expect(titles(result.current.doneTodayTasks)).toEqual(['A'])
  })

  it('P1-55 a task completed yesterday is hidden from doneTodayTasks but stays in localStorage', () => {
    freezeAt(local(5, 9))
    seed([
      {
        id: 'y',
        title: 'เสร็จเมื่อวาน',
        order: 0,
        status: 'done',
        createdAt: local(4, 8).toISOString(),
        completedAt: local(4, 17).toISOString(),
      },
    ])
    const { result } = renderHook(() => useTasks())
    expect(result.current.doneTodayTasks).toEqual([])

    act(() => result.current.addTask('งานใหม่'))
    expect(stored().map((t) => t.id)).toContain('y')
  })

  it('P1-56 a task completed at 23:50 is gone from doneTodayTasks after remounting at 00:10', () => {
    freezeAt(local(5, 23, 50))
    const first = setup('A')
    act(() => first.result.current.completeTask(idOf(first.result, 'A')))
    expect(titles(first.result.current.doneTodayTasks)).toEqual(['A'])
    first.unmount()

    vi.setSystemTime(local(6, 0, 10))
    const { result } = renderHook(() => useTasks())
    expect(result.current.doneTodayTasks).toEqual([])
    expect(result.current.todoTasks).toEqual([])
  })

  it('P1-57 doneTodayTasks lists the most recently completed first', () => {
    freezeAt(local(5, 9))
    const { result } = setup('A', 'B', 'C')
    act(() => result.current.completeTask(idOf(result, 'A')))
    vi.setSystemTime(local(5, 10))
    act(() => result.current.completeTask(idOf(result, 'C')))
    vi.setSystemTime(local(5, 11))
    act(() => result.current.completeTask(idOf(result, 'B')))
    expect(titles(result.current.doneTodayTasks)).toEqual(['B', 'C', 'A'])
  })

  it('P1-60 an unfinished task created yesterday is still in todoTasks today', () => {
    freezeAt(local(5, 9))
    seed([
      { id: 'old', title: 'ค้างจากเมื่อวาน', order: 0, status: 'todo', createdAt: local(4, 18).toISOString() },
    ])
    const { result } = renderHook(() => useTasks())
    expect(titles(result.current.todoTasks)).toEqual(['ค้างจากเมื่อวาน'])
  })
})

describe('persistence', () => {
  it('P1-58 localStorage matches state after every command', () => {
    freezeAt(local(5, 9))
    const byId = (x: Task, y: Task) => x.id.localeCompare(y.id)
    const expectInSync = (result: HookResult) => {
      const state = [...result.current.todoTasks, ...result.current.doneTodayTasks].sort(byId)
      expect(stored().sort(byId)).toEqual(state)
    }

    const { result } = renderHook(() => useTasks())
    const commands: Array<() => void> = [
      () => result.current.addTask('A'),
      () => result.current.addTask('B'),
      () => result.current.addTask('C'),
      () => result.current.moveTask(idOf(result, 'C'), 'up'),
      () => result.current.reorderTasks(idOf(result, 'A'), idOf(result, 'B')),
      () => result.current.completeTask(idOf(result, 'B')),
      () => result.current.uncompleteTask(idOf(result, 'B')),
      () => result.current.completeTask(idOf(result, 'C')),
      () => result.current.deleteTask(idOf(result, 'A')),
    ]
    for (const command of commands) {
      act(command)
      expectInSync(result)
    }
  })

  it('P1-59 after unmount and a fresh render, order and status are the same', () => {
    // Compares sequence, not raw `order` numbers: load renumbers todo order to 0..n-1 by design.
    const sequence = (result: HookResult) => ({
      todo: result.current.todoTasks.map(({ id, title, status }) => ({ id, title, status })),
      done: result.current.doneTodayTasks.map(({ id, title, status, completedAt }) => ({ id, title, status, completedAt })),
    })
    const first = setup('A', 'B', 'C', 'D')
    act(() => first.result.current.moveTask(idOf(first.result, 'D'), 'up'))
    act(() => first.result.current.completeTask(idOf(first.result, 'A')))
    const before = sequence(first.result)
    expect(titles(first.result.current.todoTasks)).toEqual(['B', 'D', 'C'])
    first.unmount()

    const { result } = renderHook(() => useTasks())
    expect(sequence(result)).toEqual(before)
  })

  it('P1-61 after many deletes and completions a new task still goes to the end', () => {
    const { result } = setup('A', 'B', 'C', 'D', 'E')
    act(() => result.current.deleteTask(idOf(result, 'E')))
    act(() => result.current.completeTask(idOf(result, 'D')))
    act(() => result.current.deleteTask(idOf(result, 'A')))
    act(() => result.current.moveTask(idOf(result, 'C'), 'up'))
    act(() => result.current.addTask('F'))
    expect(titles(result.current.todoTasks)).toEqual(['C', 'B', 'F'])

    act(() => result.current.uncompleteTask(idOf(result, 'D')))
    act(() => result.current.addTask('G'))
    expect(titles(result.current.todoTasks)).toEqual(['C', 'B', 'F', 'D', 'G'])
  })

  it('does not write to localStorage on mount; cleaned data is saved on the first change', () => {
    const raw = JSON.stringify([
      { id: 'a', title: 'A', order: 0, status: 'todo', createdAt: '2026-10-05T01:00:00.000Z' },
      { id: 'bad' },
    ])
    localStorage.setItem(STORAGE_KEY, raw)
    const { result } = renderHook(() => useTasks())
    expect(titles(result.current.todoTasks)).toEqual(['A'])
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)

    act(() => result.current.addTask('B'))
    expect(stored().map((t) => t.id)).not.toContain('bad')
  })
})
