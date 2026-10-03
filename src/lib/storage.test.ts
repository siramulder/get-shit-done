import { BACKUP_KEY, loadTasks, saveTasks, STORAGE_KEY } from './storage'
import type { Task } from '../types/task'

const a: Task = { id: 'a', title: 'งาน A', order: 0, status: 'todo', createdAt: '2026-10-05T01:00:00.000Z' }
const b: Task = { id: 'b', title: 'งาน B', order: 1, status: 'todo', createdAt: '2026-10-05T02:00:00.000Z' }
const d: Task = {
  id: 'd',
  title: 'งาน D',
  order: 2,
  status: 'done',
  createdAt: '2026-10-05T03:00:00.000Z',
  completedAt: '2026-10-05T04:00:00.000Z',
}

const storeRaw = (raw: string) => localStorage.setItem(STORAGE_KEY, raw)
const store = (value: unknown) => storeRaw(JSON.stringify(value))
const backup = () => localStorage.getItem(BACKUP_KEY)

function without(task: Task, field: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...task }
  delete copy[field]
  return copy
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('keys', () => {
  it('P1-03 reads and writes under "task-priority-app:tasks"', () => {
    expect(STORAGE_KEY).toBe('task-priority-app:tasks')
    saveTasks([a])
    expect(JSON.parse(localStorage.getItem('task-priority-app:tasks') ?? 'null')).toEqual([a])
    expect(BACKUP_KEY).toBe('task-priority-app:tasks:corrupt-backup')
  })
})

describe('loadTasks — valid data', () => {
  it('P1-04 returns [] when nothing is stored', () => {
    expect(loadTasks()).toEqual([])
    expect(backup()).toBeNull()
  })

  it('P1-05 returns every field of valid tasks', () => {
    store([a, d])
    expect(loadTasks()).toStrictEqual([a, d])
  })

  it('P1-06 round-trips what saveTasks wrote', () => {
    saveTasks([a, b, d])
    expect(loadTasks()).toStrictEqual([a, b, d])
  })
})

describe('loadTasks — unreadable data', () => {
  it('P1-07 returns [] for broken JSON and backs up the raw string', () => {
    storeRaw('[{"id":"a",')
    expect(loadTasks()).toEqual([])
    expect(backup()).toBe('[{"id":"a",')
  })

  it.each(['{}', '"text"', 'null', '123'])(
    'P1-08 returns [] when the JSON is not an array (%s) and backs it up',
    (raw) => {
      storeRaw(raw)
      expect(loadTasks()).toEqual([])
      expect(backup()).toBe(raw)
    },
  )
})

describe('loadTasks — partially bad data', () => {
  it.each(['id', 'title', 'order', 'status', 'createdAt'])(
    'P1-09 drops an item missing the required field "%s"',
    (field) => {
      store([a, without(b, field)])
      expect(loadTasks()).toStrictEqual([a])
      expect(backup()).not.toBeNull()
    },
  )

  it.each<[string, Record<string, unknown>]>([
    ['id as number', { ...b, id: 1 }],
    ['title as null', { ...b, title: null }],
    ['order as string', { ...b, order: '1' }],
    ['createdAt as number', { ...b, createdAt: 123 }],
    ['completedAt as number', { ...d, completedAt: 123 }],
    ['item is null', null as unknown as Record<string, unknown>],
    ['item is a string', 'b' as unknown as Record<string, unknown>],
  ])('P1-10 drops an item with a wrong type (%s)', (_label, bad) => {
    store([a, bad])
    expect(loadTasks()).toStrictEqual([a])
  })

  it.each(['archived', 'TODO', '', null])('P1-11 drops an item whose status is %j', (status) => {
    store([a, { ...b, status }])
    expect(loadTasks()).toStrictEqual([a])
  })

  it('P1-11b drops a done item that has no completedAt', () => {
    store([a, without(d, 'completedAt')])
    expect(loadTasks()).toStrictEqual([a])
    expect(backup()).not.toBeNull()
  })

  it('P1-12 keeps the first valid copy of a duplicate id', () => {
    store([a, { ...b, id: 'a', title: 'ซ้ำ' }])
    expect(loadTasks()).toStrictEqual([a])

    store([{ ...a, title: 42 }, a])
    expect(loadTasks()).toStrictEqual([a])
  })

  it('P1-13 keeps every good task when good and bad items are mixed', () => {
    store([a, null, b, { ...b, status: 'archived' }, d, 'oops'])
    expect(loadTasks()).toStrictEqual([a, b, d])
  })
})

describe('corrupt backup', () => {
  it('P1-14 stores the exact raw string, and never backs up clean data', () => {
    const raw = '[ {"id":"a","title":"งาน 🚀","order":0,"status":"todo","createdAt":"2026-10-05T01:00:00.000Z"} ,\n 42 ]'
    storeRaw(raw)
    loadTasks()
    expect(backup()).toBe(raw)

    localStorage.clear()
    store([a, b, d])
    loadTasks()
    expect(backup()).toBeNull()
  })

  it('P1-14b strips unknown fields and backs up the raw string', () => {
    const raw = JSON.stringify([{ ...a, priority: 1 }, b])
    storeRaw(raw)
    expect(loadTasks()).toStrictEqual([a, b])
    expect(backup()).toBe(raw)
  })

  it('overwrites an older backup with the latest unreadable data', () => {
    localStorage.setItem(BACKUP_KEY, 'older backup')
    storeRaw('{broken')
    loadTasks()
    expect(backup()).toBe('{broken')
  })

  it('still returns the cleaned list when writing the backup fails', () => {
    store([a, null])
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(loadTasks()).toStrictEqual([a])
  })
})

describe('order normalization', () => {
  it('renumbers todo order to 0..n-1 by order then createdAt, leaves done untouched, and writes no backup', () => {
    const late = { ...a, id: 'late', order: 7, createdAt: '2026-10-05T09:00:00.000Z' }
    const tieNewer = { ...a, id: 'tieNewer', order: 3, createdAt: '2026-10-05T08:00:00.000Z' }
    const tieOlder = { ...a, id: 'tieOlder', order: 3, createdAt: '2026-10-05T07:00:00.000Z' }
    const done = { ...d, order: 99 }
    store([late, done, tieNewer, tieOlder])

    const byId = Object.fromEntries(loadTasks().map((t) => [t.id, t.order]))
    expect(byId).toEqual({ tieOlder: 0, tieNewer: 1, late: 2, d: 99 })
    expect(backup()).toBeNull()
  })
})

describe('storage errors never escape', () => {
  it('P1-15 saveTasks does not throw when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => saveTasks([a])).not.toThrow()
  })

  it('P1-16 loadTasks returns [] without throwing when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => loadTasks()).not.toThrow()
    expect(loadTasks()).toEqual([])
  })
})
