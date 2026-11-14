import { createElement, StrictMode, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { useTasks } from './useTasks'
import { BACKUP_KEY, STORAGE_KEY } from '../lib/storage'
import { labels } from '../lib/labels'
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

  it('P1-25 puts each added task on top: A, B, C becomes C, B, A', () => {
    const { result } = setup('A', 'B', 'C')
    expect(titles(result.current.todoTasks)).toEqual(['C', 'B', 'A'])
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
    expect(titles(result.current.todoTasks)).toEqual([...names].reverse()) // newest first
  })

  it('P1-31 adds exactly one task per call inside <StrictMode>', () => {
    const wrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children)
    const { result } = renderHook(() => useTasks(), { wrapper })
    act(() => result.current.addTask('A'))
    expect(result.current.todoTasks).toHaveLength(1)
    expect(stored()).toHaveLength(1)
  })
})

describe('new task on top (US-18)', () => {
  it('AC-18.1 a new task goes to the top, todo tasks keep their relative order, done tasks are untouched', () => {
    freezeAt(local(5, 9))
    const { result } = setup('A', 'B', 'C') // listed C, B, A
    act(() => result.current.completeTask(idOf(result, 'B')))
    const doneBefore = result.current.doneTodayTasks
    act(() => result.current.addTask('D'))
    expect(titles(result.current.todoTasks)).toEqual(['D', 'C', 'A'])
    expect(result.current.todoTasks.map((t) => t.order)).toEqual([0, 1, 2])
    expect(result.current.doneTodayTasks[0]).toBe(doneBefore[0]) // the same object: done tasks are not renumbered
    expect(stored().map((t) => t.title)).toEqual(['D', 'C', 'B', 'A']) // raw array: new task first, the rest as before
  })

  it('AC-18.2 after a remount the new task is still first and the stored todo order is already 0..n-1', () => {
    const first = setup('A', 'B', 'C')
    act(() => first.result.current.completeTask(idOf(first.result, 'B'))) // leaves a gap: C 0, A 2
    act(() => first.result.current.addTask('D')) // the add closes it: D 0, C 1, A 2
    const before = first.result.current.todoTasks
    expect(before.map((t) => [t.title, t.order])).toEqual([
      ['D', 0],
      ['C', 1],
      ['A', 2],
    ])
    first.unmount()
    const { result } = renderHook(() => useTasks())
    expect(result.current.todoTasks).toStrictEqual(before) // loading changes nothing, order numbers included
  })

  it('AC-18.3 undo of an add removes it, redo puts it back on top, the history label stays the add label', () => {
    const { result } = setup('A', 'B')
    const before = snapshot(result)
    const storedBefore = stored()
    act(() => result.current.addTask('C'))
    expect(titles(result.current.todoTasks)).toEqual(['C', 'B', 'A'])
    expect(result.current.lastUndoLabel).toBe(labels.history.add('C'))
    act(() => result.current.undo())
    expect(snapshot(result)).toStrictEqual(before)
    expect(stored()).toStrictEqual(storedBefore)
    expect(result.current.lastRedoLabel).toBe(labels.history.add('C'))
    act(() => result.current.redo())
    expect(titles(result.current.todoTasks)).toEqual(['C', 'B', 'A'])
    expect(result.current.todoTasks.map((t) => t.order)).toEqual([0, 1, 2])
    expect(result.current.lastUndoLabel).toBe(labels.history.add('C'))
    expect(stored().map((t) => t.title)).toEqual(['C', 'B', 'A'])
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

  it('P1-33 completing B out of C, B, A leaves C, A', () => {
    const { result } = setup('A', 'B', 'C')
    act(() => result.current.completeTask(idOf(result, 'B')))
    expect(titles(result.current.todoTasks)).toEqual(['C', 'A'])
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
  it('P1-36 returns the task to the end of todo (not its old top position) and removes completedAt', () => {
    const { result } = setup('A', 'B', 'C') // listed C, B, A
    const id = idOf(result, 'C')
    act(() => result.current.completeTask(id))
    act(() => result.current.uncompleteTask(id))

    expect(titles(result.current.todoTasks)).toEqual(['B', 'A', 'C'])
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
    expect(titles(result.current.todoTasks)).toEqual(['D', 'C', 'A'])
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
  it('P1-42 moving B up in C, B, A gives B, C, A', () => {
    const { result } = setup('A', 'B', 'C')
    act(() => result.current.moveTask(idOf(result, 'B'), 'up'))
    expect(titles(result.current.todoTasks)).toEqual(['B', 'C', 'A'])
  })

  it('P1-43 moving B down in C, B, A gives C, A, B', () => {
    const { result } = setup('A', 'B', 'C')
    act(() => result.current.moveTask(idOf(result, 'B'), 'down'))
    expect(titles(result.current.todoTasks)).toEqual(['C', 'A', 'B'])
  })

  it('P1-44 moving the first task up changes nothing', () => {
    const { result } = setup('A', 'B', 'C')
    const before = snapshot(result)
    act(() => result.current.moveTask(idOf(result, 'C'), 'up')) // C is on top
    expect(snapshot(result)).toEqual(before)
  })

  it('P1-45 moving the last task down changes nothing', () => {
    const { result } = setup('A', 'B', 'C')
    const before = snapshot(result)
    act(() => result.current.moveTask(idOf(result, 'A'), 'down')) // A is at the bottom
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

  it('P1-48 with C, (B done), A moving A up gives A, C', () => {
    const { result } = setup('A', 'B', 'C')
    act(() => result.current.completeTask(idOf(result, 'B')))
    act(() => result.current.moveTask(idOf(result, 'A'), 'up'))
    expect(titles(result.current.todoTasks)).toEqual(['A', 'C'])
  })
})

describe('reorderTasks (drag & drop)', () => {
  it('P1-49 dragging A onto C in D, C, B, A gives D, A, C, B', () => {
    const { result } = setup('A', 'B', 'C', 'D')
    act(() => result.current.reorderTasks(idOf(result, 'A'), idOf(result, 'C')))
    expect(titles(result.current.todoTasks)).toEqual(['D', 'A', 'C', 'B'])
  })

  it('P1-50 dragging D onto B in D, C, B, A gives C, B, D, A', () => {
    const { result } = setup('A', 'B', 'C', 'D')
    act(() => result.current.reorderTasks(idOf(result, 'D'), idOf(result, 'B')))
    expect(titles(result.current.todoTasks)).toEqual(['C', 'B', 'D', 'A'])
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
      () => result.current.moveTask(idOf(result, 'A'), 'up'), // C, B, A → C, A, B (C is already on top)
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
    act(() => first.result.current.moveTask(idOf(first.result, 'D'), 'down')) // D, C, B, A → C, D, B, A
    act(() => first.result.current.completeTask(idOf(first.result, 'A')))
    const before = sequence(first.result)
    expect(titles(first.result.current.todoTasks)).toEqual(['C', 'D', 'B'])
    first.unmount()

    const { result } = renderHook(() => useTasks())
    expect(sequence(result)).toEqual(before)
  })

  it('P1-61 after many deletes and completions a new task still goes to the top, while ↩ still goes to the end', () => {
    const { result } = setup('A', 'B', 'C', 'D', 'E') // listed E, D, C, B, A
    act(() => result.current.deleteTask(idOf(result, 'E')))
    act(() => result.current.completeTask(idOf(result, 'D')))
    act(() => result.current.deleteTask(idOf(result, 'A')))
    act(() => result.current.moveTask(idOf(result, 'B'), 'up')) // C, B → B, C
    act(() => result.current.addTask('F'))
    expect(titles(result.current.todoTasks)).toEqual(['F', 'B', 'C'])

    act(() => result.current.uncompleteTask(idOf(result, 'D')))
    act(() => result.current.addTask('G'))
    expect(titles(result.current.todoTasks)).toEqual(['G', 'F', 'B', 'C', 'D'])
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

describe('undo / redo history (slice 2)', () => {
  const strict = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children)
  const seedV2 = (tasks: Task[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, tasks }))
  const a: Task = { id: 'a', title: 'A', order: 0, status: 'todo', createdAt: '2026-10-05T01:00:00.000Z' }
  const b: Task = { id: 'b', title: 'B', order: 1, status: 'todo', createdAt: '2026-10-05T02:00:00.000Z' }

  it('AC-15.1 undoing a delete puts B back in position 2 with every field as before', () => {
    const { result } = setup('A', 'B', 'C')
    const before = snapshot(result)
    const storedBefore = stored()
    act(() => result.current.deleteTask(idOf(result, 'B')))
    expect(titles(result.current.todoTasks)).toEqual(['C', 'A'])
    act(() => result.current.undo())
    expect(titles(result.current.todoTasks)).toEqual(['C', 'B', 'A'])
    expect(snapshot(result)).toStrictEqual(before)
    expect(stored()).toStrictEqual(storedBefore)
  })

  it.each<[string, (result: HookResult) => void]>([
    ['addTask', (r) => r.current.addTask('E')],
    ['completeTask', (r) => r.current.completeTask(idOf(r, 'B'))],
    ['uncompleteTask', (r) => r.current.uncompleteTask(idOf(r, 'D'))],
    ['moveTask ↑↓', (r) => r.current.moveTask(idOf(r, 'B'), 'down')],
    ['reorderTasks (drag)', (r) => r.current.reorderTasks(idOf(r, 'A'), idOf(r, 'C'))],
    ['moveTask from the review (swap)', (r) => r.current.moveTask(idOf(r, 'A'), 'up', 'swap')], // A is at the bottom
    ['deleteTask', (r) => r.current.deleteTask(idOf(r, 'A'))],
    ['setDueDate', (r) => r.current.setDueDate(idOf(r, 'B'), '2026-10-20')],
    ['setDueDate on a task that already has one', (r) => r.current.setDueDate(idOf(r, 'C'), '2026-10-20')],
    ['setDueDate(null) (clearing the due date)', (r) => r.current.setDueDate(idOf(r, 'C'), null)],
  ])('AC-15.2 undo after %s restores the exact previous state, completedAt and dueDate included', (_name, run) => {
    freezeAt(local(5, 9))
    const { result } = setup('A', 'B', 'C', 'D')
    act(() => result.current.completeTask(idOf(result, 'D')))
    act(() => result.current.setDueDate(idOf(result, 'C'), '2026-10-17')) // every undo below must bring this back too
    const before = snapshot(result)
    expect(before.todo.find((t) => t.title === 'C')?.dueDate).toBe('2026-10-17')
    act(() => run(result))
    expect(snapshot(result)).not.toStrictEqual(before)
    act(() => result.current.undo())
    expect(snapshot(result)).toStrictEqual(before)
    expect(stored().sort((x, y) => x.id.localeCompare(y.id))).toStrictEqual(
      [...before.todo, ...before.done].sort((x, y) => x.id.localeCompare(y.id)),
    )
  })

  it('AC-15.3 starts with nothing to undo or redo', () => {
    seedV2([a, b])
    const { result } = renderHook(() => useTasks())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
    expect(result.current.lastUndoLabel).toBeNull()
    expect(result.current.lastRedoLabel).toBeNull()
  })

  it('AC-15.5 a new action after an undo clears redo', () => {
    const { result } = setup('A')
    act(() => result.current.addTask('B'))
    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.addTask('C'))
    expect(result.current.canRedo).toBe(false)
    expect(titles(result.current.todoTasks)).toEqual(['C', 'A'])
  })

  it('AC-15.7 keeps 50 steps: after 60 actions undo stops after 50, leaving the state after action 10', () => {
    const { result } = renderHook(() => useTasks())
    for (let i = 1; i <= 60; i++) act(() => result.current.addTask(`T${i}`))
    let undone = 0
    while (result.current.canUndo) {
      act(() => result.current.undo())
      undone++
    }
    expect(undone).toBe(50)
    expect(titles(result.current.todoTasks)).toEqual(Array.from({ length: 10 }, (_, i) => `T${10 - i}`)) // newest first
    act(() => result.current.undo())
    expect(titles(result.current.todoTasks)).toHaveLength(10)
  })

  it('AC-15.8 history does not survive a remount, the tasks do', () => {
    const first = setup('A', 'B')
    expect(first.result.current.canUndo).toBe(true)
    first.unmount()
    const { result } = renderHook(() => useTasks())
    expect(titles(result.current.todoTasks)).toEqual(['B', 'A'])
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
    act(() => result.current.undo())
    expect(titles(result.current.todoTasks)).toEqual(['B', 'A'])
  })

  it('AC-15.9 localStorage matches the state right after undo and right after redo', () => {
    const { result } = setup('A', 'B')
    act(() => result.current.completeTask(idOf(result, 'A')))
    act(() => result.current.undo())
    expect(stored().map((t) => [t.title, t.status])).toEqual([
      ['B', 'todo'],
      ['A', 'todo'],
    ])
    act(() => result.current.redo())
    expect(stored().map((t) => [t.title, t.status])).toEqual([
      ['B', 'todo'],
      ['A', 'done'],
    ])
    expect((JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Store).schemaVersion).toBe(2)
  })

  it('S2-01 actions that change nothing create no history entry', () => {
    seedV2([a, b])
    const { result } = renderHook(() => useTasks())
    act(() => result.current.moveTask('a', 'up'))
    act(() => result.current.moveTask('b', 'down'))
    act(() => result.current.completeTask('nope'))
    act(() => result.current.deleteTask('nope'))
    act(() => result.current.uncompleteTask('a'))
    act(() => result.current.reorderTasks('a', 'a'))
    act(() => result.current.addTask('   '))
    expect(result.current.canUndo).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ schemaVersion: 2, tasks: [a, b] }))
  })

  it('S2-02 three undos step back one action each, three redos bring everything back', () => {
    seedV2([a]) // seeded, not added: the history starts empty
    const { result } = renderHook(() => useTasks())
    const states = [snapshot(result)]
    act(() => result.current.addTask('B'))
    states.push(snapshot(result))
    act(() => result.current.moveTask(idOf(result, 'B'), 'down')) // B was added on top of A
    states.push(snapshot(result))
    act(() => result.current.completeTask(idOf(result, 'A')))
    states.push(snapshot(result))
    for (const expected of [states[2], states[1], states[0]]) {
      act(() => result.current.undo())
      expect(snapshot(result)).toStrictEqual(expected)
    }
    expect(result.current.canUndo).toBe(false)
    for (const expected of [states[1], states[2], states[3]]) {
      act(() => result.current.redo())
      expect(snapshot(result)).toStrictEqual(expected)
    }
    expect(result.current.canRedo).toBe(false)
  })

  it('S2-03 newer-version data: undo and redo are no-ops and both flags stay false', () => {
    const raw = '{\n  "schemaVersion": 3,\n  "tasks": []\n}\n'
    localStorage.setItem(STORAGE_KEY, raw)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useTasks())
    act(() => result.current.addTask('A'))
    act(() => result.current.undo())
    act(() => result.current.redo())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
    expect(result.current.todoTasks).toEqual([])
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('S2-04 inside <StrictMode> one action creates exactly one history entry', () => {
    const { result } = renderHook(() => useTasks(), { wrapper: strict })
    act(() => result.current.addTask('A'))
    expect(result.current.canUndo).toBe(true)
    act(() => result.current.undo())
    expect(result.current.todoTasks).toEqual([])
    expect(result.current.canUndo).toBe(false)
  })

  it('S2-05 history labels name the kind of action and the task', () => {
    freezeAt(local(5, 9))
    const { result } = setup('A', 'B', 'C')
    expect(result.current.lastUndoLabel).toBe(labels.history.add('C'))
    act(() => result.current.completeTask(idOf(result, 'A')))
    expect(result.current.lastUndoLabel).toBe(labels.history.complete('A'))
    act(() => result.current.uncompleteTask(idOf(result, 'A')))
    expect(result.current.lastUndoLabel).toBe(labels.history.uncomplete('A'))
    act(() => result.current.moveTask(idOf(result, 'A'), 'up'))
    expect(result.current.lastUndoLabel).toBe(labels.history.move('A'))
    act(() => result.current.reorderTasks(idOf(result, 'A'), idOf(result, 'C')))
    expect(result.current.lastUndoLabel).toBe(labels.history.move('A'))
    act(() => result.current.moveTask(idOf(result, 'A'), 'down', 'swap')) // A is on top after the drag
    expect(result.current.lastUndoLabel).toBe(labels.history.swap('A'))
    act(() => result.current.deleteTask(idOf(result, 'B')))
    expect(result.current.lastUndoLabel).toBe(labels.history.remove('B'))
    act(() => result.current.undo())
    expect(result.current.lastRedoLabel).toBe(labels.history.remove('B'))
    expect(result.current.lastUndoLabel).toBe(labels.history.swap('A'))
  })

  it('S2-21 undoing back to the very first snapshot still writes localStorage', () => {
    seedV2([a])
    const { result } = renderHook(() => useTasks())
    act(() => result.current.addTask('B'))
    expect(stored()).toHaveLength(2)
    act(() => result.current.undo())
    expect(stored()).toStrictEqual([a])
  })

  it('S2-22 redo after undoing to the first snapshot catches localStorage up again', () => {
    seedV2([a])
    const { result } = renderHook(() => useTasks())
    act(() => result.current.addTask('B'))
    act(() => result.current.undo())
    expect(stored()).toStrictEqual([a])
    act(() => result.current.redo())
    expect(stored().map((t) => t.title)).toEqual(['B', 'A'])
    expect(stored()).toStrictEqual([...result.current.todoTasks])
  })
})

describe('due date (slice 3)', () => {
  const seedV2 = (tasks: Task[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, tasks }))
  const rawStore = () => localStorage.getItem(STORAGE_KEY)
  const a: Task = { id: 'a', title: 'A', order: 0, status: 'todo', createdAt: '2026-10-05T01:00:00.000Z' }
  const b: Task = { id: 'b', title: 'B', order: 1, status: 'todo', createdAt: '2026-10-05T02:00:00.000Z' }
  const c: Task = { id: 'c', title: 'C', order: 2, status: 'todo', createdAt: '2026-10-05T03:00:00.000Z' }
  // Finished "today" for a clock frozen on 17 October 2026.
  const d: Task = {
    id: 'd', title: 'D', order: 7, status: 'done', createdAt: '2026-10-05T04:00:00.000Z', completedAt: local(17, 8).toISOString(),
  }
  const todoById = (result: HookResult, id: string) => result.current.todoTasks.find((t) => t.id === id)

  it('AC-11.2 setDueDate saves the date on the task and in localStorage at once', () => {
    seedV2([a, b])
    const { result } = renderHook(() => useTasks())
    act(() => result.current.setDueDate('a', '2026-10-24'))
    expect(todoById(result, 'a')).toStrictEqual({ ...a, dueDate: '2026-10-24' })
    expect(JSON.parse(rawStore() ?? 'null')).toStrictEqual({ schemaVersion: 2, tasks: [{ ...a, dueDate: '2026-10-24' }, b] })
    // changing it again replaces the value
    act(() => result.current.setDueDate('a', '2026-11-02'))
    expect(todoById(result, 'a')?.dueDate).toBe('2026-11-02')
    expect(stored()).toStrictEqual([{ ...a, dueDate: '2026-11-02' }, b])
  })

  it('AC-11.3 setDueDate(null) removes the dueDate field itself, in state and in localStorage', () => {
    seedV2([{ ...a, dueDate: '2026-10-24' }, b])
    const { result } = renderHook(() => useTasks())
    act(() => result.current.setDueDate('a', null))
    const task = todoById(result, 'a')
    expect(task).toStrictEqual(a)
    expect(Object.keys(task ?? {})).not.toContain('dueDate') // not `dueDate: undefined`
    expect(rawStore()).toBe(JSON.stringify({ schemaVersion: 2, tasks: [a, b] }))
  })

  it('AC-11.4 undo takes a new due date away and redo brings it back', () => {
    seedV2([a, b])
    const { result } = renderHook(() => useTasks())
    act(() => result.current.setDueDate('a', '2026-10-24'))
    act(() => result.current.undo())
    expect(todoById(result, 'a')).toStrictEqual(a)
    expect(stored()).toStrictEqual([a, b])
    act(() => result.current.redo())
    expect(todoById(result, 'a')).toStrictEqual({ ...a, dueDate: '2026-10-24' })
    expect(stored()).toStrictEqual([{ ...a, dueDate: '2026-10-24' }, b])
    // and the other way round: undo of a removal brings the date back
    act(() => result.current.setDueDate('a', null))
    act(() => result.current.undo())
    expect(todoById(result, 'a')?.dueDate).toBe('2026-10-24')
  })

  it('AC-13.1 a due date of yesterday on C leaves the list order and every order value untouched', () => {
    freezeAt(local(17, 9))
    seedV2([a, b, c, d])
    const { result } = renderHook(() => useTasks())
    act(() => result.current.setDueDate('c', '2026-10-16'))
    expect(titles(result.current.todoTasks)).toEqual(['A', 'B', 'C'])
    expect(result.current.todoTasks).toStrictEqual([a, b, { ...c, dueDate: '2026-10-16' }])
    expect(result.current.doneTodayTasks).toStrictEqual([d])
    expect(stored()).toStrictEqual([a, b, { ...c, dueDate: '2026-10-16' }, d]) // same array position, same order numbers
    // … and neither does changing or removing it, on any row
    act(() => result.current.setDueDate('a', '2026-12-31'))
    act(() => result.current.setDueDate('c', null))
    expect(stored()).toStrictEqual([{ ...a, dueDate: '2026-12-31' }, b, c, d])
    expect(result.current.todoTasks.map((t) => [t.title, t.order])).toEqual([['A', 0], ['B', 1], ['C', 2]])
  })

  it('AC-12.5 a task with a due date keeps it through complete → uncomplete', () => {
    freezeAt(local(17, 9))
    seedV2([{ ...a, dueDate: '2026-10-24' }, b])
    const { result } = renderHook(() => useTasks())
    act(() => result.current.completeTask('a'))
    expect(result.current.doneTodayTasks[0]).toStrictEqual({
      ...a, dueDate: '2026-10-24', status: 'done', completedAt: local(17, 9).toISOString(),
    })
    act(() => result.current.uncompleteTask('a'))
    // back at the bottom of the list, with everything it had except completedAt
    expect(result.current.todoTasks).toStrictEqual([b, { ...a, order: 2, dueDate: '2026-10-24' }])
    expect(Object.keys(todoById(result, 'a') ?? {})).not.toContain('completedAt')
    expect(stored().find((t) => t.id === 'a')).toStrictEqual({ ...a, order: 2, dueDate: '2026-10-24' })
  })

  it('AC-12.5 a task without a due date comes back from done without one', () => {
    freezeAt(local(17, 9))
    seedV2([a, b])
    const { result } = renderHook(() => useTasks())
    act(() => result.current.completeTask('a'))
    act(() => result.current.uncompleteTask('a'))
    expect(todoById(result, 'a')).toStrictEqual({ ...a, order: 2 })
    expect(Object.keys(todoById(result, 'a') ?? {})).not.toContain('dueDate')
  })

  it.each([['2026-02-30'], ['abc'], ['2026-2-3'], ['2026-10-17T00:00:00.000Z'], ['17/10/2026'], ['']])(
    'S3-03 an invalid date (%j) is a no-op and creates no history entry',
    (value) => {
      seedV2([{ ...a, dueDate: '2026-10-24' }, b])
      const raw = rawStore()
      const setItem = vi.spyOn(Storage.prototype, 'setItem')
      const { result } = renderHook(() => useTasks())
      act(() => result.current.setDueDate('a', value))
      act(() => result.current.setDueDate('b', value))
      expect(todoById(result, 'a')?.dueDate).toBe('2026-10-24')
      expect(Object.keys(todoById(result, 'b') ?? {})).not.toContain('dueDate')
      expect(result.current.canUndo).toBe(false)
      expect(setItem).not.toHaveBeenCalled()
      expect(rawStore()).toBe(raw)
    },
  )

  it('S3-04 setting the value a task already has, clearing a task that has none, or an unknown id creates no entry', () => {
    seedV2([{ ...a, dueDate: '2026-10-24' }, b])
    const raw = rawStore()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useTasks())
    act(() => result.current.setDueDate('a', '2026-10-24'))
    act(() => result.current.setDueDate('b', null))
    act(() => result.current.setDueDate('nope', '2026-10-24'))
    act(() => result.current.setDueDate('nope', null))
    expect(result.current.canUndo).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
    expect(rawStore()).toBe(raw)
  })

  it('S3-05 a done task cannot get, change or lose a due date', () => {
    freezeAt(local(17, 9))
    const doneWithDue: Task = { ...d, id: 'e', title: 'E', dueDate: '2026-10-10' }
    seedV2([a, d, doneWithDue])
    const raw = rawStore()
    const { result } = renderHook(() => useTasks())
    act(() => result.current.setDueDate('d', '2026-10-24'))
    act(() => result.current.setDueDate('e', '2026-10-24'))
    act(() => result.current.setDueDate('e', null))
    expect(result.current.doneTodayTasks).toStrictEqual([d, doneWithDue])
    expect(result.current.canUndo).toBe(false)
    expect(rawStore()).toBe(raw)
  })

  it('S3-06 newer-version data: setDueDate does nothing and never writes', () => {
    const raw =
      '{\n  "schemaVersion": 3,\n  "tasks": [\n    {"id": "a", "title": "A", "order": 0, "status": "todo", "createdAt": "2026-10-05T01:00:00.000Z"}\n  ]\n}\n'
    localStorage.setItem(STORAGE_KEY, raw)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useTasks())
    expect(result.current.newerVersion).toBe(true)
    act(() => result.current.setDueDate('a', '2026-10-24'))
    act(() => result.current.setDueDate('a', null))
    expect(result.current.todoTasks).toEqual([])
    expect(result.current.canUndo).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
    expect(rawStore()).toBe(raw)
  })

  it('S3-07 history labels say whether the due date was set or removed, and for which task', () => {
    seedV2([a, b])
    const { result } = renderHook(() => useTasks())
    act(() => result.current.setDueDate('a', '2026-10-24'))
    expect(result.current.lastUndoLabel).toBe(labels.history.setDue('A'))
    expect(result.current.lastUndoLabel).toBe('ตั้งกำหนดส่ง "A"')
    act(() => result.current.setDueDate('a', '2026-10-25')) // changing an existing date is still "set"
    expect(result.current.lastUndoLabel).toBe(labels.history.setDue('A'))
    act(() => result.current.setDueDate('b', '2026-10-25'))
    expect(result.current.lastUndoLabel).toBe(labels.history.setDue('B'))
    act(() => result.current.setDueDate('a', null))
    expect(result.current.lastUndoLabel).toBe(labels.history.clearDue('A'))
    expect(result.current.lastUndoLabel).toBe('ลบกำหนดส่ง "A"')
    act(() => result.current.undo())
    expect(result.current.lastRedoLabel).toBe(labels.history.clearDue('A'))
    expect(result.current.lastUndoLabel).toBe(labels.history.setDue('B'))
  })
})
