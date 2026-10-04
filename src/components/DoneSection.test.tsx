import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DoneSection } from './DoneSection'
import { labels } from '../lib/labels'
import type { Task } from '../types/task'

const done: Task = {
  id: 'done-1',
  title: 'ส่งรายงาน',
  order: 0,
  status: 'done',
  createdAt: '2026-10-05T02:00:00.000Z',
  completedAt: '2026-10-05T03:00:00.000Z',
}

describe('DoneSection', () => {
  it('renders nothing when no task was finished today', () => {
    const { container } = render(<DoneSection tasks={[]} onUncomplete={vi.fn()} onDelete={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists finished tasks under "เสร็จวันนี้" with only undo and delete buttons', () => {
    render(<DoneSection tasks={[done]} onUncomplete={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByRole('heading', { name: labels.doneHeading })).toBeInTheDocument()
    expect(screen.getByText(done.title)).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      labels.uncomplete(done.title),
      labels.remove(done.title),
    ])
  })

  it('calls onUncomplete and onDelete with the task id', async () => {
    const user = userEvent.setup()
    const onUncomplete = vi.fn()
    const onDelete = vi.fn()
    render(<DoneSection tasks={[done]} onUncomplete={onUncomplete} onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: labels.uncomplete(done.title) }))
    await user.click(screen.getByRole('button', { name: labels.remove(done.title) }))
    expect(onUncomplete).toHaveBeenCalledExactlyOnceWith('done-1')
    expect(onDelete).toHaveBeenCalledExactlyOnceWith('done-1')
  })
})
