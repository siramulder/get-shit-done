import { StrictMode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import App from './App'
import { labels } from './lib/labels'
import { STORAGE_KEY } from './lib/storage'
import type { Task } from './types/task'

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
