import { StrictMode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import App from './App'
import { labels } from './lib/labels'
import { STORAGE_KEY } from './lib/storage'
import type { Store, Task } from './types/task'

const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute)

function setup(ui = <App />) {
  const user = userEvent.setup()
  return { user, ...render(ui) }
}

async function addTasks(user: UserEvent, ...titles: string[]) {
  const input = screen.getByRole('textbox', { name: labels.inputLabel })
  for (const title of titles) await user.type(input, `${title}{Enter}`)
}

// Reads row titles back from the accessible names of a per-row button.
function titlesIn(listName: string, rowButtonLabel: (title: string) => string): string[] {
  const list = screen.queryByRole('list', { name: listName })
  if (!list) return []
  const prefix = rowButtonLabel('')
  return within(list)
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label') ?? '')
    .filter((name) => name.startsWith(prefix))
    .map((name) => name.slice(prefix.length))
}

const todoTitles = () => titlesIn(labels.todoHeading, labels.complete)
const doneTitles = () => titlesIn(labels.doneHeading, labels.uncomplete)
const button = (name: string) => screen.getByRole('button', { name })
const doneList = () => screen.getByRole('list', { name: labels.doneHeading })

function seed(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('adding and ordering', () => {
  it('P2-11 adding one task shows it in the list', async () => {
    const { user } = setup()
    await addTasks(user, 'ซื้อนม')
    expect(todoTitles()).toEqual(['ซื้อนม'])
  })

  it('P2-12 adding A, B, C lists them as A, B, C', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B', 'C')
    expect(todoTitles()).toEqual(['A', 'B', 'C'])
  })

  it('P2-13 ↑ on B gives B, A, C', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B', 'C')
    await user.click(button(labels.moveUp('B')))
    expect(todoTitles()).toEqual(['B', 'A', 'C'])
  })

  it('P2-14 ↓ on B gives A, C, B', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B', 'C')
    await user.click(button(labels.moveDown('B')))
    expect(todoTitles()).toEqual(['A', 'C', 'B'])
  })

  it('P2-15 disabled ↑/↓ follow each task to its new position', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B', 'C')
    await user.click(button(labels.moveUp('B')))

    expect(button(labels.moveUp('B'))).toBeDisabled()
    expect(button(labels.moveDown('B'))).toBeEnabled()
    expect(button(labels.moveUp('A'))).toBeEnabled()

    await user.click(button(labels.moveDown('A')))
    expect(todoTitles()).toEqual(['B', 'C', 'A'])
    expect(button(labels.moveDown('A'))).toBeDisabled()
    expect(button(labels.moveDown('C'))).toBeEnabled()
  })
})

describe('completing, undoing and deleting', () => {
  it('P2-16 ✓ moves the task into "เสร็จวันนี้"', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B')
    await user.click(button(labels.complete('A')))
    expect(todoTitles()).toEqual(['B'])
    expect(screen.getByRole('heading', { name: labels.doneHeading })).toBeInTheDocument()
    expect(doneTitles()).toEqual(['A'])
  })

  it('P2-17 undo puts the task back at the END of the todo list', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B', 'C')
    await user.click(button(labels.complete('A')))
    await user.click(button(labels.uncomplete('A')))
    expect(todoTitles()).toEqual(['B', 'C', 'A'])
    expect(doneTitles()).toEqual([])
  })

  it('P2-18 deleting a todo task keeps the others in order', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B', 'C')
    await user.click(button(labels.remove('B')))
    expect(todoTitles()).toEqual(['A', 'C'])
  })

  it('P2-19 deleting a done task removes it', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B')
    await user.click(button(labels.complete('A')))
    await user.click(within(doneList()).getByRole('button', { name: labels.remove('A') }))
    expect(doneTitles()).toEqual([])
    expect(todoTitles()).toEqual(['B'])
  })

  it('P2-20 deletes immediately: no dialog and no window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const { user } = setup()
    await addTasks(user, 'A')
    await user.click(button(labels.remove('A')))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(todoTitles()).toEqual([])
  })
})

describe('empty states and sections', () => {
  it('P2-21 starts with the "add your first task" empty state under the todo heading', () => {
    setup()
    expect(screen.getByRole('heading', { name: labels.todoHeading })).toBeInTheDocument()
    expect(screen.getByText(labels.emptyNoTasks)).toBeInTheDocument()
  })

  it('P2-22 the empty state disappears after adding and returns after deleting the last task', async () => {
    const { user } = setup()
    await addTasks(user, 'A')
    expect(screen.queryByText(labels.emptyNoTasks)).not.toBeInTheDocument()
    await user.click(button(labels.remove('A')))
    expect(screen.getByText(labels.emptyNoTasks)).toBeInTheDocument()
  })

  it('P2-23 finishing every task shows "all done", not "add your first task"', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B')
    await user.click(button(labels.complete('A')))
    await user.click(button(labels.complete('B')))
    expect(screen.getByText(labels.emptyAllDone)).toBeInTheDocument()
    expect(screen.queryByText(labels.emptyNoTasks)).not.toBeInTheDocument()
  })

  it('P2-24 no task finished today → no "เสร็จวันนี้" heading', async () => {
    const { user } = setup()
    await addTasks(user, 'A')
    expect(screen.queryByRole('heading', { name: labels.doneHeading })).not.toBeInTheDocument()
  })

  it('P2-25 a task finished yesterday is not shown', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(local(5, 9))
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
    setup()
    expect(screen.queryByText('เสร็จเมื่อวาน')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: labels.doneHeading })).not.toBeInTheDocument()
    expect(screen.getByText(labels.emptyNoTasks)).toBeInTheDocument()
  })

  it('P2-26 an unfinished task created yesterday is still shown today', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(local(5, 9))
    seed([{ id: 'old', title: 'ค้างจากเมื่อวาน', order: 0, status: 'todo', createdAt: local(4, 18).toISOString() }])
    setup()
    expect(todoTitles()).toEqual(['ค้างจากเมื่อวาน'])
  })
})

describe('robustness', () => {
  it('P2-27 after unmount and a fresh render the list and order are the same', async () => {
    const first = setup()
    await addTasks(first.user, 'A', 'B', 'C')
    await first.user.click(button(labels.moveUp('C')))
    expect(todoTitles()).toEqual(['A', 'C', 'B'])
    first.unmount()

    setup()
    expect(todoTitles()).toEqual(['A', 'C', 'B'])
  })

  it('P2-28 corrupted localStorage still renders the app with the empty state', () => {
    localStorage.setItem(STORAGE_KEY, '{definitely not json')
    expect(() => setup()).not.toThrow()
    expect(screen.getByRole('heading', { name: labels.appTitle })).toBeInTheDocument()
    expect(screen.getByText(labels.emptyNoTasks)).toBeInTheDocument()
  })

  it('P2-29 inside <StrictMode> one add creates exactly one task', async () => {
    const { user } = setup(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    await addTasks(user, 'A')
    expect(todoTitles()).toEqual(['A'])
  })

  it('P2-30 every todo row has a focusable drag handle; done rows have none', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B', 'C')
    await user.click(button(labels.complete('C')))

    for (const title of ['A', 'B']) {
      const handle = button(labels.dragHandle(title))
      handle.focus()
      expect(handle).toHaveFocus()
    }
    expect(within(doneList()).queryByRole('button', { name: labels.dragHandle('C') })).not.toBeInTheDocument()
  })

  it('P2-31 done rows have no ↑ / ↓ buttons', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B')
    await user.click(button(labels.complete('A')))
    expect(within(doneList()).queryByRole('button', { name: labels.moveUp('A') })).not.toBeInTheDocument()
    expect(within(doneList()).queryByRole('button', { name: labels.moveDown('A') })).not.toBeInTheDocument()
  })

  it('P2-32 duplicate titles create separate rows that act independently', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B', 'A')
    expect(todoTitles()).toEqual(['A', 'B', 'A'])

    await user.click(screen.getAllByRole('button', { name: labels.moveUp('A') })[1])
    expect(todoTitles()).toEqual(['A', 'A', 'B'])

    await user.click(screen.getAllByRole('button', { name: labels.complete('A') })[0])
    expect(todoTitles()).toEqual(['A', 'B'])
    expect(doneTitles()).toEqual(['A'])
  })

  it('P2-33 a long list (50 tasks) still moves, completes, deletes and appends correctly', async () => {
    seed(
      Array.from({ length: 50 }, (_, i): Task => ({
        id: `seed-${i + 1}`,
        title: `งาน ${i + 1}`,
        order: i,
        status: 'todo',
        createdAt: '2026-10-05T02:00:00.000Z',
      })),
    )
    const { user } = setup()
    expect(todoTitles()).toHaveLength(50)

    await user.click(button(labels.moveUp('งาน 50')))
    expect(todoTitles().slice(-2)).toEqual(['งาน 50', 'งาน 49'])

    await user.click(button(labels.complete('งาน 1')))
    await user.click(button(labels.remove('งาน 25')))
    expect(todoTitles()).toHaveLength(48)
    expect(todoTitles()[0]).toBe('งาน 2')
    expect(todoTitles()).not.toContain('งาน 25')
    expect(doneTitles()).toEqual(['งาน 1'])

    await addTasks(user, 'งานใหม่')
    expect(todoTitles()).toHaveLength(49)
    expect(todoTitles().at(-1)).toBe('งานใหม่')
  })
})

describe('P3 focus after a row leaves its list', () => {
  const addTaskBox = () => screen.getByRole('textbox', { name: labels.inputLabel })

  // [case, tasks, clicked, expected focus owner (null = the add-task box)]
  const cases: Array<[string, string[], string, string | null]> = [
    ['the same button in the next row', ['A', 'B', 'C'], 'B', 'C'],
    ['the previous row when the last row is used', ['A', 'B', 'C'], 'C', 'B'],
    ['the add-task box when no row is left', ['A'], 'A', null],
  ]

  it.each(cases)('P3-01 ✓ in the todo list moves focus to %s', async (_case, tasks, clicked, expected) => {
    const { user } = setup()
    await addTasks(user, ...tasks)
    await user.click(button(labels.complete(clicked)))
    expect(expected === null ? addTaskBox() : button(labels.complete(expected))).toHaveFocus()
  })

  it.each(cases)('P3-02 ✕ in the todo list moves focus to %s', async (_case, tasks, clicked, expected) => {
    const { user } = setup()
    await addTasks(user, ...tasks)
    await user.click(button(labels.remove(clicked)))
    expect(expected === null ? addTaskBox() : button(labels.remove(expected))).toHaveFocus()
  })

  // Done rows are listed newest first, so completing A, B, C in order shows C, B, A.
  const doneCases: Array<[string, string[], string, string | null]> = [
    ['the same button in the next row', ['A', 'B', 'C'], 'B', 'A'],
    ['the previous row when the last row is used', ['A', 'B', 'C'], 'A', 'B'],
    ['the add-task box when no row is left', ['A'], 'A', null],
  ]

  async function completeAll(user: UserEvent, tasks: string[]) {
    await addTasks(user, ...tasks)
    for (const title of tasks) await user.click(button(labels.complete(title)))
  }

  it.each(doneCases)('P3-03 ↩ in "เสร็จวันนี้" moves focus to %s', async (_case, tasks, clicked, expected) => {
    const { user } = setup()
    await completeAll(user, tasks)
    await user.click(within(doneList()).getByRole('button', { name: labels.uncomplete(clicked) }))
    expect(expected === null ? addTaskBox() : button(labels.uncomplete(expected))).toHaveFocus()
  })

  it.each(doneCases)('P3-04 ✕ in "เสร็จวันนี้" moves focus to %s', async (_case, tasks, clicked, expected) => {
    const { user } = setup()
    await completeAll(user, tasks)
    await user.click(within(doneList()).getByRole('button', { name: labels.remove(clicked) }))
    expect(
      expected === null ? addTaskBox() : within(doneList()).getByRole('button', { name: labels.remove(expected) }),
    ).toHaveFocus()
  })
})

describe('v2 store and newer-version data', () => {
  const todo = (id: string, title: string, order: number, dueDate?: string): Task => ({
    id, title, order, status: 'todo', createdAt: local(5, 1).toISOString(), ...(dueDate === undefined ? {} : { dueDate }),
  })
  const doneToday = (): Task => ({
    id: 'd', title: 'เสร็จแล้ว', order: 9, status: 'done', createdAt: local(5, 1).toISOString(), completedAt: local(5, 8).toISOString(),
  })
  const freezeToday = () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(local(5, 9))
  }
  const addTaskBox = () => screen.getByRole('textbox', { name: labels.inputLabel })

  it('AC-16.4 shows the newer-version message from labels, disables adding, hides the empty state, and leaves storage untouched', async () => {
    const raw = '{\n  "schemaVersion": 3,\n  "tasks": []\n}\n'
    localStorage.setItem(STORAGE_KEY, raw)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { user } = setup()
    const message = screen.getByText(labels.newerVersion)
    expect(message).toHaveAttribute('role', 'status')
    expect(addTaskBox()).toBeDisabled()
    expect(button(labels.addButton)).toBeDisabled()
    expect(screen.queryByText(labels.emptyNoTasks)).not.toBeInTheDocument()
    expect(screen.queryByText(labels.emptyAllDone)).not.toBeInTheDocument()
    expect(todoTitles()).toEqual([])

    await user.click(button(labels.addButton))
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
    expect(localStorage.getItem('task-priority-app:tasks:corrupt-backup')).toBeNull()
  })

  it.each<[string, Task[]]>([
    ['no done task', [todo('a', 'A', 0)]],
    ['a task finished today', [todo('a', 'A', 0), doneToday()]],
  ])('S0-08 renders the newer-version message and no lists when the newer store holds %s', (_label, tasks) => {
    freezeToday()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 3, tasks }))
    setup()
    expect(screen.getByText(labels.newerVersion)).toHaveAttribute('role', 'status')
    expect(screen.getByRole('heading', { name: labels.todoHeading })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: labels.todoHeading })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: labels.doneHeading })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: labels.doneHeading })).not.toBeInTheDocument()
  })

  it('S0-01 renders todo and done-today tasks from a v2 store, including a task with dueDate', () => {
    freezeToday()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 2, tasks: [todo('b', 'B', 1), todo('a', 'A', 0, '2026-10-17'), doneToday()] }),
    )
    setup()
    expect(todoTitles()).toEqual(['A', 'B'])
    expect(doneTitles()).toEqual(['เสร็จแล้ว'])
    expect(screen.queryByText(/2026-10-17|17\/10\/2026/)).not.toBeInTheDocument() // no deadline UI in this slice
    expect(screen.queryByText(labels.newerVersion)).not.toBeInTheDocument()
    expect(addTaskBox()).toBeEnabled()
    expect(button(labels.addButton)).toBeEnabled()
  })
})

describe('review mode (slice 1)', () => {
  const dialog = () => screen.getByRole('dialog')
  const reviewButton = () => screen.getByRole('button', { name: labels.review.button })
  const storedTodo = () =>
    (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"schemaVersion":2,"tasks":[]}') as Store).tasks
      .filter((t) => t.status === 'todo')
      .sort((a, b) => a.order - b.order)
      .map((t) => t.title)
  const card = (title: string) => within(dialog()).getByRole('button', { name: title })
  function expectPair(upper: string, lower: string, k: number, total: number) {
    expect(card(upper)).toHaveAttribute('data-position', 'upper')
    expect(card(lower)).toHaveAttribute('data-position', 'lower')
    expect(within(dialog()).getByText(labels.review.counter(k, total))).toBeInTheDocument()
  }
  async function openWith(user: UserEvent, ...titles: string[]) {
    await addTasks(user, ...titles)
    await user.click(reviewButton())
  }

  it.each<[number, boolean]>([
    [0, true],
    [1, true],
    [2, false],
  ])('AC-6.1 with %i todo tasks the review button disabled=%s and explains why', async (count, disabled) => {
    const { user } = setup()
    await addTasks(user, ...['A', 'B'].slice(0, count))
    if (disabled) {
      expect(reviewButton()).toBeDisabled()
      expect(reviewButton()).toHaveAccessibleDescription(labels.review.needTwo)
    } else {
      expect(reviewButton()).toBeEnabled()
      expect(reviewButton()).not.toHaveAccessibleDescription(labels.review.needTwo)
    }
  })

  it('AC-6.2 the mode replaces the page: dialog with question, two cards, counter, skip, close — no text box, list or done section', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'B', 'C', 'X')
    await user.click(button(labels.complete('X')))
    expect(screen.getByRole('heading', { name: labels.doneHeading })).toBeInTheDocument()
    await user.click(reviewButton())

    expect(dialog()).toHaveAttribute('aria-modal', 'true')
    expect(dialog()).toHaveAccessibleName(labels.review.question)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: labels.doneHeading })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: labels.todoHeading })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: labels.review.question })).toBeInTheDocument()
    expectPair('B', 'C', 1, 2)
    expect(within(dialog()).getAllByRole('button').map((b) => b.dataset.position ?? b.textContent)).toEqual([
      'upper',
      'lower',
      labels.review.skip,
      labels.review.close,
    ])
  })

  it.each<[string, (user: UserEvent) => Promise<void>]>([
    ['the close button', async (user) => user.click(screen.getByRole('button', { name: labels.review.close }))],
    ['Escape', async (user) => user.keyboard('{Escape}')],
    [
      'close on the summary',
      async (user) => {
        await user.click(card('B'))
        await user.click(screen.getByRole('button', { name: labels.review.close }))
      },
    ],
  ])('AC-6.4 focus goes to the upper card on open and back to the review button after closing with %s', async (_how, closeIt) => {
    const { user } = setup()
    await openWith(user, 'A', 'B')
    expect(card('A')).toHaveFocus()
    await closeIt(user)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(reviewButton()).toHaveFocus()
  })

  it('AC-7.1 A, B, C, D start with C on top, D below, "คำถาม 1 จาก 3"', async () => {
    const { user } = setup()
    await openWith(user, 'A', 'B', 'C', 'D')
    expectPair('C', 'D', 1, 3)
  })

  it('AC-7.2 picking the lower card D stores A, B, D, C at once and asks B vs D next', async () => {
    const { user } = setup()
    await openWith(user, 'A', 'B', 'C', 'D')
    await user.click(card('D'))
    expect(storedTodo()).toEqual(['A', 'B', 'D', 'C'])
    expectPair('B', 'D', 2, 3)
  })

  it.each<[string, () => HTMLElement]>([
    ['the upper card C', () => card('C')],
    ['skip', () => screen.getByRole('button', { name: labels.review.skip })],
  ])('AC-7.3 choosing %s keeps the order and asks B vs C next', async (_label, target) => {
    const { user } = setup()
    await openWith(user, 'A', 'B', 'C', 'D')
    await user.click(target())
    expect(storedTodo()).toEqual(['A', 'B', 'C', 'D'])
    expectPair('B', 'C', 2, 3)
  })

  it('AC-7.4 picking D every time ends with D, A, B, C in state and storage', async () => {
    const { user } = setup()
    await openWith(user, 'A', 'B', 'C', 'D')
    for (let i = 0; i < 3; i++) await user.click(card('D'))
    expect(storedTodo()).toEqual(['D', 'A', 'B', 'C'])
    await user.click(screen.getByRole('button', { name: labels.review.close }))
    expect(todoTitles()).toEqual(['D', 'A', 'B', 'C'])
  })

  it('AC-7.5 after the last question the summary names the top task with "again" and "close" and no cards', async () => {
    const { user } = setup()
    await openWith(user, 'A', 'B', 'C', 'D')
    for (let i = 0; i < 3; i++) await user.click(card('D'))
    expect(within(dialog()).getByText(labels.review.topTask('D'))).toBeInTheDocument()
    expect(within(dialog()).getByRole('button', { name: labels.review.again })).toBeInTheDocument()
    expect(within(dialog()).getByRole('button', { name: labels.review.close })).toBeInTheDocument()
    expect(within(dialog()).queryByRole('button', { name: 'D' })).not.toBeInTheDocument()
    expect(dialog().querySelector('[data-position]')).toBeNull()
  })

  it('AC-7.6 "again" starts over from the bottom pair of the new order with the counter at 1', async () => {
    const { user } = setup()
    await openWith(user, 'A', 'B', 'C', 'D')
    for (let i = 0; i < 3; i++) await user.click(card('D'))
    await user.click(screen.getByRole('button', { name: labels.review.again }))
    expectPair('B', 'C', 1, 3)
    expect(card('B')).toHaveFocus()
  })

  it.each<[string, (user: UserEvent) => Promise<void>]>([
    ['close', async (user) => user.click(screen.getByRole('button', { name: labels.review.close }))],
    ['Escape', async (user) => user.keyboard('{Escape}')],
    [
      'Escape after clicking the header title',
      async (user) => {
        await user.click(screen.getByRole('heading', { name: labels.appTitle }))
        await user.keyboard('{Escape}')
      },
    ],
  ])('AC-8.1 after 2 answers (1 swap) %s closes at once, without a confirm, showing the new order', async (_how, closeIt) => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const { user } = setup()
    await openWith(user, 'A', 'B', 'C', 'D')
    await user.click(card('D'))
    await user.click(card('B'))
    await closeIt(user)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(todoTitles()).toEqual(['A', 'B', 'D', 'C'])
  })

  it('AC-10.1 only the four mode controls can take focus while the mode is open', async () => {
    const { user } = setup()
    await openWith(user, 'A', 'B', 'C')
    const focusable = [...document.querySelectorAll<HTMLElement>('button, input, a[href], select, textarea, [tabindex]')].filter(
      (el) => !el.hasAttribute('disabled') && el.tabIndex >= 0,
    )
    expect(focusable).toEqual([card('B'), card('C'), button(labels.review.skip), button(labels.review.close)])
  })

  it.each([['{Enter}'], [' ']])('AC-10.2 %s on the focused lower card works like clicking it', async (key) => {
    const { user } = setup()
    await openWith(user, 'A', 'B', 'C', 'D')
    await user.tab()
    expect(card('D')).toHaveFocus()
    await user.keyboard(key)
    expect(storedTodo()).toEqual(['A', 'B', 'D', 'C'])
    expectPair('B', 'D', 2, 3)
  })

  it('AC-10.3 the polite live region announces each new pair and then the summary', async () => {
    const { user } = setup()
    await openWith(user, 'A', 'B', 'C')
    const live = () => dialog().querySelector('[aria-live="polite"]')
    expect(live()).toHaveTextContent(labels.review.announcePair('B', 'C', 1, 2))
    await user.click(card('C'))
    expect(live()).toHaveTextContent(labels.review.announcePair('A', 'C', 2, 2))
    await user.click(card('A'))
    expect(live()).toHaveTextContent(labels.review.announceDone('A'))
  })

  it('AC-F1.1 exactly two todo tasks ask one question and then show the summary', async () => {
    const { user } = setup()
    await openWith(user, 'A', 'B')
    expectPair('A', 'B', 1, 1)
    await user.click(screen.getByRole('button', { name: labels.review.skip }))
    expect(within(dialog()).getByText(labels.review.topTask('A'))).toBeInTheDocument()
  })

  it('AC-F1.3 after a swap, a fresh render opens on the normal list with the swap kept', async () => {
    const first = setup()
    await openWith(first.user, 'A', 'B', 'C')
    await first.user.click(card('C'))
    first.unmount()
    setup()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(todoTitles()).toEqual(['A', 'C', 'B'])
  })

  it('S1-09 a task finished today is never a card during the round', async () => {
    const { user } = setup()
    await addTasks(user, 'A', 'X', 'B', 'C')
    await user.click(button(labels.complete('X')))
    await user.click(reviewButton())
    for (let i = 0; i < 2; i++) {
      expect(within(dialog()).queryByRole('button', { name: 'X' })).not.toBeInTheDocument()
      await user.click(card(i === 0 ? 'C' : 'A'))
    }
    expect(within(dialog()).queryByRole('button', { name: 'X' })).not.toBeInTheDocument()
    expect(storedTodo()).toEqual(['A', 'C', 'B'])
  })

  it('S1-10 the two cards share one className through a whole round', async () => {
    const { user } = setup()
    await openWith(user, 'A', 'B', 'C')
    for (const pick of ['C', 'A']) {
      const [upper, lower] = within(dialog()).getAllByRole('button').slice(0, 2)
      expect(upper.className).toBe(lower.className)
      await user.click(card(pick))
    }
  })

  it('S1-11 data from a newer version shows no review button', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 3, tasks: [] }))
    setup()
    expect(screen.getByText(labels.newerVersion)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: labels.review.button })).not.toBeInTheDocument()
  })
})
