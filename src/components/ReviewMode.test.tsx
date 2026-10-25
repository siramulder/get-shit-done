import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewMode } from './ReviewMode'
import { labels } from '../lib/labels'
import { answer, startReview } from '../lib/review'
import type { Task } from '../types/task'

const task = (id: string, order: number): Task => ({
  id,
  title: `งาน ${id}`,
  order,
  status: 'todo',
  createdAt: '2026-10-05T01:00:00.000Z',
})
const tasks = [task('A', 0), task('B', 1), task('C', 2), task('D', 3)]

function renderMode(state = startReview(tasks.map((t) => t.id))!) {
  const handlers = { onAnswer: vi.fn(), onRestart: vi.fn(), onClose: vi.fn() }
  render(<ReviewMode tasks={tasks} state={state} {...handlers} />)
  return handlers
}

const card = (position: 'upper' | 'lower') =>
  within(screen.getByRole('dialog')).getAllByRole('button').find((b) => b.dataset.position === position)!

describe('ReviewMode', () => {
  it('S1-10 both cards always carry exactly the same classes', () => {
    renderMode()
    expect(card('upper').className).toBe(card('lower').className)
    expect(card('upper')).toHaveClass('bg-neon', 'text-on-neon')
  })

  it('AC-10.1 Tab cycles upper card → lower card → skip → close and stays inside the mode', async () => {
    const user = userEvent.setup()
    renderMode()
    expect(card('upper')).toHaveFocus()
    await user.tab()
    expect(card('lower')).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: labels.review.skip })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: labels.review.close })).toHaveFocus()
    await user.tab()
    expect(card('upper')).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: labels.review.close })).toHaveFocus()
  })

  it('AC-10.1 card names are the task titles only; the บน/ล่าง tags are hidden from assistive tech', () => {
    renderMode()
    expect(screen.getByRole('button', { name: 'งาน C' })).toBe(card('upper'))
    expect(screen.getByRole('button', { name: 'งาน D' })).toBe(card('lower'))
  })

  it('AC-10.3 one polite live region announces the question, both titles and the counter', () => {
    renderMode()
    const live = screen.getByRole('dialog').querySelectorAll('[aria-live]')
    expect(live).toHaveLength(1)
    expect(live[0]).toHaveAttribute('aria-live', 'polite')
    expect(live[0]).toHaveTextContent(labels.review.announcePair('งาน C', 'งาน D', 1, 3))
  })

  it('AC-10.2 Enter and Space on a card answer through onAnswer', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderMode()
    card('lower').focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onAnswer.mock.calls).toEqual([['lower'], ['lower']])
  })

  it('AC-7.5 the summary shows the top task with "again" and "close" and no cards', async () => {
    const user = userEvent.setup()
    let state = startReview(['A', 'B'])!
    state = answer(state, 'upper').state
    const { onRestart, onClose } = renderMode(state)
    expect(screen.getByText(labels.review.topTask('งาน A'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: labels.review.again })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'งาน A' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: labels.review.again }))
    await user.click(screen.getByRole('button', { name: labels.review.close }))
    expect(onRestart).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
