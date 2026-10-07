import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { TaskItem } from './TaskItem'
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

function renderItem(task: Task, position = MIDDLE) {
  const handlers = { onMoveUp: vi.fn(), onMoveDown: vi.fn(), onComplete: vi.fn(), onDelete: vi.fn() }
  render(
    <DndContext>
      <SortableContext items={[task.id]}>
        <ul>
          <TaskItem task={task} {...position} {...handlers} />
        </ul>
      </SortableContext>
    </DndContext>,
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

describe('P2-38 drag listeners live on the drag handle only', () => {
  // Attributes dnd-kit spreads onto the activator element via `attributes`.
  const ACTIVATOR_ATTRIBUTES = ['role', 'tabindex', 'aria-disabled', 'aria-roledescription', 'aria-describedby']
  const PRIMARY_BUTTON = { isPrimary: true, button: 0 }
  const otherButtons = (title: string) => [
    labels.moveUp(title),
    labels.moveDown(title),
    labels.complete(title),
    labels.remove(title),
  ]

  // Default sensors have no activation constraint, so any pointerdown that reaches a listener starts a drag.
  function renderWithDragSpy() {
    const onDragStart = vi.fn()
    const task = makeTask('A')
    render(
      <DndContext onDragStart={onDragStart}>
        <SortableContext items={[task.id]}>
          <ul>
            <TaskItem task={task} {...MIDDLE} onMoveUp={vi.fn()} onMoveDown={vi.fn()} onComplete={vi.fn()} onDelete={vi.fn()} />
          </ul>
        </SortableContext>
      </DndContext>,
    )
    return { onDragStart, task }
  }

  it('P2-38 dnd-kit activator attributes are on the drag handle and nowhere else in the row', () => {
    renderWithDragSpy()
    const handle = button(labels.dragHandle('A'))
    for (const name of ACTIVATOR_ATTRIBUTES) expect(handle).toHaveAttribute(name)
    expect(handle).toHaveAttribute('aria-roledescription', labels.dnd.roleDescription)

    const row = screen.getByRole('listitem')
    for (const element of [row, ...otherButtons('A').map(button)]) {
      for (const name of ACTIVATOR_ATTRIBUTES) expect(element).not.toHaveAttribute(name)
    }
  })

  it('P2-38 pointerdown starts a drag from the handle only, never from the row or its other buttons', () => {
    const { onDragStart, task } = renderWithDragSpy()

    for (const name of otherButtons('A')) fireEvent.pointerDown(button(name), PRIMARY_BUTTON)
    fireEvent.pointerDown(screen.getByText('A'), PRIMARY_BUTTON)
    fireEvent.pointerDown(screen.getByRole('listitem'), PRIMARY_BUTTON)
    expect(onDragStart).not.toHaveBeenCalled()

    // Positive control: the same event on the handle does start a drag, so the checks above are meaningful.
    fireEvent.pointerDown(button(labels.dragHandle('A')), PRIMARY_BUTTON)
    expect(onDragStart).toHaveBeenCalledTimes(1)
    expect(onDragStart).toHaveBeenCalledWith(expect.objectContaining({ active: expect.objectContaining({ id: task.id }) }))
    fireEvent.pointerUp(document, PRIMARY_BUTTON)
  })
})
