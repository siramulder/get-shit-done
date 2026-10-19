import { BACKUP_KEY, loadStore, loadTasks, saveTasks, STORAGE_KEY } from './storage'
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
    expect(JSON.parse(localStorage.getItem('task-priority-app:tasks') ?? 'null')).toEqual({ schemaVersion: 2, tasks: [a] })
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

// Captured verbatim from the deployed MVP1 build (commit 19ccfad, https://siramulder.github.io/get-shit-done/)
// on 2026-10-19: four tasks added through the UI, then the second one completed, so the todo `order`
// values have a gap (0, 2, 3) exactly like a real user's data would after completing a task.
const MVP1_PAYLOAD =
  "[{\"id\":\"4174f525-4a36-4078-bac5-2bb5db933093\",\"title\":\"ซื้อนม\",\"order\":0,\"status\":\"todo\",\"createdAt\":\"2026-10-19T09:24:40.443Z\"},{\"id\":\"243cd621-27bd-43fc-a1a2-22610da0aafc\",\"title\":\"ส่งรายงานประจำสัปดาห์\",\"order\":1,\"status\":\"done\",\"createdAt\":\"2026-10-19T09:24:40.460Z\",\"completedAt\":\"2026-10-19T09:24:59.370Z\"},{\"id\":\"201bf1dd-6522-4991-ae7c-0d6bb30a0414\",\"title\":\"โทรหาลูกค้า \\\"บริษัท A\\\"\",\"order\":2,\"status\":\"todo\",\"createdAt\":\"2026-10-19T09:24:40.469Z\"},{\"id\":\"4b177b8b-a540-4ba9-b50f-f05dac3cdfa1\",\"title\":\"จองตั๋ว 🚀\",\"order\":3,\"status\":\"todo\",\"createdAt\":\"2026-10-19T09:24:40.480Z\"}]"

const storeV2 = (tasks: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ schemaVersion: 2, tasks, ...extra })

describe('AC-16.1 MVP1 array migrates in memory', () => {
  it('AC-16.1 loads a real MVP1 payload completely, in the same order, and writes no backup', () => {
    storeRaw(MVP1_PAYLOAD)
    const expected = JSON.parse(MVP1_PAYLOAD) as Task[]
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const result = loadStore()
    expect(setItem).not.toHaveBeenCalled()
    expect(result.status).toBe('ok')
    const tasks = result.status === 'ok' ? result.tasks : []
    expect(tasks).toHaveLength(expected.length)

    // Done tasks come through untouched, order included.
    expect(tasks.filter((t) => t.status === 'done')).toStrictEqual(expected.filter((t) => t.status === 'done'))

    // Todo tasks keep every field and their original sequence; only `order` is renumbered to 0..n-1
    // (load compares sequence, not raw order numbers — the same point P1-59 makes).
    const byOrder = (x: Task, y: Task) => x.order - y.order
    const expectedTodo = expected.filter((t) => t.status === 'todo').sort(byOrder)
    const todo = tasks.filter((t) => t.status === 'todo').sort(byOrder)
    expect(expectedTodo.map((t) => t.order)).toEqual([0, 2, 3]) // the fixture really has a gap
    expect(todo.map((t) => t.id)).toEqual(expectedTodo.map((t) => t.id))
    expect(todo.map((t) => without(t, 'order'))).toStrictEqual(expectedTodo.map((t) => without(t, 'order')))
    expect(todo.map((t) => t.order)).toEqual([0, 1, 2])

    expect(loadTasks()).toStrictEqual(tasks)
    expect(backup()).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(MVP1_PAYLOAD)
  })
})

describe('AC-16.3 malformed dueDate', () => {
  it.each<[string, (items: unknown[]) => unknown]>([
    ['an MVP1 array', (items) => items],
    ['a v2 store', (items) => ({ schemaVersion: 2, tasks: items })],
  ])('AC-16.3 keeps the task, drops only dueDate "15/10/2026", and backs up the raw string (%s)', (_label, wrap) => {
    const raw = JSON.stringify(wrap([{ ...a, dueDate: '15/10/2026' }, b, d]))
    storeRaw(raw)
    expect(loadTasks()).toStrictEqual([a, b, d])
    expect(backup()).toBe(raw)
  })
})

describe('AC-16.4 data from a newer version', () => {
  it('AC-16.4 loadStore reports newer-version, leaves the raw string untouched, and writes no backup', () => {
    const raw =
      '{\n  "schemaVersion": 3,\n  "tasks": [ {"id":"a","title":"A","order":0,"status":"todo","createdAt":"2026-10-05T01:00:00.000Z","futureField":true} ]\n}\n'
    storeRaw(raw)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    expect(loadStore()).toEqual({ status: 'newer-version', schemaVersion: 3 })
    expect(loadTasks()).toEqual([])
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
    expect(backup()).toBeNull()
  })
})

describe('v2 store', () => {
  it('S0-01 a valid v2 store with dueDate round-trips every field', () => {
    const due: Task = { ...b, dueDate: '2026-10-17' }
    const doneDue: Task = { ...d, dueDate: '2026-10-20' }
    saveTasks([a, due, doneDue])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({ schemaVersion: 2, tasks: [a, due, doneDue] })
    expect(loadStore()).toStrictEqual({ status: 'ok', tasks: [a, due, doneDue] })
    expect(backup()).toBeNull()
  })

  // The dueDate rules are the same in both containers (PO decision): a valid value survives even in a bare MVP1 array.
  describe.each<[string, (items: unknown[]) => unknown]>([
    ['an MVP1 array', (items) => items],
    ['a v2 store', (items) => ({ schemaVersion: 2, tasks: items })],
  ])('S0-02 inside %s', (_label, wrap) => {
    it.each(['2026-10-17', '2024-02-29', '2026-12-31', '2026-01-01'])('S0-02 accepts the real date %s on todo and done tasks', (dueDate) => {
      storeRaw(JSON.stringify(wrap([{ ...a, dueDate }, { ...d, dueDate }])))
      expect(loadTasks()).toStrictEqual([{ ...a, dueDate }, { ...d, dueDate }])
      expect(backup()).toBeNull()
    })
  })

  it.each<[string, unknown]>([
    ['month 13', '2026-13-01'],
    ['Feb 30', '2026-02-30'],
    ['Feb 29 in a non-leap year', '2026-02-29'],
    ['month 00', '2026-00-10'],
    ['day 00', '2026-10-00'],
    ['day 32', '2026-10-32'],
    ['not zero-padded', '2026-1-5'],
    ['a number', 20261017],
    ['null', null],
    ['an empty string', ''],
    ['a date-time', '2026-10-17T00:00:00.000Z'],
  ])('S0-02 drops a dueDate that is %s, keeps the task, and backs up', (_label, dueDate) => {
    const raw = storeV2([{ ...a, dueDate }, b])
    storeRaw(raw)
    expect(loadTasks()).toStrictEqual([a, b])
    expect(backup()).toBe(raw)
  })

  it('S0-03 loadStore keeps a valid dueDate on a done task', () => {
    const doneDue: Task = { ...d, dueDate: '2026-10-17' }
    storeRaw(storeV2([a, doneDue]))
    expect(loadTasks()).toStrictEqual([a, doneDue])
    expect(backup()).toBeNull()
  })

  it.each<[string, (items: unknown[]) => unknown]>([
    ['an MVP1 array', (items) => items],
    ['a v2 store', (items) => ({ schemaVersion: 2, tasks: items })],
  ])('S0-04 %s with a bad-status item and a duplicate id keeps the good tasks, drops the rest, and backs up', (_label, wrap) => {
    const raw = JSON.stringify(wrap([a, { ...b, status: 'archived' }, { ...a, title: 'ซ้ำ' }, d]))
    storeRaw(raw)
    expect(loadTasks()).toStrictEqual([a, d])
    expect(backup()).toBe(raw)
  })

  it.each<[string, unknown]>([
    ['schemaVersion missing', { tasks: [a] }],
    ['schemaVersion "2" (a string)', { schemaVersion: '2', tasks: [a] }],
    ['schemaVersion 1', { schemaVersion: 1, tasks: [a] }],
    ['schemaVersion 0', { schemaVersion: 0, tasks: [a] }],
    ['schemaVersion null', { schemaVersion: null, tasks: [a] }],
    ['tasks is an object', { schemaVersion: 2, tasks: {} }],
    ['tasks is a string', { schemaVersion: 2, tasks: '[]' }],
    ['tasks is null', { schemaVersion: 2, tasks: null }],
    ['tasks missing', { schemaVersion: 2 }],
  ])('S0-05 treats an object with %s as corrupt: [] + backup', (_label, value) => {
    const raw = JSON.stringify(value)
    storeRaw(raw)
    expect(loadStore()).toEqual({ status: 'ok', tasks: [] })
    expect(loadTasks()).toEqual([])
    expect(backup()).toBe(raw)
  })

  it('S0-05b keeps the tasks of a v2 store that has an extra top-level key, and backs it up', () => {
    const raw = storeV2([a, d], { extra: 1 })
    storeRaw(raw)
    expect(loadTasks()).toStrictEqual([a, d])
    expect(backup()).toBe(raw)
  })

  it.each<[number, unknown]>([
    [2.5, { schemaVersion: 2.5, tasks: [a] }],
    [99, { schemaVersion: 99, tasks: [] }],
    [3, { schemaVersion: 3 }],
  ])('S0-06 schemaVersion %s is a newer version, not corrupt data', (version, value) => {
    const raw = JSON.stringify(value)
    storeRaw(raw)
    expect(loadStore()).toEqual({ status: 'newer-version', schemaVersion: version })
    expect(loadTasks()).toEqual([])
    expect(backup()).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('S0-07 renumbers todo order of migrated MVP1 data without counting it as discarded', () => {
    storeRaw(JSON.stringify([{ ...a, order: 5 }, { ...b, order: 9 }, { ...d, order: 1 }]))
    expect(loadTasks()).toStrictEqual([{ ...a, order: 0 }, { ...b, order: 1 }, { ...d, order: 1 }])
    expect(backup()).toBeNull()
  })
})
