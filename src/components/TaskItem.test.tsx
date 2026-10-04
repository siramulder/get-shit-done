import { render, screen } from '@testing-library/react'
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
