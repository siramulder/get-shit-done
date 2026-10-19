import { createElement, StrictMode, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { useTasks } from './useTasks'
import { BACKUP_KEY, STORAGE_KEY } from '../lib/storage'
import type { Store, Task } from '../types/task'

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

// saveTasks writes a v2 Store. seed() still writes a bare MVP1 array on purpose, so every test that seeds
// and then mutates also exercises the migration path.
function stored(): Task[] {
  return (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"schemaVersion":2,"tasks":[]}') as Store).tasks
}

function seed(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

function freezeAt(date: Date) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(date)
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

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
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useTasks())
    expect(titles(result.current.todoTasks)).toEqual(['A'])
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
    expect(setItem).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything()) // only the corrupt backup may be written on load

    act(() => result.current.addTask('B'))
    expect(stored().map((t) => t.id)).not.toContain('bad')
  })
})

describe('v2 store and migration', () => {
  // An MVP1 array as a real user would have it: a task completed in the middle leaves a gap in todo order.
  const mvp1 = (): Task[] => [
    { id: 'a', title: 'A', order: 0, status: 'todo', createdAt: local(5, 1).toISOString() },
    { id: 'b', title: 'B', order: 2, status: 'todo', createdAt: local(5, 2).toISOString() },
    { id: 'c', title: 'C', order: 3, status: 'todo', createdAt: local(5, 3).toISOString() },
    { id: 'd', title: 'D', order: 1, status: 'done', createdAt: local(5, 0, 30).toISOString(), completedAt: local(5, 8).toISOString() },
  ]
  const schemaVersionStored = () =>
    (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Store | null)?.schemaVersion
  // Task C carries a dueDate that no mutation targets, so every write must carry it over untouched.
  const withDue = (tasks: Task[]): Task[] => tasks.map((t) => (t.id === 'c' ? { ...t, dueDate: '2026-10-17' } : t))

  it('AC-16.2 keeps the MVP1 array untouched until the first action, then writes a v2 store with every task', () => {
    freezeAt(local(5, 9))
    const raw = JSON.stringify(mvp1())
    localStorage.setItem(STORAGE_KEY, raw)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useTasks())
    expect(result.current.newerVersion).toBe(false)
    expect(titles(result.current.todoTasks)).toEqual(['A', 'B', 'C'])
    expect(titles(result.current.doneTodayTasks)).toEqual(['D'])
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
    expect(setItem).not.toHaveBeenCalled() // nothing at all is written on open, not even identical bytes

    act(() => result.current.addTask('E'))
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String))
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Store
    expect(parsed.schemaVersion).toBe(2)
    expect(parsed.tasks.map((t) => t.id).sort()).toEqual(['a', 'b', 'c', 'd', idOf(result, 'E')].sort())
    expect(parsed.tasks.find((t) => t.id === 'd')).toStrictEqual(mvp1()[3])
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
  })

  it('AC-16.4 data from a newer version: empty list, newerVersion flag, and no action touches localStorage', () => {
    // Pretty-printed with a trailing newline so that any re-serialisation would differ byte for byte.
    const raw =
      '{\n  "schemaVersion": 3,\n  "tasks": [\n    {"id": "a", "title": "A", "order": 0, "status": "todo", "createdAt": "2026-10-05T01:00:00.000Z", "futureField": true}\n  ]\n}\n'
    localStorage.setItem(STORAGE_KEY, raw)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useTasks())
    expect(result.current.newerVersion).toBe(true)
    expect(result.current.todoTasks).toEqual([])
    expect(result.current.doneTodayTasks).toEqual([])

    act(() => result.current.addTask('B'))
    act(() => result.current.completeTask('a'))
    act(() => result.current.uncompleteTask('a'))
    act(() => result.current.deleteTask('a'))
    act(() => result.current.moveTask('a', 'down'))
    act(() => result.current.reorderTasks('a', 'b'))
    expect(result.current.todoTasks).toEqual([])
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
  })

  it.each<[string, () => void]>([
    ['an MVP1 array', () => localStorage.setItem(STORAGE_KEY, JSON.stringify(withDue(mvp1())))],
    ['a v2 store', () => localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, tasks: withDue(mvp1()) }))],
  ])('S0-10 after each of the six mutations localStorage holds schemaVersion 2 (seeded with %s)', (_label, seedStore) => {
    freezeAt(local(5, 9))
    seedStore()
    const { result } = renderHook(() => useTasks())
    // Every step changes state (no no-ops), so every step must produce a write.
    const steps: Array<[string, () => void]> = [
      ['addTask', () => result.current.addTask('E')],
      ['moveTask', () => result.current.moveTask('c', 'up')],
      ['reorderTasks', () => result.current.reorderTasks('a', 'c')],
      ['completeTask', () => result.current.completeTask('b')],
      ['uncompleteTask', () => result.current.uncompleteTask('d')],
      ['deleteTask', () => result.current.deleteTask('a')],
    ]
    for (const [name, run] of steps) {
      localStorage.removeItem(STORAGE_KEY) // a missing write must be detected, not masked by the previous one
      act(run)
      expect(schemaVersionStored(), `after ${name}`).toBe(2)
      expect(stored().length, `after ${name}`).toBeGreaterThan(0)
      expect(stored().find((t) => t.id === 'c')?.dueDate, `after ${name}`).toBe('2026-10-17')
    }
  })
})
