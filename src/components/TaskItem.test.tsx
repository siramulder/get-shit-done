import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext, KeyboardSensor, useSensor, useSensors, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { TaskItem } from './TaskItem'
import { CardPointerSensor } from './cardPointerSensor'
import { labels } from '../lib/labels'
import type { DueBadge, Task } from '../types/task'

const makeTask = (title: string): Task => ({
  id: 'task-1',
  title,
  order: 0,
  status: 'todo',
  createdAt: '2026-10-05T02:00:00.000Z',
})

const MIDDLE = { isFirst: false, isLast: false }

type OnDragStart = (event: DragStartEvent) => void

// The app's sensors, minus the 5px activation distance, so one pointerdown is enough to start a drag.
function TestDnd({ children, onDragStart }: { children: ReactNode; onDragStart?: OnDragStart }) {
  const sensors = useSensors(
    useSensor(CardPointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  return (
    <DndContext sensors={sensors} onDragStart={onDragStart}>
      {children}
    </DndContext>
  )
}

function renderItem(task: Task, position = MIDDLE, onDragStart?: OnDragStart, dueBadge: DueBadge | null = null) {
  const handlers = {
    onMoveUp: vi.fn(), onMoveDown: vi.fn(), onComplete: vi.fn(), onDelete: vi.fn(), focusFallback: vi.fn(), onSetDueDate: vi.fn(),
  }
  render(
    <TestDnd onDragStart={onDragStart}>
      <SortableContext items={[task.id]}>
        <ul>
          <TaskItem task={task} dueBadge={dueBadge} {...position} {...handlers} />
        </ul>
      </SortableContext>
    </TestDnd>,
  )
  return handlers
}

const button = (name: string) => screen.getByRole('button', { name })

describe('TaskItem', () => {
  it.each([
    ['a short title', 'ซื้อนม'],
    ['a very long title with no spaces', 'ก'.repeat(300)],
    ['a long title with spaces', 'เตรียมสไลด์ '.repeat(40).trim()],
    ['an emoji title', 'ประชุมทีม 🚀 👨‍👩‍👧'],
  ])('P2-06 shows %s and lets it wrap', (_label, title) => {
    renderItem(makeTask(title))
    const text = screen.getByText(title)
    expect(text).toBeInTheDocument()
    expect(text).toHaveClass('break-words', 'min-w-0')
  })

  it.each([
    ['first', true, false, { isFirst: true, isLast: false }],
    ['last', false, true, { isFirst: false, isLast: true }],
    ['only', true, true, { isFirst: true, isLast: true }],
    ['middle', false, false, MIDDLE],
  ])('P2-07 %s task: ↑ disabled=%s, ↓ disabled=%s', (_label, upDisabled, downDisabled, position) => {
    renderItem(makeTask('A'), position)
    expect(button(labels.moveUp('A')).hasAttribute('disabled')).toBe(upDisabled)
    expect(button(labels.moveDown('A')).hasAttribute('disabled')).toBe(downDisabled)
  })

  it('P2-08 ↑ ↓ ✓ and delete call their handler with the task id', async () => {
    const user = userEvent.setup()
    const handlers = renderItem(makeTask('A'))
    await user.click(button(labels.moveUp('A')))
    await user.click(button(labels.moveDown('A')))
    await user.click(button(labels.complete('A')))
    await user.click(button(labels.remove('A')))
    expect(handlers.onMoveUp).toHaveBeenCalledExactlyOnceWith('task-1')
    expect(handlers.onMoveDown).toHaveBeenCalledExactlyOnceWith('task-1')
    expect(handlers.onComplete).toHaveBeenCalledExactlyOnceWith('task-1')
    expect(handlers.onDelete).toHaveBeenCalledExactlyOnceWith('task-1')
  })

  it('P2-09 every button and the drag handle carry the aria-label from labels', () => {
    renderItem(makeTask('A'))
    for (const name of [
      labels.dragHandle('A'),
      labels.moveUp('A'),
      labels.moveDown('A'),
      labels.complete('A'),
      labels.remove('A'),
    ]) {
      expect(button(name)).toHaveAttribute('aria-label', name)
    }
  })

  it('P2-10 every control is a real <button> reachable with Tab, in row order', async () => {
    const user = userEvent.setup()
    renderItem(makeTask('A'))
    const expectedOrder = [
      labels.dragHandle('A'),
      labels.due.button('A'), // v2 slice 3: the due-date button sits under the title, so it comes right after the handle
      labels.moveUp('A'),
      labels.moveDown('A'),
      labels.complete('A'),
      labels.remove('A'),
    ]
    for (const name of expectedOrder) {
      await user.tab()
      expect(button(name)).toHaveFocus()
      expect(button(name)).toBeInstanceOf(HTMLButtonElement)
    }
  })
})

describe('P2-50 a card drags from anywhere except its buttons', () => {
  // Attributes dnd-kit spreads onto the activator element via `attributes`.
  const ACTIVATOR_ATTRIBUTES = ['role', 'tabindex', 'aria-disabled', 'aria-roledescription', 'aria-describedby']
  const PRIMARY_BUTTON = { isPrimary: true, button: 0 }
  const rowButtons = (title: string) => [
    labels.moveUp(title),
    labels.moveDown(title),
    labels.complete(title),
    labels.remove(title),
  ]
  const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

  function setup() {
    const onDragStart = vi.fn()
    const task = makeTask('A')
    renderItem(task, MIDDLE, onDragStart)
    return { onDragStart, task }
  }

  // dnd-kit keeps a click-swallowing listener on the document for 50ms after a pointer drag;
  // wait it out so it cannot eat clicks in the next test.
  async function endPointerDrag() {
    fireEvent.pointerUp(document, PRIMARY_BUTTON)
    await tick(60)
  }

  it('P2-50 keyboard / screen-reader activator attributes stay on the ⠿ handle only', () => {
    setup()
    const handle = button(labels.dragHandle('A'))
    for (const name of ACTIVATOR_ATTRIBUTES) expect(handle).toHaveAttribute(name)
    expect(handle).toHaveAttribute('aria-roledescription', labels.dnd.roleDescription)

    const row = screen.getByRole('listitem')
    for (const element of [row, ...rowButtons('A').map(button)]) {
      for (const name of ACTIVATOR_ATTRIBUTES) expect(element).not.toHaveAttribute(name)
    }
  })

  it.each([
    ['the title', () => screen.getByText('A')],
    ['the card itself', () => screen.getByRole('listitem')],
    ['the ⠿ handle', () => button(labels.dragHandle('A'))],
  ])('P2-50 pointerdown on %s starts a drag', async (_label, target) => {
    const { onDragStart, task } = setup()
    fireEvent.pointerDown(target(), PRIMARY_BUTTON)
    expect(onDragStart).toHaveBeenCalledTimes(1)
    expect(onDragStart).toHaveBeenCalledWith(expect.objectContaining({ active: expect.objectContaining({ id: task.id }) }))
    await endPointerDrag()
  })

  it('P2-50 pointerdown on ↑ ↓ ✓ ✕ never starts a drag', async () => {
    const { onDragStart } = setup()
    for (const name of rowButtons('A')) fireEvent.pointerDown(button(name), PRIMARY_BUTTON)
    expect(onDragStart).not.toHaveBeenCalled()

    // Positive control: the same event on the title does start a drag, so the check above is meaningful.
    fireEvent.pointerDown(screen.getByText('A'), PRIMARY_BUTTON)
    expect(onDragStart).toHaveBeenCalledTimes(1)
    await endPointerDrag()
  })

  it('P2-50 Space starts a keyboard drag only from the ⠿ handle', async () => {
    // jsdom has no scrollIntoView, which dnd-kit calls when a keyboard drag starts.
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
    Element.prototype.scrollIntoView = vi.fn()
    try {
      const { onDragStart } = setup()
      for (const name of rowButtons('A')) fireEvent.keyDown(button(name), { code: 'Space' })
      expect(onDragStart).not.toHaveBeenCalled()

      fireEvent.keyDown(button(labels.dragHandle('A')), { code: 'Space' })
      expect(onDragStart).toHaveBeenCalledTimes(1)

      // The keyboard sensor starts listening for keys one tick after it starts; then cancel the drag.
      await tick()
      fireEvent.keyDown(document, { code: 'Escape' })
    } finally {
      if (original) Object.defineProperty(Element.prototype, 'scrollIntoView', original)
      else delete (Element.prototype as Partial<Element>).scrollIntoView
    }
  })
})

describe('due date in a row (slice 3)', () => {
  const PRIMARY_BUTTON = { isPrimary: true, button: 0 }
  const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))
  const withDue = (dueDate: string): Task => ({ ...makeTask('A'), dueDate })
  const overdue: DueBadge = { kind: 'overdue', text: labels.due.overdue(2) }
  const today: DueBadge = { kind: 'today', text: labels.due.today }
  const tomorrow: DueBadge = { kind: 'tomorrow', text: labels.due.tomorrow }
  const later: DueBadge = { kind: 'later', text: '24 ต.ค.' }
  const dateInput = () => screen.getByLabelText<HTMLInputElement>(labels.due.dateInput('A'))
  const queryDateInput = () => screen.queryByLabelText(labels.due.dateInput('A'))
  // What a sighted user reads on an element: its text without the parts hidden from assistive tech.
  function visibleText(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove())
    return (clone.textContent ?? '').trim()
  }

  it('AC-11.2 the row offers a due-date button; pressing it opens a date field that reports the picked date at once', async () => {
    const user = userEvent.setup()
    const { onSetDueDate } = renderItem(makeTask('A'))
    expect(queryDateInput()).not.toBeInTheDocument()
    const dueButton = button(labels.due.button('A'))
    expect(dueButton).toHaveAttribute('aria-expanded', 'false')
    await user.click(dueButton)
    expect(dueButton).toHaveAttribute('aria-expanded', 'true')
    expect(dateInput()).toHaveFocus()
    expect(dateInput()).toHaveAttribute('type', 'date')
    expect(dateInput()).toHaveValue('')
    expect(screen.queryByRole('button', { name: labels.due.clear })).not.toBeInTheDocument() // nothing to remove yet
    fireEvent.change(dateInput(), { target: { value: '2026-10-24' } })
    expect(onSetDueDate).toHaveBeenCalledExactlyOnceWith('task-1', '2026-10-24')
    expect(dateInput()).toBeInTheDocument() // the editor stays open until the user closes it
    await user.click(button(labels.due.done))
    expect(queryDateInput()).not.toBeInTheDocument()
    expect(dueButton).toHaveFocus()
    expect(onSetDueDate).toHaveBeenCalledTimes(1)
  })

  it('AC-11.3 with a due date the editor shows it and "ลบกำหนดส่ง" removes it, closes the editor and returns focus', async () => {
    const user = userEvent.setup()
    const { onSetDueDate } = renderItem(withDue('2026-10-24'), MIDDLE, undefined, later)
    const dueButton = button(labels.due.buttonWithBadge('A', '24 ต.ค.'))
    await user.click(dueButton)
    expect(dateInput()).toHaveValue('2026-10-24')
    await user.click(button(labels.due.clear))
    expect(onSetDueDate).toHaveBeenCalledExactlyOnceWith('task-1', null)
    expect(queryDateInput()).not.toBeInTheDocument()
    expect(dueButton).toHaveFocus()
  })

  it('AC-12.1 the overdue badge in the list is a hot fill with on-neon text and a 6px radius', () => {
    renderItem(withDue('2026-10-15'), MIDDLE, undefined, overdue)
    const badge = screen.getByText(overdue.text)
    expect(badge).toHaveClass('bg-hot', 'text-on-neon', 'rounded-[6px]')
  })

  it('AC-12.2 the "วันนี้" badge in the list is ink text behind a decorative hot dot; "พรุ่งนี้" is muted text', () => {
    renderItem(withDue('2026-10-17'), MIDDLE, undefined, today)
    const badge = screen.getByText(today.text)
    expect(badge).toHaveClass('text-ink')
    expect(badge).not.toHaveClass('bg-hot')
    const dot = badge.querySelector('[aria-hidden="true"]')
    expect(dot).toHaveClass('bg-hot')
    expect(dot).toHaveTextContent('')
    cleanup()

    renderItem(withDue('2026-10-18'), MIDDLE, undefined, tomorrow)
    const next = screen.getByText(tomorrow.text)
    expect(next).toHaveClass('text-muted')
    expect(next.querySelector('.bg-hot')).toBeNull()
    expect(next).not.toHaveClass('bg-hot')
  })

  it('AC-12.3 a later date in the list is muted text with no fill and no dot', () => {
    renderItem(withDue('2026-10-24'), MIDDLE, undefined, later)
    const badge = screen.getByText(later.text)
    expect(badge).toHaveClass('text-muted')
    expect(badge).not.toHaveClass('bg-hot')
    expect(badge.querySelector('.bg-hot')).toBeNull()
  })

  it('S3-08 pointerdown on the due-date button, the date field or anywhere inside the editor never starts a drag', async () => {
    const user = userEvent.setup()
    const onDragStart = vi.fn()
    renderItem(withDue('2026-10-15'), MIDDLE, onDragStart, overdue)
    const dueButton = button(labels.due.buttonWithBadge('A', overdue.text))
    fireEvent.pointerDown(dueButton, PRIMARY_BUTTON)
    fireEvent.pointerDown(screen.getByText(overdue.text), PRIMARY_BUTTON) // the badge inside the button
    await user.click(dueButton)
    const editor = dateInput().parentElement as HTMLElement // the editor's own box: its empty space
    expect(editor).toContainElement(button(labels.due.done))
    for (const target of [dateInput(), editor, button(labels.due.clear), button(labels.due.done)]) {
      fireEvent.pointerDown(target, PRIMARY_BUTTON)
    }
    expect(onDragStart).not.toHaveBeenCalled()

    // Positive control: the same event on the title does start a drag, so the check above is meaningful.
    fireEvent.pointerDown(screen.getByText('A'), PRIMARY_BUTTON)
    expect(onDragStart).toHaveBeenCalledTimes(1)
    fireEvent.pointerUp(document, PRIMARY_BUTTON)
    await tick(60) // dnd-kit swallows clicks for 50ms after a pointer drag
  })

  it('S3-08 with the 5px drag distance the app uses: the title starts a drag once the pointer has moved more than 5px, the due-date button and the editor never do', async () => {
    const user = userEvent.setup()
    const onDragStart = vi.fn()
    const task = withDue('2026-10-15')
    const handlers = {
      onMoveUp: vi.fn(), onMoveDown: vi.fn(), onComplete: vi.fn(), onDelete: vi.fn(), focusFallback: vi.fn(), onSetDueDate: vi.fn(),
    }
    // Same sensor and activation distance as TaskList (the shared TestDnd above drops the distance).
    function AppDistanceDnd({ children }: { children: ReactNode }) {
      const sensors = useSensors(useSensor(CardPointerSensor, { activationConstraint: { distance: 5 } }))
      return (
        <DndContext sensors={sensors} onDragStart={onDragStart}>
          {children}
        </DndContext>
      )
    }
    render(
      <AppDistanceDnd>
        <SortableContext items={[task.id]}>
          <ul>
            <TaskItem task={task} dueBadge={overdue} {...MIDDLE} {...handlers} />
          </ul>
        </SortableContext>
      </AppDistanceDnd>,
    )
    const press = (target: Element) => fireEvent.pointerDown(target, { ...PRIMARY_BUTTON, clientX: 100, clientY: 100 })
    const moveTo = (x: number) => fireEvent.pointerMove(document, { ...PRIMARY_BUTTON, clientX: x, clientY: 100 })
    const release = () => fireEvent.pointerUp(document, PRIMARY_BUTTON)

    const dueButton = button(labels.due.buttonWithBadge('A', overdue.text))
    await user.click(dueButton)
    const editor = dateInput().parentElement as HTMLElement
    for (const target of [dueButton, dateInput(), button(labels.due.done), editor]) {
      press(target)
      moveTo(115) // 15px
      release()
    }
    expect(onDragStart).not.toHaveBeenCalled()
    expect(dateInput()).toBeInTheDocument() // none of this closed the editor

    // Control: the same gesture from the title is a drag, but only past 5px.
    press(screen.getByText('A'))
    moveTo(103)
    expect(onDragStart).not.toHaveBeenCalled()
    moveTo(115)
    expect(onDragStart).toHaveBeenCalledTimes(1)
    release()
    await tick(60) // dnd-kit swallows clicks for 50ms after a pointer drag
  })

  it('S3-09 "เสร็จ" and pressing the due-date button a second time both close the editor with focus on the due-date button', async () => {
    const user = userEvent.setup()
    const { onSetDueDate } = renderItem(withDue('2026-10-24'), MIDDLE, undefined, later)
    const dueButton = button(labels.due.buttonWithBadge('A', '24 ต.ค.'))
    await user.click(dueButton)
    expect(dateInput()).toHaveFocus()
    await user.click(button(labels.due.done))
    expect(queryDateInput()).not.toBeInTheDocument()
    expect(dueButton).toHaveFocus()
    expect(dueButton).toHaveAttribute('aria-expanded', 'false')

    await user.click(dueButton)
    expect(dateInput()).toHaveFocus()
    expect(dueButton).toHaveAttribute('aria-expanded', 'true')
    await user.click(dueButton) // the same button again
    expect(queryDateInput()).not.toBeInTheDocument()
    expect(dueButton).toHaveFocus()
    expect(dueButton).toHaveAttribute('aria-expanded', 'false')
    expect(onSetDueDate).not.toHaveBeenCalled()
  })

  it('S3-09 Escape inside the editor closes it and returns focus to the due-date button, from the field or from a button', async () => {
    const user = userEvent.setup()
    const { onSetDueDate } = renderItem(withDue('2026-10-15'), MIDDLE, undefined, overdue)
    const dueButton = button(labels.due.buttonWithBadge('A', overdue.text))
    await user.click(dueButton)
    expect(dateInput()).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(queryDateInput()).not.toBeInTheDocument()
    expect(dueButton).toHaveFocus()

    await user.keyboard('{Enter}') // the button is a real button: Enter opens the editor again
    expect(dateInput()).toHaveFocus()
    button(labels.due.done).focus()
    await user.keyboard('{Escape}')
    expect(queryDateInput()).not.toBeInTheDocument()
    expect(dueButton).toHaveFocus()
    expect(onSetDueDate).not.toHaveBeenCalled()
  })

  it.each<[string, Task, DueBadge | null]>([
    ['no due date', makeTask('A'), null],
    ['an overdue badge', withDue('2026-10-15'), overdue],
    ['a "วันนี้" badge', withDue('2026-10-17'), today],
    ['a "พรุ่งนี้" badge', withDue('2026-10-18'), tomorrow],
    ['a date badge', withDue('2026-10-24'), later],
  ])('S3-13 with %s the accessible name of the due-date button contains the text shown on it', (_label, task, badge) => {
    renderItem(task, MIDDLE, undefined, badge)
    const name = badge === null ? labels.due.button('A') : labels.due.buttonWithBadge('A', badge.text)
    const dueButton = button(name)
    const shown = visibleText(dueButton)
    expect(shown).toBe(badge === null ? labels.due.add : badge.text)
    expect(dueButton).toHaveAccessibleName(expect.stringContaining(shown))
    expect(dueButton).toHaveAccessibleName(expect.stringContaining('A'))
  })

  it('S3-15 an empty value from the date field (a cleared day / month / year part) is ignored: nothing is removed', async () => {
    const user = userEvent.setup()
    const { onSetDueDate } = renderItem(withDue('2026-10-24'), MIDDLE, undefined, later)
    await user.click(button(labels.due.buttonWithBadge('A', '24 ต.ค.')))
    fireEvent.change(dateInput(), { target: { value: '' } })
    expect(onSetDueDate).not.toHaveBeenCalled()
    expect(dateInput()).toBeInTheDocument()
    expect(button(labels.due.buttonWithBadge('A', '24 ต.ค.'))).toBeInTheDocument()
    expect(button(labels.due.clear)).toBeInTheDocument() // removing still goes through this button only
    // … and typing the rest of the date afterwards is reported normally
    fireEvent.change(dateInput(), { target: { value: '2026-10-27' } })
    expect(onSetDueDate).toHaveBeenCalledExactlyOnceWith('task-1', '2026-10-27')
  })

  it('S3-17 a year below 1000 from the date field (the year being typed digit by digit) is ignored until the year is complete', async () => {
    const user = userEvent.setup()
    const { onSetDueDate } = renderItem(makeTask('A'))
    await user.click(button(labels.due.button('A')))
    // What Chromium reports while "2026" is typed into the year part of 20/11/____.
    for (const value of ['0002-11-20', '0020-11-20', '0202-11-20', '0999-12-31']) {
      fireEvent.change(dateInput(), { target: { value } })
    }
    expect(onSetDueDate).not.toHaveBeenCalled()
    fireEvent.change(dateInput(), { target: { value: '2026-11-20' } })
    expect(onSetDueDate).toHaveBeenCalledExactlyOnceWith('task-1', '2026-11-20')
    fireEvent.change(dateInput(), { target: { value: '1000-01-01' } }) // four digits: a complete year, however old
    expect(onSetDueDate).toHaveBeenLastCalledWith('task-1', '1000-01-01')
  })
})
