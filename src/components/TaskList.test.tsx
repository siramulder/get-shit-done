import { render, screen, within } from '@testing-library/react'
import { TaskList } from './TaskList'
import { labels } from '../lib/labels'
import type { Task } from '../types/task'

const tasks: Task[] = ['A', 'B', 'C'].map((title, order) => ({
  id: `id-${title}`,
  title,
  order,
  status: 'todo',
  createdAt: '2026-10-05T02:00:00.000Z',
}))

function renderList() {
  const handlers = {
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    onComplete: vi.fn(),
    onDelete: vi.fn(),
    onReorder: vi.fn(),
    focusFallback: vi.fn(),
  }
  render(
    <>
      <h2 id="todo-heading">{labels.todoHeading}</h2>
      <TaskList tasks={tasks} labelledBy="todo-heading" {...handlers} />
    </>,
  )
  return handlers
}

describe('TaskList', () => {
  it('renders the tasks in the given order inside a list named after the heading', () => {
    renderList()
    const list = screen.getByRole('list', { name: labels.todoHeading })
    const rows = within(list).getAllByRole('listitem')
    expect(rows.map((row) => within(row).getByText(/^[ABC]$/).textContent)).toEqual(['A', 'B', 'C'])
  })

  it('disables ↑ only on the first row and ↓ only on the last row', () => {
    renderList()
    expect(screen.getByRole('button', { name: labels.moveUp('A') })).toBeDisabled()
    expect(screen.getByRole('button', { name: labels.moveUp('B') })).toBeEnabled()
    expect(screen.getByRole('button', { name: labels.moveDown('B') })).toBeEnabled()
    expect(screen.getByRole('button', { name: labels.moveDown('C') })).toBeDisabled()
  })

  it('wires Thai screen-reader instructions and role description to every drag handle', () => {
    renderList()
    const instructions = screen.getByText(labels.dnd.instructions)
    for (const title of ['A', 'B', 'C']) {
      const handle = screen.getByRole('button', { name: labels.dragHandle(title) })
      expect(handle).toHaveAttribute('aria-roledescription', labels.dnd.roleDescription)
      expect(handle).toHaveAttribute('aria-describedby', instructions.id)
    }
  })
})
