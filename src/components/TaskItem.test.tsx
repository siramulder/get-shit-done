import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext, KeyboardSensor, useSensor, useSensors, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { TaskItem } from './TaskItem'
import { CardPointerSensor } from './cardPointerSensor'
import { labels } from '../lib/labels'
import type { Task } from '../types/task'

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

function renderItem(task: Task, position = MIDDLE, onDragStart?: OnDragStart) {
  const handlers = { onMoveUp: vi.fn(), onMoveDown: vi.fn(), onComplete: vi.fn(), onDelete: vi.fn() }
  render(
    <TestDnd onDragStart={onDragStart}>
      <SortableContext items={[task.id]}>
        <ul>
          <TaskItem task={task} {...position} {...handlers} />
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
